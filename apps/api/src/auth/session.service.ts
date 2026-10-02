import {
  BadRequestException,
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
