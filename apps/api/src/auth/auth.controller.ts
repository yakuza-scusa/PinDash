import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { FastifyRequest } from "fastify";
import { readCookie, type AuthenticatedRequest } from "./auth.types";
import { SessionGuard } from "./session.guard";
import { SessionService } from "./session.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Post("development-session")
  async createDevelopmentSession(
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const session = await this.sessions.createDevelopmentSession();
    const name = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    reply.header(
      "Set-Cookie",
      `${name}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${session.expiresAt.toUTCString()}${secure}`,
    );
    return { authenticated: true };
  }

  @Get("session")
  @UseGuards(SessionGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException();
    return { authenticated: true, user: request.user };
  }

  @Post("register")
  register(
    @Req() request: FastifyRequest,
    @Body()
    body: { email?: unknown; password?: unknown; legalAccepted?: unknown },
  ) {
    if (typeof body?.email !== "string" || typeof body?.password !== "string")
      throw new BadRequestException("Email and password are required");
    return this.sessions.registerWithPassword(
      body.email,
      body.password,
      body.legalAccepted === true,
      request.ip,
    );
  }

  @Post("login")
  async login(
    @Req() request: FastifyRequest,
    @Body() body: { email?: unknown; password?: unknown },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (typeof body?.email !== "string" || typeof body?.password !== "string")
      throw new BadRequestException("Email and password are required");
    const session = await this.sessions.loginWithPassword(
      body.email,
      body.password,
      request.ip,
    );
    this.setSessionCookie(reply, session);
    return { authenticated: true };
  }

  @Get("passwordless/callback")
  async passwordlessCallback(
    @Query("token") token: string,
    @Res() reply: FastifyReply,
  ) {
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    try {
      const session = await this.sessions.consumePasswordlessToken(token ?? "");
      this.setSessionCookie(reply, session);
      return reply.redirect(`${webUrl}/?status=verified`);
    } catch {
      return reply.redirect(`${webUrl}/signin?error=invalid-link`);
    }
  }

  @Delete("session")
  async deleteSession(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    await this.sessions.revoke(readCookie(request, cookieName));
    reply.header("Set-Cookie", this.clearSessionCookie(cookieName));
    return { authenticated: false };
  }

  @Get("data-export")
  @UseGuards(SessionGuard)
  async exportData(
    @Req() request: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    if (!request.user) throw new UnauthorizedException();
    const data = await this.sessions.exportUserData(request.user.id);
    reply.header(
      "Content-Disposition",
      `attachment; filename="pindash-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    reply.header("Content-Type", "application/json; charset=utf-8");
    return reply.send(data);
  }

  @Delete("account")
  @UseGuards(SessionGuard)
  async deleteAccount(
    @Req() request: AuthenticatedRequest,
    @Body() body: { confirmation?: unknown },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!request.user) throw new UnauthorizedException();
    await this.sessions.deleteAccount(
      request.user.id,
      typeof body?.confirmation === "string" ? body.confirmation : "",
    );
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    reply.header("Set-Cookie", this.clearSessionCookie(cookieName));
    return { deleted: true };
  }

  private setSessionCookie(
    reply: FastifyReply,
    session: { token: string; expiresAt: Date },
  ): void {
    const name = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    reply.header("Set-Cookie", [
      `${name}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${session.expiresAt.toUTCString()}${secure}`,
      `${name}_present=1; Path=/; HttpOnly; SameSite=Lax; Expires=${session.expiresAt.toUTCString()}${secure}${this.sessionCookieDomain()}`,
    ]);
  }

  private clearSessionCookie(name: string): string[] {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return [
      `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `${name}_present=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}${this.sessionCookieDomain()}`,
    ];
  }

  private sessionCookieDomain(): string {
    const domain = process.env.SESSION_COOKIE_DOMAIN?.trim();
    if (!domain) return "";
    if (!/^\.?[a-z0-9.-]+$/i.test(domain)) {
      throw new Error("SESSION_COOKIE_DOMAIN is invalid");
    }
    return `; Domain=${domain}`;
  }
}
