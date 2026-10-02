"use client";

import { Plus } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import {
  DataSkeleton,
  EmptyState,
  ProblemState,
} from "../../components/data-state";
import { PageHeader } from "../../components/page-header";
import { usePins } from "../../hooks/use-pins";
import { API_URL } from "../../lib/pin-data";

export default function CalendarPage() {
  const { pins, loading, problem, reload, signIn } = usePins();
  const scheduled = pins
    .filter((pin) => pin.scheduledForUtc && pin.status === "SCHEDULED")
    .sort((a, b) =>
      String(a.scheduledForUtc).localeCompare(String(b.scheduledForUtc)),
    );

  async function cancel(id: string, title: string) {
    if (
      !window.confirm(
        `Cancel the scheduled publication for “${title || "Untitled Pin"}”?`,
      )
    )
      return;
    const response = await fetch(
      `${API_URL}/pins/${encodeURIComponent(id)}/cancel-schedule`,
      { method: "POST", credentials: "include" },
    );
    if (!response.ok) window.alert("The schedule could not be cancelled.");
    await reload();
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Publishing"
        title="Calendar"
        description="Plan, review, and track every scheduled Pin."
        action={
          <a className="button button-primary" href="/pins/new">
            <Plus size={17} /> Schedule Pin
          </a>
        }
      />
      {loading ? <DataSkeleton /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => void reload()}
          onSignIn={() => void signIn()}
        />
      ) : null}
      {!loading && !problem && !scheduled.length ? (
        <EmptyState
          title="No scheduled Pins"
          description="Choose Schedule in the composer and approve the Pin to place it here."
          action={
            <a className="button button-primary" href="/pins/new">
              Schedule Pin
            </a>
          }
        />
      ) : null}
      {!loading && !problem && scheduled.length ? (
        <section className="panel data-list" aria-label="Scheduled Pins">
          {scheduled.map((pin) => (
            <article className="data-row" key={pin.id}>
              <span className="item-copy">
                <strong className="item-title">
                  {pin.title || "Untitled Pin"}
                </strong>
                <span className="item-meta">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: pin.scheduleTimezone ?? undefined,
                  }).format(new Date(pin.scheduledForUtc!))}
                  {pin.scheduleTimezone ? ` · ${pin.scheduleTimezone}` : ""}
                </span>
              </span>
              <a
                className="button button-secondary"
                href={`/pins/new?draft=${encodeURIComponent(pin.id)}`}
                onClick={(event) => {
                  if (
                    !window.confirm(
                      `Edit the schedule for “${pin.title || "Untitled Pin"}”? The Pin will require approval again.`,
                    )
                  )
                    event.preventDefault();
                }}
              >
                Reschedule
              </a>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void cancel(pin.id, pin.title)}
              >
                Cancel
              </button>
            </article>
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
