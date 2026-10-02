"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/pin-data";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/passwordless/request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, legalAccepted: accepted }),
      });
      const result = (await response.json()) as {
        message?: string;
        previewUrl?: string;
      };
      if (!response.ok)
        throw new Error(result.message ?? "Sign-in request failed");
      setPreviewUrl(result.previewUrl ?? "");
      setMessage("Check your email for a secure sign-in link.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sign-in request failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">PinDash</p>
        <h1>Sign in securely</h1>
        <p>We will email you a single-use link. No password is stored.</p>
        <label>
          Work email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="checkbox-row">
          <input
            required
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>I accept the Terms of Service and Privacy Policy.</span>
        </label>
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
        {message ? <p role="status">{message}</p> : null}
        {previewUrl ? (
          <a href={previewUrl}>Open local development sign-in link</a>
        ) : null}
      </form>
    </main>
  );
}
