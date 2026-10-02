import {
  Controller,
  Get,
  Headers,
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

  @Get(":id/publication")
  status(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    if (!request.user) throw new UnauthorizedException();
    return this.publishing.status(request.user.id, id);
  }
}

@Controller("internal/publications")
export class InternalPublishingController {
  constructor(private readonly publishing: PublishingService) {}

  @Post(":id/execute")
  execute(
    @Param("id") id: string,
    @Headers("x-execution-token") executionToken: string | undefined,
  ) {
    return this.publishing.execute(id, executionToken ?? "");
  }
}
