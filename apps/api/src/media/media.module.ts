import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MediaController, PublicMediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [AuthModule],
  controllers: [MediaController, PublicMediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
