import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { SessionGuard } from "../auth/session.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private userId(request: AuthenticatedRequest) {
    if (!request.user) throw new UnauthorizedException();
    return request.user.id;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.notifications.list(this.userId(request));
  }

  @Get("preferences")
  getPreferences(@Req() request: AuthenticatedRequest) {
    return this.notifications.getPreferences(this.userId(request));
  }

  @Patch(":id/read")
  markRead(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.markRead(this.userId(request), id);
  }

  @Patch("preferences")
  preferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: { inApp?: boolean; email?: boolean },
  ) {
    return this.notifications.preferences(
      this.userId(request),
      body.inApp !== false,
      body.email === true,
    );
  }
}
