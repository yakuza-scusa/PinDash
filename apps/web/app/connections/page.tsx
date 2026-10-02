"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { DataSkeleton } from "../../components/data-state";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
interface Workspace {
  id: string;
  name: string;
  role: string;
}
interface Session {
  authenticated: true;
  user: { displayName: string | null; workspaces: Workspace[] };
}
interface Connection {
  id: string;
  displayName: string | null;
  pinterestUserId: string;
  status: string;
  grantedScopes: string[];
}

export default function ConnectionsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionResponse = await fetch(`${API_URL}/auth/session`, {
        credentials: "include",
      });
      if (sessionResponse.status === 401) {
        setSession(null);
        setConnections([]);
        return;
      }
      if (!sessionResponse.ok) throw new Error("The API is unavailable.");
      setSession((await sessionResponse.json()) as Session);
      const connectionResponse = await fetch(
        `${API_URL}/pinterest/connections`,
        { credentials: "include" },
      );
      if (!connectionResponse.ok)
        throw new Error("Could not load Pinterest connections.");
      setConnections((await connectionResponse.json()) as Connection[]);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Start the PinDash API to manage connections."
          : cause instanceof Error
            ? cause.message
            : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial synchronization with the external session API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const oauthStatus = new URLSearchParams(window.location.search).get(
      "status",
    );
    if (oauthStatus === "denied")
      setError(
        "Pinterest authorization was denied. No credentials were stored.",
      );
    if (oauthStatus === "invalid")
      setError(
        "The Pinterest authorization link was invalid, expired, or already used.",
      );
  }, [load]);

  async function createDemoSession() {
    setLoading(true);
    const response = await fetch(`${API_URL}/auth/development-session`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Could not create the local demo session.");
      setLoading(false);
      return;
    }
    await load();
  }

  async function connectPinterest() {
    const workspaceId = session?.user.workspaces[0]?.id;
    if (!workspaceId) {
      setError("No workspace is available for this account.");
      return;
    }
    setLoading(true);
    const response = await fetch(
      `${API_URL}/pinterest/oauth/start?workspaceId=${encodeURIComponent(workspaceId)}`,
      { credentials: "include" },
    );
    if (!response.ok) {
      setError(
        "Pinterest OAuth is not configured. Add your app credentials to .env.",
      );
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { authorizationUrl: string };
    window.location.assign(payload.authorizationUrl);
  }

  async function disconnectPinterest(connection: Connection) {
    if (
      !window.confirm(
        `Disconnect @${connection.displayName ?? connection.pinterestUserId}? Scheduled and draft Pins using this account will require reconnection.`,
      )
    )
      return;
    setLoading(true);
    const response = await fetch(
      `${API_URL}/pinterest/connections/${encodeURIComponent(connection.id)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!response.ok) {
      setError("Pinterest could not be disconnected. Please retry.");
      setLoading(false);
      return;
    }
    await load();
  }

  return (
    <AppShell>
      <div className="page-heading connections-heading">
        <div>
          <span className="eyebrow">Workspace settings</span>
          <h1>Connections</h1>
          <p className="page-intro">
            Connect Pinterest securely and control which permissions PinDash can
            use.
          </p>
        </div>
        {session ? (
          <button
            className="button button-primary"
            type="button"
            onClick={() => void connectPinterest()}
            disabled={loading}
          >
            <ExternalLink size={17} /> Connect Pinterest
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="notice error-notice" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {!session && !loading ? (
        <section className="panel empty-connection">
          <span className="connection-hero-icon">
            <LockKeyhole size={27} />
          </span>
          <h2>Start your secure local session</h2>
          <p>
            This development-only step creates the owner and workspace used for
            your Trial-access recording. It is automatically disabled in
            production.
          </p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void createDemoSession()}
          >
            Start local demo
          </button>
        </section>
      ) : null}
      {session ? (
        <div className="connections-grid">
          <section
            className="panel connection-list-panel"
            aria-labelledby="accounts-title"
          >
            <div className="panel-header">
              <div>
                <h2 className="panel-title" id="accounts-title">
                  Pinterest accounts
                </h2>
                <p className="panel-subtitle">
                  Authorized accounts available to this workspace
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Refresh connections"
                onClick={() => void load()}
              >
                <RefreshCw size={17} />
              </button>
            </div>
            {connections.length ? (
              <ul className="connection-list">
                {connections.map((connection) => (
                  <li className="connection-row" key={connection.id}>
                    <span className="pinterest-logo">P</span>
                    <span className="item-copy">
                      <strong className="item-title">
                        @{connection.displayName ?? connection.pinterestUserId}
                      </strong>
                      <span className="item-meta">
                        {connection.grantedScopes.join(" · ")}
                      </span>
                    </span>
                    <span
                      className={`connected-badge ${connection.status.toLowerCase()}`}
                    >
                      {connection.status === "CONNECTED" ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}{" "}
                      {connection.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                    {connection.status !== "DISCONNECTED" ? (
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void disconnectPinterest(connection)}
                        aria-label={`Disconnect ${connection.displayName ?? connection.pinterestUserId}`}
                      >
                        <Unplug size={15} /> Disconnect
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="inline-empty">
                <span className="pinterest-logo">P</span>
                <div>
                  <strong>No Pinterest account connected</strong>
                  <p>Use Connect Pinterest to authorize your Trial app.</p>
                </div>
              </div>
            )}
          </section>
          <aside className="panel security-card">
            <span className="security-icon">
              <ShieldCheck size={22} />
            </span>
            <h2>Secure by design</h2>
            <ul>
              <li>One-time, 10-minute OAuth state</li>
              <li>Tokens encrypted with AES-256-GCM</li>
              <li>HttpOnly session cookie</li>
              <li>Credentials never reach the browser</li>
            </ul>
            <p>Requested access: read boards and Pins, and create Pins.</p>
          </aside>
        </div>
      ) : null}
      {loading ? <DataSkeleton cards={2} /> : null}
    </AppShell>
  );
}
