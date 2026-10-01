import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { readCookie, type AuthenticatedRequest } from "./auth.types";
import { SessionService } from "./session.service";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = process.env.SESSION_COOKIE_NAME ?? "pindash_session";
    const user = await this.sessions.resolve(readCookie(request, cookieName));
    if (!user) throw new UnauthorizedException("Authentication required");
    request.user = user;
    return true;
  }
}
