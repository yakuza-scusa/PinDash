"use client";

import { Copy, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "../../components/app-shell";
import {
  DataSkeleton,
  EmptyState,
  ProblemState,
} from "../../components/data-state";
import { PageHeader } from "../../components/page-header";
import { usePins } from "../../hooks/use-pins";
import { API_URL, readableStatus, relativeDate } from "../../lib/pin-data";

export default function PinsPage() {
  const { pins, loading, problem, reload, signIn } = usePins();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () =>
      pins.filter((pin) =>
        `${pin.title} ${pin.description} ${pin.boardId ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [pins, query],
  );
  async function duplicate(id: string) {
    const response = await fetch(
      `${API_URL}/pins/${encodeURIComponent(id)}/duplicate`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    if (!response.ok) window.alert("The Pin could not be duplicated.");
    await reload();
  }
  async function remove(id: string, title: string) {
    if (!window.confirm(`Permanently delete “${title || "Untitled Pin"}”?`))
      return;
    const response = await fetch(`${API_URL}/pins/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) window.alert("The Pin could not be deleted.");
    await reload();
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Content"
        title="Pins"
        description="Manage all published, scheduled, and draft Pins."
        action={
          <a className="button button-primary" href="/pins/new">
            <Plus size={17} aria-hidden="true" /> Create Pin
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
      {!loading && !problem ? (
        <section className="panel" aria-labelledby="pins-list-title">
          <h2 className="sr-only" id="pins-list-title">
            All Pins
          </h2>
          <div className="list-toolbar">
            <label className="compact-search">
              <span className="sr-only">Search Pins</span>
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search Pins"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <span className="result-count" aria-live="polite">
              {results.length} {results.length === 1 ? "Pin" : "Pins"}
            </span>
          </div>
          {results.length ? (
            <div className="data-list">
              {results.map((pin, index) => (
                <article className="data-row" key={pin.id}>
                  <span
                    className={`pin-thumb ${index % 3 === 1 ? "coral" : index % 3 === 2 ? "gold" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="item-copy">
                    <strong className="item-title">
                      {pin.title || "Untitled Pin"}
                    </strong>
                    <span className="item-meta">
                      {pin.boardId ?? "Board not selected"}
                    </span>
                  </span>
                  <span className={`status-pill ${pin.status.toLowerCase()}`}>
                    {readableStatus(pin.status)}
                  </span>
                  <span className="row-date">
                    Updated {relativeDate(pin.updatedAt)}
                  </span>
                  <span className="row-actions">
                    {pin.publishedPin?.pinterestUrl ? (
                      <a
                        className="row-menu"
                        href={pin.publishedPin.pinterestUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View published Pin on Pinterest"
                      >
                        <ExternalLink size={17} aria-hidden="true" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="row-menu"
                      onClick={() => void duplicate(pin.id)}
                      aria-label={`Duplicate ${pin.title || "untitled Pin"}`}
                    >
                      <Copy size={17} aria-hidden="true" />
                    </button>
                    {pin.status !== "PUBLISHED" ? (
                      <button
                        type="button"
                        className="row-menu"
                        onClick={() => void remove(pin.id, pin.title)}
                        aria-label={`Delete ${pin.title || "untitled Pin"}`}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    ) : null}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={query ? "No matching Pins" : "No Pins yet"}
              description={
                query
                  ? "Try a different title, description, or board."
                  : "Create your first Pin to begin planning content."
              }
              action={
                !query ? (
                  <a className="button button-primary" href="/pins/new">
                    Create Pin
                  </a>
                ) : undefined
              }
            />
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
