import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { correlationId, safeRequestPath } from "./observability";
import { csrfAllowed, RequestRateLimiter } from "./request-security";

async function bootstrap(): Promise<void> {
  const trustedProxies = (process.env.TRUST_PROXY ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: trustedProxies.length > 0 ? trustedProxies : false,
    }),
  );

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });

  const server = app.getHttpAdapter().getInstance();
  const mutationLimiter = new RequestRateLimiter();
  server.addHook(
    "onRequest",
    (
      request: {
        headers: Record<string, unknown>;
        correlationId?: string;
        startedAt?: number;
        method: string;
        url: string;
        ip: string;
      },
      reply: {
        header(name: string, value: string): void;
        code(status: number): { send(body: unknown): void };
      },
      done: () => void,
    ) => {
      request.correlationId = correlationId(
        request.headers["x-correlation-id"],
      );
      request.startedAt = Date.now();
      reply.header("x-correlation-id", request.correlationId);
      const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
      if (
        !csrfAllowed({
          method: request.method,
          url: request.url,
          origin: request.headers.origin as string | undefined,
          cookie: request.headers.cookie as string | undefined,
          webUrl,
          cookieName: process.env.SESSION_COOKIE_NAME,
        })
      ) {
        reply.code(403).send({ message: "Cross-origin mutation rejected" });
        return;
      }
      if (
        ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
        !mutationLimiter.allow(request.ip)
      ) {
        reply.code(429).send({ message: "Too many requests" });
        return;
      }
      done();
    },
  );
  server.addHook(
    "onResponse",
    (
      request: {
        method: string;
        url: string;
        correlationId?: string;
        startedAt?: number;
      },
      reply: { statusCode: number },
      done: () => void,
    ) => {
      console.info(
        JSON.stringify({
          level: "info",
          service: "api",
          event: "request_completed",
          correlationId: request.correlationId,
          method: request.method,
          path: safeRequestPath(request.url),
          statusCode: reply.statusCode,
          durationMs: Date.now() - (request.startedAt ?? Date.now()),
        }),
      );
      done();
    },
  );

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
