import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { database, MembershipRole } from "@pindash/database";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomBytes } from "node:crypto";
import type { AuthenticatedUser } from "./auth.types";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "./password-auth";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  private readonly ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 30);
  private readonly authAttempts = new Map<
    string,
    { count: number; resetAt: number }
  >();
  private readonly mediaBucket = process.env.S3_BUCKET ?? "pindash-media";
  private readonly s3 = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "pindash",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "",
    },
  });

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async resolve(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token) return null;
    const session = await database.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: {
        user: { include: { memberships: { include: { workspace: true } } } },
      },
    });
    if (!session || session.expiresAt <= new Date() || session.user.deletedAt) {
      return null;
    }
    return {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      workspaces: session.user.memberships.map((membership) => ({
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        role: membership.role,
      })),
    };
  }

  async createDevelopmentSession(): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Development sign-in is disabled");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlDays * DAY_MS);
    await database.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: "owner@pindash.local" },
        update: {},
        create: { email: "owner@pindash.local", displayName: "Alex Morgan" },
      });
      const workspace = await tx.workspace.upsert({
        where: { slug: "atelier-studio" },
        update: {},
        create: {
          name: "Atelier Studio",
          slug: "atelier-studio",
          ownerUserId: user.id,
        },
      });
      await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
        },
        update: { role: MembershipRole.OWNER },
        create: {
          workspaceId: workspace.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });
      await tx.session.create({
        data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt },
      });
    });
    return { token, expiresAt };
  }

  private rateLimit(key: string): void {
    const now = Date.now();
    const current = this.authAttempts.get(key);
    if (!current || current.resetAt <= now) {
      this.authAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
      return;
    }
    if (current.count >= 5)
      throw new HttpException(
        "Too many sign-in attempts. Retry later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    current.count += 1;
  }

  async registerWithPassword(
    emailInput: string,
    password: string,
    legalAccepted: boolean,
    ip: string,
    inviteToken?: string,
  ): Promise<{ delivered: true }> {
    const email = emailInput.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new BadRequestException("Enter a valid email address");
    if (!legalAccepted)
      throw new BadRequestException("Legal acceptance is required");
    try {
      validatePassword(password);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Password is invalid",
      );
    }
    this.rateLimit(`register-ip:${ip}`);
    this.rateLimit(`register-email:${email}`);
    if (inviteToken) {
      const invitation = await database.workspaceInvitation.findUnique({
        where: { tokenHash: this.hashToken(inviteToken) },
      });
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt <= new Date() ||
        invitation.email !== email
      )
        throw new BadRequestException("Invitation is invalid or expired");
    }
    const existing = await database.user.findUnique({ where: { email } });
    if (existing?.passwordHash && existing.emailVerifiedAt) {
      throw new BadRequestException(
        "An account already exists. Sign in instead.",
      );
    }
    const passwordHash = await hashPassword(password);
    const token = randomBytes(32).toString("base64url");
    await database.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: { passwordHash, legalAcceptedAt: new Date() },
        create: { email, passwordHash, legalAcceptedAt: new Date() },
      });
      await tx.passwordlessToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordlessToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
    });
    await this.deliverAuthLink(
      email,
      token,
      "Verify your PinDash account",
      "Verify email and continue",
    );
    return { delivered: true };
  }

  async loginWithPassword(
    emailInput: string,
    password: string,
    ip: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const email = emailInput.trim().toLowerCase();
    this.rateLimit(`login-ip:${ip}`);
    this.rateLimit(`login-email:${email}`);
    const user = await database.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    const valid = await verifyPassword(password, user?.passwordHash);
    if (!valid || !user || user.deletedAt) {
      throw new UnauthorizedException("Email or password is incorrect");
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException("Verify your email before signing in");
    }
    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException("Account setup is incomplete");
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlDays * DAY_MS);
    await database.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.session.create({
        data: { userId: user.id, tokenHash: this.hashToken(token), expiresAt },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: membership.workspaceId,
          actorUserId: user.id,
          action: "auth.password_signed_in",
          entityType: "User",
          entityId: user.id,
        },
      });
    });
    return { token, expiresAt };
  }

  private async deliverAuthLink(
    email: string,
    token: string,
    subject: string,
    action: string,
  ): Promise<{ previewUrl?: string }> {
    const apiUrl = process.env.PUBLIC_API_URL ?? "http://localhost:4000";
    const callbackUrl = `${apiUrl}/api/v1/auth/passwordless/callback?token=${encodeURIComponent(token)}`;
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      if (process.env.NODE_ENV === "production")
        throw new ServiceUnavailableException(
          "Email delivery is not configured",
        );
      return { previewUrl: callbackUrl };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "PinDash <auth@pindash.app>",
        to: [email],
        subject,
        html: `<p>This single-use link expires in 15 minutes.</p><p><a href="${callbackUrl}">${action}</a></p>`,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException("Email delivery failed");
    return {};
  }

  async requestPasswordlessLink(
    emailInput: string,
    legalAccepted: boolean,
    ip: string,
  ): Promise<{ delivered: true; previewUrl?: string }> {
    const email = emailInput.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new BadRequestException("Enter a valid email address");
    if (!legalAccepted)
      throw new BadRequestException("Legal acceptance is required");
    this.rateLimit(`ip:${ip}`);
    this.rateLimit(`email:${email}`);
    const token = randomBytes(32).toString("base64url");
    const apiUrl = process.env.PUBLIC_API_URL ?? "http://localhost:4000";
    const callbackUrl = `${apiUrl}/api/v1/auth/passwordless/callback?token=${encodeURIComponent(token)}`;
    await database.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email },
        update: { legalAcceptedAt: new Date() },
        create: { email, legalAcceptedAt: new Date() },
      });
      await tx.passwordlessToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
    });
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      if (process.env.NODE_ENV === "production")
        throw new ServiceUnavailableException(
          "Email delivery is not configured",
        );
      return { delivered: true, previewUrl: callbackUrl };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "PinDash <auth@pindash.app>",
        to: [email],
        subject: "Sign in to PinDash",
        html: `<p>Use this secure link to sign in. It expires in 15 minutes.</p><p><a href="${callbackUrl}">Sign in to PinDash</a></p>`,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException("Email delivery failed");
    return { delivered: true };
  }

  async consumePasswordlessToken(token: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const record = await database.passwordlessToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: true },
    });
    if (!record || record.consumedAt || record.expiresAt <= new Date())
      throw new UnauthorizedException("Sign-in link is invalid or expired");
    return database.$transaction(async (tx) => {
      const consumed = await tx.passwordlessToken.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new UnauthorizedException("Sign-in link was already used");
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
      });
      await tx.session.deleteMany({ where: { userId: record.userId } });
      let membership = await tx.workspaceMember.findFirst({
        where: { userId: record.userId },
      });
      if (!membership) {
        const invitation = await tx.workspaceInvitation.findFirst({
          where: {
            email: record.user.email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });
        if (invitation) {
          membership = await tx.workspaceMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId: record.userId,
              role: invitation.role,
            },
          });
          await tx.workspaceInvitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          });
        }
      }
      if (!membership) {
        const workspace = await tx.workspace.create({
          data: {
            name: "My Pinterest workspace",
            slug: `workspace-${record.userId.slice(0, 8)}-${Date.now()}`,
            ownerUserId: record.userId,
          },
        });
        membership = await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: record.userId,
            role: MembershipRole.OWNER,
          },
        });
      }
      const sessionToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + this.ttlDays * DAY_MS);
      await tx.session.create({
        data: {
          userId: record.userId,
          tokenHash: this.hashToken(sessionToken),
          expiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: membership.workspaceId,
          actorUserId: record.userId,
          action: "auth.passwordless_signed_in",
          entityType: "User",
          entityId: record.userId,
        },
      });
      return { token: sessionToken, expiresAt };
    });
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await database.session.deleteMany({
      where: { tokenHash: this.hashToken(token) },
    });
  }

  async listWorkspaceMembers(userId: string, workspaceId: string) {
    await this.requireWorkspaceOwner(userId, workspaceId);
    const [members, invitations] = await Promise.all([
      database.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: "asc" },
      }),
      database.workspaceInvitation.findMany({
        where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      members: members.map(({ user, ...member }) => ({ ...member, ...user })),
      invitations,
    };
  }

  async inviteWorkspaceMember(
    userId: string,
    workspaceId: string,
    emailInput: string,
    role: "APPROVER" | "EDITOR",
  ) {
    await this.requireWorkspaceOwner(userId, workspaceId);
    const email = emailInput.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new BadRequestException("Enter a valid email address");
    const existingUser = await database.user.findUnique({ where: { email } });
    if (existingUser?.emailVerifiedAt) {
      await database.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
        update: { role },
        create: { workspaceId, userId: existingUser.id, role },
      });
      await this.deliverWorkspaceInvitation(email, undefined, true);
      return { invited: true, existingAccount: true };
    }
    const token = randomBytes(32).toString("base64url");
    await database.workspaceInvitation.deleteMany({
      where: { workspaceId, email, acceptedAt: null },
    });
    await database.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        tokenHash: this.hashToken(token),
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + 7 * DAY_MS),
      },
    });
    await this.deliverWorkspaceInvitation(email, token, false);
    return { invited: true, existingAccount: false };
  }

  private async requireWorkspaceOwner(userId: string, workspaceId: string) {
    const membership = await database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (membership?.role !== MembershipRole.OWNER)
      throw new ForbiddenException("Only workspace owners can manage members");
  }

  private async deliverWorkspaceInvitation(
    email: string,
    token: string | undefined,
    existingAccount: boolean,
  ): Promise<void> {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      if (process.env.NODE_ENV === "production")
        throw new ServiceUnavailableException("Email delivery is not configured");
      return;
    }
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    const url = existingAccount
      ? `${webUrl}/signin`
      : `${webUrl}/signup?invite=${encodeURIComponent(token ?? "")}&email=${encodeURIComponent(email)}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "PinDash <auth@pindash.app>",
        to: [email],
        subject: "You have been invited to PinDash",
        html: `<p>You have been invited to a PinDash workspace.</p><p><a href="${url}">${existingAccount ? "Sign in to PinDash" : "Accept invitation and create your password"}</a></p><p>PinDash will never email you a password.</p>`,
      }),
    });
    if (!response.ok)
      throw new ServiceUnavailableException("Invitation email delivery failed");
  }

  async exportUserData(userId: string) {
    const user = await database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        legalAcceptedAt: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                defaultTimezone: true,
                createdAt: true,
                connections: {
                  select: {
                    id: true,
                    pinterestUserId: true,
                    displayName: true,
                    grantedScopes: true,
                    status: true,
                    createdAt: true,
                  },
                },
                mediaAssets: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    originalFilename: true,
                    mimeType: true,
                    byteSize: true,
                    width: true,
                    height: true,
                    status: true,
                    createdAt: true,
                  },
                },
                pinDrafts: {
                  select: {
                    id: true,
                    boardId: true,
                    title: true,
                    description: true,
                    altText: true,
                    destinationUrl: true,
                    status: true,
                    scheduledForUtc: true,
                    scheduleTimezone: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
                auditEvents: {
                  select: {
                    action: true,
                    entityType: true,
                    entityId: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "desc" },
                  take: 1000,
                },
              },
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      exportedAt: new Date().toISOString(),
      ...user,
      memberships: user.memberships.map((membership) => ({
        ...membership,
        workspace: {
          ...membership.workspace,
          mediaAssets: membership.workspace.mediaAssets.map((asset) => ({
            ...asset,
            byteSize: asset.byteSize.toString(),
          })),
        },
      })),
    };
  }

  async deleteAccount(userId: string, confirmation: string): Promise<void> {
    if (confirmation !== "DELETE MY ACCOUNT")
      throw new BadRequestException("Type DELETE MY ACCOUNT to confirm");
    const media = await database.mediaAsset.findMany({
      where: { workspace: { ownerUserId: userId } },
      select: { storageKey: true, thumbnailStorageKey: true },
    });
    const keys = [
      ...new Set(
        media.flatMap(({ storageKey, thumbnailStorageKey }) =>
          [storageKey, thumbnailStorageKey].filter((key): key is string =>
            Boolean(key),
          ),
        ),
      ),
    ];
    for (let index = 0; index < keys.length; index += 1000) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.mediaBucket,
          Delete: {
            Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
    }
    await database.$transaction(async (tx) => {
      await tx.workspace.deleteMany({ where: { ownerUserId: userId } });
      await tx.user.delete({ where: { id: userId } });
    });
  }
}
