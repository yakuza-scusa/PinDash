import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PinterestController } from "./pinterest.controller";
import { PinterestOAuthService } from "./pinterest-oauth.service";
import { TokenCryptoService } from "./token-crypto.service";

@Module({
  imports: [AuthModule],
  controllers: [PinterestController],
  providers: [PinterestOAuthService, TokenCryptoService],
})
export class PinterestModule {}
