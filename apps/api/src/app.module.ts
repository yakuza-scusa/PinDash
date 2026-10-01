import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { AuthModule } from "./auth/auth.module";
import { PinterestModule } from "./pinterest/pinterest.module";
import { PinsModule } from "./pins/pins.module";
import { MediaModule } from "./media/media.module";
import { PublishingModule } from "./publishing/publishing.module";

@Module({
  imports: [
    AuthModule,
    PinterestModule,
    PinsModule,
    MediaModule,
    PublishingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
