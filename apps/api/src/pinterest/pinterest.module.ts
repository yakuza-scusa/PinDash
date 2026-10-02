import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PinterestController } from "./pinterest.controller";
import { PinterestOAuthService } from "./pinterest-oauth.service";
import { TokenCryptoService } from "./token-crypto.service";
import { PinterestApiClient } from "./pinterest-api.client";

@Module({
  imports: [AuthModule],
  controllers: [PinterestController],
  providers: [PinterestOAuthService, TokenCryptoService, PinterestApiClient],
  exports: [PinterestApiClient, TokenCryptoService, PinterestOAuthService],
})
export class PinterestModule {}
