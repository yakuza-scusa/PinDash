"use client";
import { ArrowLeft, Check, ImagePlus, Save, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { DataSkeleton, ProblemState } from "../../../components/data-state";
import type { DataProblem } from "../../../lib/pin-data";
import { uploadMedia } from "../../../lib/media";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Connection = {
  id: string;
  displayName: string | null;
  pinterestUserId: string;
};
type Board = { id: string; name: string; privacy?: string };
type Session = { user: { workspaces: Array<{ id: string }> } };
type Draft = {
  id: string;
  connectionId: string | null;
  mediaAssetId: string | null;
  boardId: string | null;
  title: string;
  description: string;
  altText: string | null;
  destinationUrl: string | null;
  scheduledForUtc: string | null;
  scheduleTimezone: string | null;
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function NewPinPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null),
    [connections, setConnections] = useState<Connection[]>([]),
    [boards, setBoards] = useState<Board[]>([]);
  const [boardSearch, setBoardSearch] = useState(""),
    [boardBookmark, setBoardBookmark] = useState<string | null>(null),
    [loadingBoards, setLoadingBoards] = useState(false);
  const [connectionId, setConnectionId] = useState(""),
    [boardId, setBoardId] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [altText, setAltText] = useState(""),
    [destinationUrl, setDestinationUrl] = useState("");
  const [timing, setTiming] = useState<"now" | "scheduled">("now"),
    [scheduledLocal, setScheduledLocal] = useState("");
  const [minimumSchedule] = useState(() =>
    toLocalDateTime(new Date(Date.now() + 60_000).toISOString()),
  );
  const [status, setStatus] = useState(
      "Connect Pinterest before saving a draft.",
    ),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true),
    [problem, setProblem] = useState<DataProblem | null>(null),
    [draftId, setDraftId] = useState<string | null>(null),
    [mediaAssetId, setMediaAssetId] = useState<string | null>(null),
    [previewUrl, setPreviewUrl] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => {
    async function load() {
      try {
        const sr = await fetch(`${API_URL}/auth/session`, {
          credentials: "include",
        });
        if (sr.status === 401) {
          setProblem("expired");
          return;
        }
        if (!sr.ok) throw new Error();
        setSession((await sr.json()) as Session);
        const cr = await fetch(`${API_URL}/pinterest/connections`, {
          credentials: "include",
        });
        if (!cr.ok) throw new Error();
        const items = (await cr.json()) as Connection[];
        setConnections(items);
        const requestedDraft = new URLSearchParams(window.location.search).get(
          "draft",
        );
        if (requestedDraft) {
          const draftResponse = await fetch(
            `${API_URL}/pins/${encodeURIComponent(requestedDraft)}`,
            { credentials: "include" },
          );
          if (draftResponse.status === 404) {
            setStatus("This draft no longer exists.");
          } else if (!draftResponse.ok) {
            throw new Error();
          } else {
            const draft = (await draftResponse.json()) as Draft;
            setDraftId(draft.id);
            setConnectionId(draft.connectionId ?? "");
            setMediaAssetId(draft.mediaAssetId);
            setBoardId(draft.boardId ?? "");
            setTitle(draft.title);
            setDescription(draft.description);
            setAltText(draft.altText ?? "");
            setDestinationUrl(draft.destinationUrl ?? "");
            if (draft.scheduledForUtc) {
              setTiming("scheduled");
              setScheduledLocal(toLocalDateTime(draft.scheduledForUtc));
            }
            setStatus("Draft loaded. Changes save automatically.");
          }
        } else {
          setStatus(
            items.length
              ? "Ready to compose. Changes save automatically."
              : "Connect Pinterest before saving a draft.",
          );
        }
      } catch {
        setProblem(navigator.onLine ? "error" : "offline");
        setStatus("Start the PinDash API to save drafts.");
      } finally {
        hydrated.current = true;
        setLoading(false);
      }
    }
    void load();
  }, []);
  async function selectConnection(id: string, bookmark?: string) {
    if (!bookmark) {
      setConnectionId(id);
      setBoardId("");
      setBoards([]);
      setBoardBookmark(null);
    }
    if (!id) return;
    setLoadingBoards(true);
    const response = await fetch(
      `${API_URL}/pinterest/connections/${id}/boards${bookmark ? `?bookmark=${encodeURIComponent(bookmark)}` : ""}`,
      { credentials: "include" },
    );
    if (!response.ok) {
      setStatus("Boards could not be loaded. Reconnect Pinterest and retry.");
      setLoadingBoards(false);
      return null;
    }
    const payload = (await response.json()) as {
      items: Board[];
      bookmark?: string | null;
    };
    setBoards((current) =>
      bookmark ? [...current, ...payload.items] : payload.items,
    );
    setBoardBookmark(payload.bookmark ?? null);
    setLoadingBoards(false);
    setStatus("Boards loaded from Pinterest.");
  }
  async function saveDraft() {
    const workspaceId = session?.user.workspaces[0]?.id;
    if (!workspaceId) {
      setStatus("Open Connections and start a local session first.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        draftId ? `${API_URL}/pins/${draftId}` : `${API_URL}/pins`,
        {
          method: draftId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(draftId ? {} : { workspaceId }),
            connectionId: connectionId || null,
            mediaAssetId,
            boardId: boardId || null,
            title,
            description,
            altText: altText || null,
            destinationUrl: destinationUrl || null,
            scheduledForUtc:
              timing === "scheduled" && scheduledLocal
                ? new Date(scheduledLocal).toISOString()
                : null,
            scheduleTimezone:
              timing === "scheduled"
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : null,
          }),
        },
      );
      if (!response.ok) throw new Error();
      const saved = (await response.json()) as { id: string };
      if (!draftId) {
        setDraftId(saved.id);
        window.history.replaceState(
          null,
          "",
          `/pins/new?draft=${encodeURIComponent(saved.id)}`,
        );
      }
      setStatus("Draft saved securely.");
      return saved.id;
    } catch {
      setStatus("Draft could not be saved. Check the API and form values.");
      return null;
    } finally {
      setSaving(false);
    }
  }
  async function reviewDraft() {
    const savedId = await saveDraft();
    if (savedId) router.push(`/pins/${encodeURIComponent(savedId)}/review`);
  }
  useEffect(() => {
    if (!hydrated.current || !session) return;
    const timer = window.setTimeout(async () => {
      const workspaceId = session.user.workspaces[0]?.id;
      if (!workspaceId) return;
      setSaving(true);
      setStatus("Saving changes…");
      try {
        const response = await fetch(
          draftId ? `${API_URL}/pins/${draftId}` : `${API_URL}/pins`,
          {
            method: draftId ? "PATCH" : "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(draftId ? {} : { workspaceId }),
              connectionId: connectionId || null,
              mediaAssetId,
              boardId: boardId || null,
              title,
              description,
              altText: altText || null,
              destinationUrl: destinationUrl || null,
              scheduledForUtc:
                timing === "scheduled" && scheduledLocal
                  ? new Date(scheduledLocal).toISOString()
                  : null,
              scheduleTimezone:
                timing === "scheduled"
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : null,
            }),
          },
        );
        if (!response.ok) throw new Error();
        const saved = (await response.json()) as { id: string };
        if (!draftId) {
          setDraftId(saved.id);
          window.history.replaceState(
            null,
            "",
            `/pins/new?draft=${encodeURIComponent(saved.id)}`,
          );
        }
        setStatus("All changes saved.");
      } catch {
        setStatus("Autosave failed. Use Save draft to retry.");
      } finally {
        setSaving(false);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    altText,
    boardId,
    connectionId,
    description,
    destinationUrl,
    draftId,
    mediaAssetId,
    session,
    title,
    timing,
    scheduledLocal,
  ]);
  async function startSession() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/development-session`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      window.location.reload();
    } catch {
      setProblem("error");
      setLoading(false);
    }
  }
  async function chooseMedia(file: File | undefined) {
    const workspaceId = session?.user.workspaces[0]?.id;
    if (!file || !workspaceId) return;
    setUploading(true);
    setStatus("Uploading and validating image…");
    try {
      const asset = await uploadMedia(file, workspaceId);
      setMediaAssetId(asset.id);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
      setStatus("Image validated and attached. Saving draft…");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Image upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <AppShell>
      <div className="editor-heading">
        <a className="back-link" href="/pins">
          <ArrowLeft size={17} /> Back to Pins
        </a>
        <div>
          <h1>Create a Pin</h1>
          <p>Complete the content, destination, and publishing details.</p>
        </div>
        <div className="editor-actions">
          <button
            className="button button-secondary"
            onClick={() => void saveDraft()}
            disabled={saving}
          >
            <Save size={16} /> {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={saving || uploading}
            onClick={() => void reviewDraft()}
          >
            <Send size={16} /> Review Pin
          </button>
        </div>
      </div>
      {loading ? <DataSkeleton cards={2} /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => window.location.reload()}
          onSignIn={() => void startSession()}
        />
      ) : null}
      {!loading && !problem ? (
        <>
          <div className="composer-status" role="status">
            {status}
          </div>
          <div className="pin-editor-grid">
            <section className="panel editor-form">
              <div className="form-section">
                <span className="step-number">1</span>
                <div>
                  <h2>Pin content</h2>
                  <p>Add the image and text people will see on Pinterest.</p>
                </div>
              </div>
              <label className="editor-upload file-button">
                <ImagePlus size={26} />
                <strong>
                  {uploading
                    ? "Validating image…"
                    : mediaAssetId
                      ? "Replace image"
                      : "Upload Pin image"}
                </strong>
                <span>JPG, PNG, or WebP · up to 10 MB</span>
                <input
                  aria-label="Choose Pin image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) =>
                    void chooseMedia(event.target.files?.[0])
                  }
                />
              </label>
              <label>
                Title <span>{title.length} / 100</span>
                <input
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a clear, compelling title"
                />
              </label>
              <label>
                Description <span>{description.length} / 800</span>
                <textarea
                  value={description}
                  maxLength={800}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Tell people what this Pin is about"
                />
              </label>
              <label>
                Alt text <span>Accessibility</span>
                <input
                  value={altText}
                  maxLength={500}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image"
                />
              </label>
            </section>
            <section className="panel editor-form">
              <div className="form-section">
                <span className="step-number">2</span>
                <div>
                  <h2>Destination & publishing</h2>
                  <p>Choose the Pinterest account and live board.</p>
                </div>
              </div>
              <label>
                Pinterest account
                <select
                  value={connectionId}
                  onChange={(e) => void selectConnection(e.target.value)}
                >
                  <option value="">Select an account</option>
                  {connections.map((item) => (
                    <option value={item.id} key={item.id}>
                      @{item.displayName ?? item.pinterestUserId}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pinterest board
                <input
                  type="search"
                  value={boardSearch}
                  onChange={(event) => setBoardSearch(event.target.value)}
                  placeholder="Search loaded boards"
                  disabled={!connectionId}
                />
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  disabled={!connectionId}
                >
                  <option value="">Select a board</option>
                  {boards
                    .filter((board) =>
                      board.name
                        .toLowerCase()
                        .includes(boardSearch.toLowerCase()),
                    )
                    .map((board) => (
                      <option value={board.id} key={board.id}>
                        {board.name}
                        {board.privacy
                          ? ` · ${board.privacy.toLowerCase()}`
                          : ""}
                      </option>
                    ))}
                </select>
              </label>
              {boardBookmark ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={loadingBoards}
                  onClick={() =>
                    void selectConnection(connectionId, boardBookmark)
                  }
                >
                  {loadingBoards ? "Loading…" : "Load more boards"}
                </button>
              ) : null}
              <label>
                Destination URL
                <input
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  type="url"
                  placeholder="https://example.com/article"
                />
              </label>
              <fieldset>
                <legend>Publish timing</legend>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="timing"
                    checked={timing === "now"}
                    onChange={() => setTiming("now")}
                  />
                  <span>
                    <b>Publish now</b>
                    <small>Send after approval</small>
                  </span>
                  <Check size={16} />
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    name="timing"
                    checked={timing === "scheduled"}
                    onChange={() => setTiming("scheduled")}
                  />
                  <span>
                    <b>Schedule</b>
                    <small>Publish in your local timezone</small>
                  </span>
                </label>
                {timing === "scheduled" ? (
                  <label>
                    Publication date and time
                    <input
                      type="datetime-local"
                      value={scheduledLocal}
                      min={minimumSchedule}
                      onChange={(event) =>
                        setScheduledLocal(event.target.value)
                      }
                      required
                    />
                    <small>
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </small>
                  </label>
                ) : null}
              </fieldset>
            </section>
            <aside className="panel pin-preview">
              <span>Preview</span>
              <div className="preview-image">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={altText || "Selected Pin preview"}
                    fill
                    unoptimized
                  />
                ) : mediaAssetId ? (
                  <span>Image attached</span>
                ) : (
                  <ImagePlus size={30} />
                )}
              </div>
              <h2>{title || "Your Pin title"}</h2>
              <p>
                {description ||
                  "Your description will appear here as you write."}
              </p>
              <small>Atelier Studio</small>
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
