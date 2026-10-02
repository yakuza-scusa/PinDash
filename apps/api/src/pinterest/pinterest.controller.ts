import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { SessionGuard } from "../auth/session.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PinterestOAuthService } from "./pinterest-oauth.service";

@Controller("pinterest")
export class PinterestController {
  constructor(private readonly oauth: PinterestOAuthService) {}

  @Get("connections")
  @UseGuards(SessionGuard)
  list(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException();
    return this.oauth.listConnections(request.user.id);
  }

  @Get("connections/:id/boards")
  @UseGuards(SessionGuard)
  boards(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (!request.user) throw new UnauthorizedException();
    return this.oauth.listBoards(request.user.id, id);
  }

  @Delete("connections/:id")
  @UseGuards(SessionGuard)
  disconnect(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (!request.user) throw new UnauthorizedException();
    return this.oauth.disconnect(request.user.id, id);
  }

  @Get("oauth/start")
  @UseGuards(SessionGuard)
  async start(
    @Req() request: AuthenticatedRequest,
    @Query("workspaceId") workspaceId: string,
  ) {
    if (!request.user) throw new UnauthorizedException();
    return {
      authorizationUrl: await this.oauth.createAuthorizationUrl(
        request.user.id,
        workspaceId,
      ),
    };
  }

  @Get("oauth/callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
    if (error) return reply.redirect(`${webUrl}/connections?status=denied`);
    await this.oauth.complete(code, state);
    return reply.redirect(`${webUrl}/connections?status=connected`);
  }
}
