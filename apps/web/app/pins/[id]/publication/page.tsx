"use client";

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { DataSkeleton } from "../../../../components/data-state";
import { API_URL, readableStatus } from "../../../../lib/pin-data";

type PublicationStatus = {
  id: string;
  title: string;
  status: string;
  publication: {
    id: string;
    status: string;
    attemptCount: number;
    lastErrorMessage: string | null;
    updatedAt: string;
  } | null;
  publishedPin: {
    pinterestPinId: string;
    pinterestUrl: string | null;
    publishedAt: string;
  } | null;
};

const terminal = new Set([
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN_RESULT",
]);

export default function PublicationPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PublicationStatus | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_URL}/pins/${encodeURIComponent(id)}/publication`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      setData((await response.json()) as PublicationStatus);
      setError("");
    } catch {
      setError("Publication status is temporarily unavailable.");
    }
  }, [id]);

  useEffect(() => {
    // Initial synchronization with the external publication API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(() => {
      if (!data?.publication || !terminal.has(data.publication.status))
        void load();
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [data?.publication, load]);

  const status = data?.publication?.status;
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Pinterest publishing</span>
          <h1>{data?.title || "Publishing Pin"}</h1>
          <p className="page-intro">
            Live progress for the approved immutable Pin.
          </p>
        </div>
      </div>
      {!data && !error ? <DataSkeleton cards={2} /> : null}
      {error ? (
        <div className="notice error-notice" role="alert">
          <AlertCircle size={18} /> <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}
      {data ? (
        <section className="panel approval-card" aria-live="polite">
          {status === "SUCCEEDED" ? (
            <CheckCircle2 size={32} aria-hidden="true" />
          ) : status === "FAILED" ? (
            <AlertCircle size={32} aria-hidden="true" />
          ) : (
            <LoaderCircle size={32} aria-hidden="true" />
          )}
          <h2>{status ? readableStatus(status) : "Preparing publication"}</h2>
          <p>
            {status === "SUCCEEDED"
              ? "Pinterest confirmed that the Pin was created."
              : status === "FAILED"
                ? (data.publication?.lastErrorMessage ??
                  "Pinterest could not publish this Pin.")
                : "PinDash is securely publishing and confirming your Pin."}
          </p>
          {data.publication ? (
            <p>Attempt {data.publication.attemptCount || 1}</p>
          ) : null}
          {data.publishedPin?.pinterestUrl ? (
            <a
              className="button button-primary"
              href={data.publishedPin.pinterestUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on Pinterest
            </a>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
