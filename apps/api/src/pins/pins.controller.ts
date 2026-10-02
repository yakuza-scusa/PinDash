import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApprovePinSchema,
  SavePinDraftSchema,
  UpdatePinDraftSchema,
} from "@pindash/contracts";
import { ZodError } from "zod";
import { SessionGuard } from "../auth/session.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PinsService } from "./pins.service";

@Controller("pins")
@UseGuards(SessionGuard)
export class PinsController {
  constructor(private readonly pins: PinsService) {}

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) throw new UnauthorizedException();
    return request.user.id;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.pins.list(this.userId(request));
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.pins.get(this.userId(request), id);
  }

  @Get(":id/review")
  review(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.pins.review(this.userId(request), id);
  }

  @Post(":id/approve")
  approve(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    try {
      return this.pins.approve(
        this.userId(request),
        id,
        ApprovePinSchema.parse(body),
      );
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          message: "Explicit confirmation is required",
          issues: error.issues,
        });
      throw error;
    }
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    try {
      return this.pins.create(
        this.userId(request),
        SavePinDraftSchema.parse(body),
      );
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          message: "Invalid Pin draft",
          issues: error.issues,
        });
      throw error;
    }
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    try {
      return this.pins.update(
        this.userId(request),
        id,
        UpdatePinDraftSchema.parse(body),
      );
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          message: "Invalid Pin draft",
          issues: error.issues,
        });
      throw error;
    }
  }

  @Post(":id/duplicate")
  duplicate(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.pins.duplicate(this.userId(request), id);
  }

  @Post(":id/cancel-schedule")
  cancelSchedule(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.pins.cancelSchedule(this.userId(request), id);
  }

  @Delete(":id")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.pins.remove(this.userId(request), id);
  }
}
