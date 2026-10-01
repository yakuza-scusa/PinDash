import {
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PublishingService } from "./publishing.service";

@Controller("pins")
@UseGuards(SessionGuard)
export class PublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post(":id/publish")
  publishNow(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (!request.user) throw new UnauthorizedException();
    return this.publishing.publishNow(request.user.id, id);
  }
}
