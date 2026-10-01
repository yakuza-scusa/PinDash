import { AppShell } from "../components/app-shell";
import { DataSkeleton } from "../components/data-state";

export default function Loading() {
  return (
    <AppShell>
      <div className="page-heading skeleton-heading" aria-hidden="true">
        <div>
          <span className="skeleton-line short" />
          <span className="skeleton-line title" />
        </div>
      </div>
      <DataSkeleton cards={4} />
    </AppShell>
  );
}
