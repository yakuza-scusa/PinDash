import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConnectionStatus, database, PinStatus } from "@pindash/database";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { TokenCryptoService } from "./token-crypto.service";
import { NotificationsService } from "../notifications/notifications.service";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().positive().optional(),
  scope: z.string(),
});

const accountSchema = z
  .object({ username: z.string().min(1), account_type: z.string().optional() })
  .passthrough();

const refreshResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  refresh_token_expires_in: z.number().positive().optional(),
  scope: z.string().optional(),
});

@Injectable()
export class PinterestOAuthService {
  private readonly boardCache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();
  constructor(private readonly tokenCrypto: TokenCryptoService) {}

  private config() {
    const clientId = process.env.PINTEREST_CLIENT_ID;
    const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
    const redirectUri = process.env.PINTEREST_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException(
        "Pinterest OAuth credentials are not configured",
      );
    }
    return {
      clientId,
      clientSecret,
      redirectUri,
      apiBaseUrl:
        process.env.PINTEREST_API_BASE_URL ?? "https://api.pinterest.com/v5",
      oauthBaseUrl:
        process.env.PINTEREST_OAUTH_BASE_URL ??
        "https://www.pinterest.com/oauth/",
      scopes: (
        process.env.PINTEREST_SCOPES ?? "boards:read,pins:read,pins:write"
      )
        .split(/[ ,]+/)
        .filter(Boolean),
    };
  }

  private stateHash(state: string): string {
    return createHash("sha256").update(state).digest("hex");
  }

  async createAuthorizationUrl(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    const membership = await database.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException("Workspace access denied");

    const config = this.config();
    const state = randomBytes(32).toString("base64url");
    await database.oAuthTransaction.create({
      data: {
        workspaceId,
        createdByUserId: userId,
        stateHash: this.stateHash(state),
        redirectUri: config.redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL(config.oauthBaseUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  }

  async complete(code: string, state: string): Promise<void> {
    if (!code || !state)
      throw new BadRequestException("Missing OAuth code or state");
    const transaction = await database.oAuthTransaction.findUnique({
      where: { stateHash: this.stateHash(state) },
    });
    if (
      !transaction ||
      transaction.consumedAt ||
      transaction.expiresAt <= new Date()
    ) {
      throw new BadRequestException("OAuth transaction is invalid or expired");
    }
    const consumed = await database.oAuthTransaction.updateMany({
      where: { id: transaction.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new BadRequestException("OAuth transaction was already used");

    const config = this.config();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: transaction.redirectUri,
    });
    const tokenResponse = await fetch(`${config.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!tokenResponse.ok)
      throw new BadGatewayException(
        "Pinterest rejected the authorization code",
      );
    const tokens = tokenResponseSchema.parse(await tokenResponse.json());

    const accountResponse = await fetch(`${config.apiBaseUrl}/user_account`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!accountResponse.ok)
      throw new BadGatewayException("Pinterest account lookup failed");
    const account = accountSchema.parse(await accountResponse.json());
    const now = Date.now();

    await database.$transaction(async (tx) => {
      const connection = await tx.pinterestConnection.upsert({
        where: {
          workspaceId_pinterestUserId: {
            workspaceId: transaction.workspaceId,
            pinterestUserId: account.username,
          },
        },
        update: {
          displayName: account.username,
          encryptedAccessToken: this.tokenCrypto.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.tokenCrypto.encrypt(tokens.refresh_token)
            : null,
          accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
          refreshTokenExpiresAt: tokens.refresh_token_expires_in
            ? new Date(now + tokens.refresh_token_expires_in * 1000)
            : null,
          grantedScopes: tokens.scope.split(/[ ,]+/).filter(Boolean),
          status: "CONNECTED",
          lastRefreshedAt: new Date(),
        },
        create: {
          workspaceId: transaction.workspaceId,
          pinterestUserId: account.username,
          displayName: account.username,
          encryptedAccessToken: this.tokenCrypto.encrypt(tokens.access_token),
          encryptedRefreshToken: tokens.refresh_token
            ? this.tokenCrypto.encrypt(tokens.refresh_token)
            : null,
          accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
          refreshTokenExpiresAt: tokens.refresh_token_expires_in
            ? new Date(now + tokens.refresh_token_expires_in * 1000)
            : null,
          grantedScopes: tokens.scope.split(/[ ,]+/).filter(Boolean),
          status: "CONNECTED",
          lastRefreshedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: transaction.workspaceId,
          actorUserId: transaction.createdByUserId,
          action: "pinterest.connected",
          entityType: "PinterestConnection",
          entityId: connection.id,
        },
      });
    });
  }

  async listConnections(userId: string) {
    return database.pinterestConnection.findMany({
      where: { workspace: { members: { some: { userId } } } },
      select: {
        id: true,
        workspaceId: true,
        pinterestUserId: true,
        displayName: true,
        grantedScopes: true,
        status: true,
        accessTokenExpiresAt: true,
        refreshTokenExpiresAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async validAccessToken(connectionId: string): Promise<string> {
    const connection = await database.pinterestConnection.findUnique({
      where: { id: connectionId },
    });
    if (
      !connection ||
      connection.status === ConnectionStatus.DISCONNECTED ||
      connection.status === ConnectionStatus.REVOKED
    )
      throw new BadRequestException("Pinterest connection is not active");
    const refreshBefore = new Date(Date.now() + 5 * 60_000);
    if (
      connection.encryptedAccessToken &&
      connection.accessTokenExpiresAt > refreshBefore
    )
      return this.tokenCrypto.decrypt(
        Buffer.from(connection.encryptedAccessToken),
      );
    if (
      !connection.encryptedRefreshToken ||
      (connection.refreshTokenExpiresAt &&
        connection.refreshTokenExpiresAt <= new Date())
    )
      throw new BadRequestException(
        "Pinterest refresh credentials expired. Reconnect the account.",
      );

    const lock = await database.pinterestConnection.updateMany({
      where: {
        id: connection.id,
        status: ConnectionStatus.CONNECTED,
        updatedAt: connection.updatedAt,
      },
      data: { status: ConnectionStatus.EXPIRING },
    });
    if (lock.count !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const refreshed = await database.pinterestConnection.findUnique({
        where: { id: connection.id },
      });
      if (
        refreshed?.status === ConnectionStatus.CONNECTED &&
        refreshed.encryptedAccessToken &&
        refreshed.accessTokenExpiresAt > new Date()
      )
        return this.tokenCrypto.decrypt(
          Buffer.from(refreshed.encryptedAccessToken),
        );
      throw new ServiceUnavailableException(
        "Pinterest credentials are currently being refreshed. Retry shortly.",
      );
    }

    const config = this.config();
    const refreshToken = this.tokenCrypto.decrypt(
      Buffer.from(connection.encryptedRefreshToken),
    );
    const response = await fetch(`${config.apiBaseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) {
      await database.pinterestConnection.updateMany({
        where: { id: connection.id, status: ConnectionStatus.EXPIRING },
        data: { status: ConnectionStatus.REFRESH_FAILED },
      });
      await NotificationsService.notifyWorkspace({
        workspaceId: connection.workspaceId,
        type: "ACTION_REQUIRED",
        title: "Pinterest reconnection required",
        message:
          "PinDash could not refresh this Pinterest connection. Reconnect it to continue publishing.",
        entityType: "PinterestConnection",
        entityId: connection.id,
      });
      throw new BadGatewayException(
        "Pinterest credentials could not be refreshed. Reconnect the account.",
      );
    }
    const tokens = refreshResponseSchema.parse(await response.json());
    const now = Date.now();
    await database.pinterestConnection.update({
      where: { id: connection.id },
      data: {
        encryptedAccessToken: this.tokenCrypto.encrypt(tokens.access_token),
        encryptedRefreshToken: tokens.refresh_token
          ? this.tokenCrypto.encrypt(tokens.refresh_token)
          : connection.encryptedRefreshToken,
        accessTokenExpiresAt: new Date(now + tokens.expires_in * 1_000),
        refreshTokenExpiresAt: tokens.refresh_token_expires_in
          ? new Date(now + tokens.refresh_token_expires_in * 1_000)
          : connection.refreshTokenExpiresAt,
        ...(tokens.scope
          ? { grantedScopes: tokens.scope.split(/[ ,]+/).filter(Boolean) }
          : {}),
        status: ConnectionStatus.CONNECTED,
        lastRefreshedAt: new Date(now),
      },
    });
    return tokens.access_token;
  }

  async disconnect(userId: string, connectionId: string) {
    const connection = await database.pinterestConnection.findFirst({
      where: {
        id: connectionId,
        workspace: { members: { some: { userId } } },
      },
    });
    if (!connection)
      throw new ForbiddenException("Pinterest connection access denied");
    await database.$transaction(async (tx) => {
      await tx.pinterestConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          status: ConnectionStatus.DISCONNECTED,
        },
      });
      await tx.pinDraft.updateMany({
        where: {
          connectionId: connection.id,
          status: { notIn: [PinStatus.PUBLISHED, PinStatus.CANCELLED] },
        },
        data: { status: PinStatus.CONNECTION_REQUIRED },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: connection.workspaceId,
          actorUserId: userId,
          action: "pinterest.disconnected",
          entityType: "PinterestConnection",
          entityId: connection.id,
        },
      });
    });
    await NotificationsService.notifyWorkspace({
      workspaceId: connection.workspaceId,
      type: "CONNECTION_REVOKED",
      title: "Pinterest disconnected",
      message: "This Pinterest account is no longer available for publishing.",
      entityType: "PinterestConnection",
      entityId: connection.id,
    });
    return { disconnected: true };
  }

  async listBoards(userId: string, connectionId: string, bookmark?: string) {
    const connection = await database.pinterestConnection.findFirst({
      where: { id: connectionId, workspace: { members: { some: { userId } } } },
    });
    if (!connection)
      throw new ForbiddenException("Pinterest connection access denied");
    const accessToken = await this.validAccessToken(connection.id);
    const cacheKey = `${connection.id}:${bookmark ?? "first"}`;
    const cached = this.boardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const url = new URL(`${this.config().apiBaseUrl}/boards`);
    url.searchParams.set("page_size", "100");
    if (bookmark) url.searchParams.set("bookmark", bookmark);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Pinterest authorization expired. Reconnect the account.",
        403: "Pinterest denied board access. Verify the granted scopes.",
        429: "Pinterest is rate limiting board requests. Retry shortly.",
      };
      throw new HttpException(
        messages[response.status] ??
          "Pinterest boards are temporarily unavailable.",
        [401, 403, 429].includes(response.status) ? response.status : 502,
      );
    }
    const result = z
      .object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            privacy: z.string().optional(),
          }),
        ),
        bookmark: z.string().nullable().optional(),
      })
      .parse(await response.json());
    this.boardCache.set(cacheKey, {
      expiresAt: Date.now() + 60_000,
      value: result,
    });
    return result;
  }
}
