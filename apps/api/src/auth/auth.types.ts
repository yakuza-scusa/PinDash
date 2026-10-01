export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}

export interface AuthenticatedRequest {
  headers: { cookie?: string };
  user?: AuthenticatedUser;
}

export function readCookie(
  request: AuthenticatedRequest,
  name: string,
): string | undefined {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name)
      return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return undefined;
}
