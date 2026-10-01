"use client";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../../../components/app-shell";
import { DataSkeleton, ProblemState } from "../../../../components/data-state";
import { API_URL, type DataProblem } from "../../../../lib/pin-data";

type ReviewDraft = {
  id: string;
  version: number;
  title: string;
  description: string;
  altText: string | null;
  destinationUrl: string | null;
  boardId: string | null;
  scheduledForUtc: string | null;
  scheduleTimezone: string | null;
  connection: {
    displayName: string | null;
    pinterestUserId: string;
    status: string;
  } | null;
  mediaAsset: {
    originalFilename: string;
    width: number | null;
    height: number | null;
    status: string;
  } | null;
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<ReviewDraft | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [loading, setLoading] = useState(true),
    [approving, setApproving] = useState(false),
    [problem, setProblem] = useState<DataProblem | null>(null),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setProblem(null);
    try {
      const response = await fetch(
        `${API_URL}/pins/${encodeURIComponent(id)}/review`,
        { credentials: "include" },
      );
      if (response.status === 401) {
        setProblem("expired");
        return;
      }
      if (!response.ok) throw new Error();
      setDraft((await response.json()) as ReviewDraft);
    } catch {
      setProblem(navigator.onLine ? "error" : "offline");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    // Load the exact server-side draft version that will be approved.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function approve() {
    if (!draft || !confirmed) return;
    setApproving(true);
    setMessage("");
    const response = await fetch(
      `${API_URL}/pins/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, draftVersion: draft.version }),
      },
    );
    if (response.ok) {
      setMessage("Pin approved. It is now locked to this reviewed version.");
      setTimeout(() => router.push("/pins"), 900);
    } else {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setMessage(
        payload?.message ??
          "Approval failed. Review the latest draft and try again.",
      );
      setApproving(false);
    }
  }
  return (
    <AppShell>
      <div className="page-heading">
        <div>
          <a
            className="back-link"
            href={`/pins/new?draft=${encodeURIComponent(id)}`}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Back to editor
          </a>
          <span className="eyebrow">Final confirmation</span>
          <h1>Review Pin</h1>
          <p className="page-intro">
            Confirm the exact content and destination before PinDash creates an
            immutable approval.
          </p>
        </div>
      </div>
      {loading ? <DataSkeleton cards={3} /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => void load()}
          onSignIn={() => router.push("/connections")}
        />
      ) : null}
      {!loading && !problem && draft ? (
        <div className="review-layout">
          <section className="panel review-summary">
            <h2>Publishing details</h2>
            <dl>
              <div>
                <dt>Pinterest account</dt>
                <dd>
                  {draft.connection?.displayName ??
                    draft.connection?.pinterestUserId ??
                    "Not selected"}
                </dd>
              </div>
              <div>
                <dt>Board</dt>
                <dd>{draft.boardId ?? "Not selected"}</dd>
              </div>
              <div>
                <dt>Image</dt>
                <dd>
                  {draft.mediaAsset
                    ? `${draft.mediaAsset.originalFilename} · ${draft.mediaAsset.width} × ${draft.mediaAsset.height}`
                    : "Not selected"}
                </dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>{draft.title || "Not provided"}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{draft.description || "Not provided"}</dd>
              </div>
              <div>
                <dt>Alt text</dt>
                <dd>{draft.altText || "Not provided"}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{draft.destinationUrl || "No destination URL"}</dd>
              </div>
              <div>
                <dt>Publish time</dt>
                <dd>
                  {draft.scheduledForUtc
                    ? `${new Date(draft.scheduledForUtc).toLocaleString()} · ${draft.scheduleTimezone}`
                    : "After approval"}
                </dd>
              </div>
            </dl>
          </section>
          <aside className="panel approval-card">
            <ShieldCheck size={28} aria-hidden="true" />
            <h2>Approve version {draft.version}</h2>
            <p>
              Editing this Pin later will invalidate this approval and require
              another review.
            </p>
            <label className="confirmation-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I reviewed the account, board, image, text, link, and publish
                time.
              </span>
            </label>
            <button
              className="button button-primary"
              type="button"
              disabled={!confirmed || approving}
              onClick={() => void approve()}
            >
              <CheckCircle2 size={17} aria-hidden="true" />
              {approving ? "Approving…" : "Approve this Pin"}
            </button>
            {message ? (
              <p className="approval-message" role="status">
                {message}
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}
    </AppShell>
  );
}
