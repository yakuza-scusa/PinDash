"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_URL } from "../../lib/pin-data";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as {
        message?: string;
      };
      if (!response.ok) throw new Error(result.message ?? "Sign-in failed");
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") ? next : "/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={(event) => void submit(event)}>
        <p className="eyebrow">PinDash</p>
        <h1>Sign in securely</h1>
        <p>
          Use your verified PinDash account. New here?{" "}
          <Link href="/signup">Create an account</Link>.
        </p>
        <label>
          Work email
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {message ? (
          <p role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
        {searchParams.get("error") === "invalid-link" ? (
          <p className="form-error" role="alert">
            That verification link is invalid, expired, or already used.
          </p>
        ) : null}
      </form>
    </main>
  );
}
