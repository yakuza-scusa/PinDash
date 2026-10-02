import Link from "next/link";
import type { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <header className="public-header">
        <Link className="public-brand" href="/product">
          PinDash
        </Link>
        <nav aria-label="Public navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Support</Link>
          <Link className="button button-primary" href="/signin">
            Sign in
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="public-footer">
        <span>© 2026 PinDash</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </footer>
    </div>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <article className="legal-page">
        <p className="eyebrow">Legal & compliance</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
      </article>
    </PublicShell>
  );
}
