import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
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
}
