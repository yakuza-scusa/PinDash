"use client";

import { useEffect } from "react";
import { AppShell } from "../components/app-shell";
import { ProblemState } from "../components/data-state";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PinDash route error", error.digest ?? error.name);
  }, [error]);
  return (
    <AppShell>
      <ProblemState problem="error" onRetry={reset} onSignIn={reset} />
    </AppShell>
  );
}
