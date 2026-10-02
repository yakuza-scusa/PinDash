"use client";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { API_URL } from "../../lib/pin-data";

export default function DataControlsPage() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  async function removeAccount() {
    const response = await fetch(`${API_URL}/auth/account`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "Account deletion failed.");
      return;
    }
    router.push("/product");
  }
  return (
    <AppShell>
      <PageHeader
        eyebrow="Privacy"
        title="Data controls"
        description="Export your information or permanently remove your account and owned workspaces."
      />
      <div className="settings-layout data-controls">
        <section className="panel settings-form">
          <h2>Export your data</h2>
          <p>
            Download a JSON copy of your profile, workspaces, connection
            metadata, media metadata, drafts and audit history. Secrets and
            tokens are excluded.
          </p>
          <a
            className="button button-secondary"
            href={`${API_URL}/auth/data-export`}
          >
            <Download size={16} /> Download export
          </a>
        </section>
        <section className="panel settings-form danger-zone">
          <h2>Delete account and workspaces</h2>
          <p>
            This permanently removes your account and every workspace you own,
            including drafts, media records, connections and publication
            history. Stored Pinterest credentials are deleted.
          </p>
          <label>
            Type <strong>DELETE MY ACCOUNT</strong> to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button
            className="button button-danger"
            disabled={confirmation !== "DELETE MY ACCOUNT"}
            onClick={() => void removeAccount()}
          >
            <Trash2 size={16} /> Delete permanently
          </button>
          {message ? <p role="alert">{message}</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
