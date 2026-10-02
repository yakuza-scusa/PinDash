import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Query,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { CreateUploadIntentSchema } from "@pindash/contracts";
import { ZodError } from "zod";
import { SessionGuard } from "../auth/session.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { MediaService } from "./media.service";

@Controller("media")
@UseGuards(SessionGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) throw new UnauthorizedException();
    return request.user.id;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.media.list(this.userId(request));
  }

  @Post("upload-intents")
  createIntent(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    try {
      return this.media.createUploadIntent(
        this.userId(request),
        CreateUploadIntentSchema.parse(body),
      );
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          message: "Invalid upload",
          issues: error.issues,
        });
      throw error;
    }
  }

  @Post(":id/complete")
  complete(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.media.completeUpload(this.userId(request), id);
  }

  @Get(":id/preview")
  async preview(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Res() reply: FastifyReply,
  ) {
    const preview = await this.media.preview(this.userId(request), id);
    reply.header("Content-Type", preview.mimeType);
    reply.header("Cache-Control", "private, max-age=300");
    return reply.send(preview.body);
  }

  @Delete(":id")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.media.remove(this.userId(request), id);
  }
}

@Controller("media/retrieve")
export class PublicMediaController {
  constructor(private readonly media: MediaService) {}

  @Get(":id")
  async retrieve(
    @Param("id") id: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Res() reply: FastifyReply,
  ) {
    const media = await this.media.retrieveForPinterest(
      id,
      expires ?? "",
      signature ?? "",
    );
    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "private, max-age=60, no-transform");
    return reply.send(media.body);
  }
}
