import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PublishQueueService } from "./publish-queue.service";
import { PublishingController } from "./publishing.controller";
import { PublishingService } from "./publishing.service";

@Module({
  imports: [AuthModule],
  controllers: [PublishingController],
  providers: [PublishingService, PublishQueueService],
})
export class PublishingModule {}
