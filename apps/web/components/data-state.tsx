import {
  AlertTriangle,
  FileQuestion,
  LogIn,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import type { DataProblem } from "../lib/pin-data";

export function DataSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="skeleton-grid" role="status" aria-label="Loading content">
      {Array.from({ length: cards }, (_, index) => (
        <div className="skeleton-card" key={index} aria-hidden="true">
          <span className="skeleton-line short" />
          <span className="skeleton-line strong" />
          <span className="skeleton-line" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="data-state" role="status">
      <span className="data-state-icon">
        <FileQuestion aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ProblemState({
  problem,
  onRetry,
  onSignIn,
}: {
  problem: DataProblem;
  onRetry: () => void;
  onSignIn: () => void;
}) {
  const expired = problem === "expired";
  const offline = problem === "offline";
  const Icon = expired ? LogIn : offline ? WifiOff : AlertTriangle;
  const title = expired
    ? "Your session has expired"
    : offline
      ? "You’re offline"
      : "We couldn’t load your Pins";
  const description = expired
    ? "Start a new local session to continue working in this development build."
    : offline
      ? "Check your connection. PinDash will retry automatically when you’re back online."
      : "The API may be unavailable. Try again in a moment.";
  return (
    <div className="data-state" role="alert">
      <span className="data-state-icon">
        <Icon aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button
        className="button button-primary"
        type="button"
        onClick={expired ? onSignIn : onRetry}
      >
        {expired ? (
          <LogIn size={17} aria-hidden="true" />
        ) : (
          <RefreshCw size={17} aria-hidden="true" />
        )}
        {expired ? "Start local session" : "Try again"}
      </button>
    </div>
  );
}
