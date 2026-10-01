"use client";

import { Clock3, FilePenLine, Plus } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import {
  DataSkeleton,
  EmptyState,
  ProblemState,
} from "../../components/data-state";
import { PageHeader } from "../../components/page-header";
import { usePins } from "../../hooks/use-pins";
import { relativeDate } from "../../lib/pin-data";

export default function DraftsPage() {
  const { pins, loading, problem, reload, signIn } = usePins();
  const drafts = pins.filter((pin) => pin.status === "DRAFT");
  return (
    <AppShell>
      <PageHeader
        eyebrow="Content"
        title="Drafts"
        description="Continue unfinished Pins and send them for approval."
        action={
          <a className="button button-primary" href="/pins/new">
            <Plus size={17} aria-hidden="true" /> New draft
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
      {!loading && !problem && !drafts.length ? (
        <EmptyState
          title="No unfinished drafts"
          description="Your draft workspace is clear. Start a new Pin whenever you’re ready."
          action={
            <a className="button button-primary" href="/pins/new">
              New draft
            </a>
          }
        />
      ) : null}
      {!loading && !problem && drafts.length ? (
        <div className="draft-grid">
          {drafts.map((draft, index) => (
            <article className="panel draft-card" key={draft.id}>
              <span
                className={`draft-preview tone-${index % 3}`}
                aria-hidden="true"
              >
                <FilePenLine size={25} />
              </span>
              <div>
                <span className="draft-label">
                  <Clock3 size={14} aria-hidden="true" /> Edited{" "}
                  {relativeDate(draft.updatedAt)}
                </span>
                <h2>{draft.title || "Untitled draft"}</h2>
                <p>{draft.boardId ?? "Board not selected"}</p>
              </div>
              <a
                className="button button-secondary"
                href={`/pins/new?draft=${encodeURIComponent(draft.id)}`}
                aria-label={`Continue editing ${draft.title || "untitled draft"}`}
              >
                Continue editing
              </a>
            </article>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
