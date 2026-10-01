"use client";

import { CalendarDays, CheckCircle2, Clock3, Plus, Send } from "lucide-react";
import { AppShell } from "../components/app-shell";
import {
  DataSkeleton,
  EmptyState,
  ProblemState,
} from "../components/data-state";
import { usePins } from "../hooks/use-pins";
import { readableStatus, relativeDate } from "../lib/pin-data";

const metricStyle = [
  [Send, "#2767d8", "#eef4ff"],
  [CalendarDays, "#7a3fc1", "#f5efff"],
  [Clock3, "#a55c08", "#fff6df"],
  [CheckCircle2, "#157f5b", "#eaf8f2"],
] as const;

export default function DashboardPage() {
  const { pins, loading, problem, reload, signIn } = usePins();
  const published = pins.filter((pin) => pin.status === "PUBLISHED").length;
  const scheduled = pins.filter((pin) => pin.status === "SCHEDULED");
  const awaiting = pins.filter(
    (pin) => pin.status === "AWAITING_APPROVAL",
  ).length;
  const completed = pins.filter((pin) =>
    ["PUBLISHED", "FAILED"].includes(pin.status),
  );
  const metrics = [
    ["Published", String(published), "All recorded publications"],
    ["Scheduled", String(scheduled.length), "Ready in the publishing queue"],
    ["Awaiting approval", String(awaiting), "Ready for your review"],
    [
      "Publish success",
      completed.length
        ? `${Math.round((published / completed.length) * 100)}%`
        : "—",
      "Published versus failed Pins",
    ],
  ];
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Workspace overview</span>
          <h1>Publishing dashboard</h1>
          <p className="page-intro">Live status from your PinDash workspace.</p>
        </div>
        <a className="button button-primary" href="/pins/new">
          <Plus size={17} aria-hidden="true" />
          Create Pin
        </a>
      </div>
      {loading ? <DataSkeleton cards={4} /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => void reload()}
          onSignIn={() => void signIn()}
        />
      ) : null}
      {!loading && !problem ? (
        <>
          <section className="metrics-grid" aria-label="Publishing overview">
            {metrics.map(([label, value, detail], index) => {
              const [Icon, color, accent] = metricStyle[index]!;
              return (
                <article
                  className="metric-card"
                  key={label}
                  style={
                    {
                      "--metric-color": color,
                      "--metric-accent": accent,
                    } as React.CSSProperties
                  }
                >
                  <div className="metric-top">
                    <span>{label}</span>
                    <span className="metric-icon">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                  </div>
                  <strong className="metric-value">{value}</strong>
                  <span className="metric-detail">{detail}</span>
                </article>
              );
            })}
          </section>
          <div className="content-grid">
            <section className="panel" aria-labelledby="schedule-title">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title" id="schedule-title">
                    Upcoming schedule
                  </h2>
                  <p className="panel-subtitle">
                    Next Pins approved for publishing
                  </p>
                </div>
                <a className="text-link" href="/calendar">
                  View calendar
                </a>
              </div>
              {scheduled.length ? (
                <ol className="schedule-list">
                  {scheduled.slice(0, 5).map((pin) => {
                    const date = new Date(pin.scheduledForUtc ?? pin.updatedAt);
                    return (
                      <li className="schedule-item" key={pin.id}>
                        <span className="date-tile">
                          <strong>{date.getDate()}</strong>
                          <span>
                            {date.toLocaleDateString("en", { month: "short" })}
                          </span>
                        </span>
                        <span className="pin-thumb" aria-hidden="true" />
                        <span className="item-copy">
                          <strong className="item-title">
                            {pin.title || "Untitled Pin"}
                          </strong>
                          <span className="item-meta">
                            {pin.boardId ?? "Board not selected"} ·{" "}
                            {date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                        <span className="status-badge">Scheduled</span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState
                  title="Nothing scheduled"
                  description="Scheduled Pins will appear here as soon as they enter the queue."
                  action={
                    <a className="button button-secondary" href="/pins/new">
                      Create a Pin
                    </a>
                  }
                />
              )}
            </section>
            <aside
              className="panel activity-panel"
              aria-labelledby="activity-title"
            >
              <div className="panel-header">
                <div>
                  <h2 className="panel-title" id="activity-title">
                    Recent activity
                  </h2>
                  <p className="panel-subtitle">Latest workspace changes</p>
                </div>
              </div>
              {pins.length ? (
                <ul className="activity-list">
                  {pins.slice(0, 5).map((pin) => (
                    <li className="activity-item" key={pin.id}>
                      <span
                        className={`activity-icon ${pin.status === "DRAFT" ? "draft" : ""}`}
                      >
                        <Clock3 size={16} aria-hidden="true" />
                      </span>
                      <span className="item-copy">
                        <strong className="item-title">
                          {pin.title || "Untitled Pin"}
                        </strong>
                        <span className="item-meta">
                          {readableStatus(pin.status)}
                        </span>
                      </span>
                      <span className="activity-time">
                        {relativeDate(pin.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No activity yet"
                  description="Create your first Pin to start the workspace timeline."
                />
              )}
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
