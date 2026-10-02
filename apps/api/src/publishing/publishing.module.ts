import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaModule } from "../media/media.module";
import { PinterestModule } from "../pinterest/pinterest.module";
import { PublishQueueService } from "./publish-queue.service";
import {
  InternalPublishingController,
  PublishingController,
} from "./publishing.controller";
import { PublishingService } from "./publishing.service";

@Module({
  imports: [AuthModule, MediaModule, PinterestModule],
  controllers: [PublishingController, InternalPublishingController],
  providers: [PublishingService, PublishQueueService],
})
export class PublishingModule {}
