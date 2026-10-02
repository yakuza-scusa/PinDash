import { Controller, Get } from "@nestjs/common";
import { HealthResponseSchema, type HealthResponse } from "@pindash/contracts";
import { database } from "@pindash/database";

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return HealthResponseSchema.parse({ status: "ok", service: "api" });
  }

  @Get("ready")
  async getReadiness(): Promise<HealthResponse> {
    await database.$queryRaw`SELECT 1`;
    return HealthResponseSchema.parse({ status: "ok", service: "api-ready" });
  }
}
