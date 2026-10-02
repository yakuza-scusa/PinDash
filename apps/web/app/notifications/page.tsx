"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import {
  EmptyState,
  DataSkeleton,
  ProblemState,
} from "../../components/data-state";
import { PageHeader } from "../../components/page-header";
import { API_URL, type DataProblem } from "../../lib/pin-data";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<DataProblem | null>(null);
  const [email, setEmail] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [response, preferencesResponse] = await Promise.all([
        fetch(`${API_URL}/notifications`, { credentials: "include" }),
        fetch(`${API_URL}/notifications/preferences`, {
          credentials: "include",
        }),
      ]);
      if (response.status === 401 || preferencesResponse.status === 401)
        return setProblem("expired");
      if (!response.ok || !preferencesResponse.ok) throw new Error();
      const preferences = (await preferencesResponse.json()) as {
        notifyByEmail: boolean;
      };
      setItems((await response.json()) as Notification[]);
      setEmail(preferences.notifyByEmail);
      setProblem(null);
    } catch {
      setProblem(navigator.onLine ? "error" : "offline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Synchronize with the authenticated API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function read(id: string) {
    await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  }

  async function updateEmail(value: boolean) {
    setEmail(value);
    await fetch(`${API_URL}/notifications/preferences`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inApp: true, email: value }),
    });
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Publishing results and actions that need your attention."
      />
      <label className="checkbox-row notification-preference">
        <input
          type="checkbox"
          checked={email}
          onChange={(event) => void updateEmail(event.target.checked)}
        />
        <span>Email me when a publication fails (optional)</span>
      </label>
      {loading ? <DataSkeleton cards={3} /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => void load()}
          onSignIn={() => router.push("/signin")}
        />
      ) : null}
      {!loading && !problem && !items.length ? (
        <EmptyState
          title="You are all caught up"
          description="Publishing and connection updates will appear here."
        />
      ) : null}
      {!loading && !problem && items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <article
              className={`notification-item ${item.readAt ? "" : "unread"}`}
              key={item.id}
            >
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>
              {!item.readAt ? (
                <button
                  className="icon-button"
                  aria-label={`Mark ${item.title} as read`}
                  onClick={() => void read(item.id)}
                >
                  <Check size={16} />
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
