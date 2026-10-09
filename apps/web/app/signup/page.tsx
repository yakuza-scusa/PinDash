"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL } from "../../lib/pin-data";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Read the browser-only invitation parameters after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteToken(params.get("invite") ?? "");
    setEmail(params.get("email") ?? "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          legalAccepted: accepted,
          inviteToken: inviteToken || undefined,
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(result.message ?? "Account creation failed");
      setComplete(true);
      setMessage(
        "Check your email and open the verification link within 15 minutes.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Account creation failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">PinDash</p>
        <h1>
          {inviteToken ? "Accept your invitation" : "Create your account"}
        </h1>
        <p>
          Already registered? <Link href="/signin">Sign in</Link>.
        </p>
        <label>
          Work email
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            disabled={complete}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={complete}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small>
            Use at least 12 characters. A password manager is recommended.
          </small>
        </label>
        <label>
          Confirm password
          <input
            required
            minLength={12}
            maxLength={128}
            type="password"
            autoComplete="new-password"
            value={confirmation}
            disabled={complete}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <label className="checkbox-row">
          <input
            required
            type="checkbox"
            checked={accepted}
            disabled={complete}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            I accept the <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>
        <button
          className="button button-primary"
          disabled={busy || complete}
          type="submit"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
        {message ? <p role={complete ? "status" : "alert"}>{message}</p> : null}
      </form>
    </main>
  );
}
