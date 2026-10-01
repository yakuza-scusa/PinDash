import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
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

  @Delete("session")
  async deleteSession(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    await this.sessions.revoke(readCookie(request, cookieName));
    reply.header(
      "Set-Cookie",
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    return { authenticated: false };
  }
}
