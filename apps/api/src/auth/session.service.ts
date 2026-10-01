import { Injectable, UnauthorizedException } from "@nestjs/common";
import { database, MembershipRole } from "@pindash/database";
import { createHash, randomBytes } from "node:crypto";
import type { AuthenticatedUser } from "./auth.types";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  private readonly ttlDays = Number(process.env.SESSION_TTL_DAYS ?? 30);

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

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await database.session.deleteMany({
      where: { tokenHash: this.hashToken(token) },
    });
  }
}
