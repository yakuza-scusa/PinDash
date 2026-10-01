"use client";
import { Image as ImageIcon, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import {
  DataSkeleton,
  EmptyState,
  ProblemState,
} from "../../components/data-state";
import { PageHeader } from "../../components/page-header";
import { uploadMedia, type MediaAsset } from "../../lib/media";
import { API_URL, type DataProblem } from "../../lib/pin-data";

export default function MediaPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<MediaAsset[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [loading, setLoading] = useState(true),
    [uploading, setUploading] = useState(false),
    [problem, setProblem] = useState<DataProblem | null>(null),
    [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    setProblem(null);
    try {
      const sessionResponse = await fetch(`${API_URL}/auth/session`, {
        credentials: "include",
      });
      if (sessionResponse.status === 401) {
        setProblem("expired");
        return;
      }
      if (!sessionResponse.ok) throw new Error();
      const session = (await sessionResponse.json()) as {
        user: { workspaces: Array<{ id: string }> };
      };
      setWorkspaceId(session.user.workspaces[0]?.id ?? "");
      const response = await fetch(`${API_URL}/media`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      setAssets((await response.json()) as MediaAsset[]);
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
  async function chooseFile(file: File | undefined) {
    if (!file || !workspaceId) return;
    setUploading(true);
    setMessage("Uploading and validating image…");
    try {
      const asset = await uploadMedia(file, workspaceId);
      setAssets((current) => [asset, ...current]);
      setMessage("Image uploaded and validated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  const picker = (
    <label className="button button-primary file-button">
      <Upload size={17} aria-hidden="true" />
      {uploading ? "Uploading…" : "Upload media"}
      <input
        aria-label="Choose image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
    </label>
  );
  return (
    <AppShell>
      <PageHeader
        eyebrow="Assets"
        title="Media library"
        description="Upload and reuse validated images for your Pins."
        action={picker}
      />
      {message ? (
        <div className="composer-status" role="status">
          {message}
        </div>
      ) : null}
      {loading ? <DataSkeleton cards={4} /> : null}
      {!loading && problem ? (
        <ProblemState
          problem={problem}
          onRetry={() => void load()}
          onSignIn={() => router.push("/connections")}
        />
      ) : null}
      {!loading && !problem ? (
        <>
          {assets.length ? (
            <div className="media-grid">
              {assets.map((asset) => (
                <article className="media-card" key={asset.id}>
                  <div className="media-placeholder">
                    <ImageIcon size={28} aria-hidden="true" />
                  </div>
                  <strong>{asset.originalFilename}</strong>
                  <span>
                    {asset.width ?? "—"} × {asset.height ?? "—"} ·{" "}
                    {(Number(asset.byteSize) / 1_048_576).toFixed(1)} MB
                  </span>
                  <span className={`status-pill ${asset.status.toLowerCase()}`}>
                    {asset.status.toLowerCase()}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No media uploaded"
              description="Upload a JPG, PNG, or WebP to use it in a Pin."
              action={picker}
            />
          )}
        </>
      ) : null}
    </AppShell>
  );
}
