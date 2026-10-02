import Link from "next/link";
import { CalendarCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { PublicShell } from "../../components/public-shell";

export default function ProductPage() {
  return (
    <PublicShell>
      <section className="public-hero">
        <div>
          <p className="eyebrow">Professional Pinterest publishing</p>
          <h1>Plan, approve and publish Pins with confidence.</h1>
          <p>
            PinDash gives teams a secure review workflow, reliable scheduling,
            publication history and direct Pinterest integration.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/signin">
              Start securely
            </Link>
            <Link className="button button-secondary" href="/contact">
              Contact support
            </Link>
          </div>
        </div>
        <div className="hero-proof">
          <ShieldCheck size={38} />
          <strong>Built for controlled publishing</strong>
          <span>
            Encrypted connections, explicit approval and auditable actions.
          </span>
        </div>
      </section>
      <section className="public-features" aria-label="Product features">
        <article>
          <CalendarCheck />
          <h2>Schedule clearly</h2>
          <p>
            Prepare content with timezone-aware scheduling and a shared
            calendar.
          </p>
        </article>
        <article>
          <CheckCircle2 />
          <h2>Approve explicitly</h2>
          <p>
            Review the exact immutable Pin snapshot before anything is
            published.
          </p>
        </article>
        <article>
          <ShieldCheck />
          <h2>Connect safely</h2>
          <p>
            OAuth tokens stay encrypted on the server and can be revoked at any
            time.
          </p>
        </article>
      </section>
    </PublicShell>
  );
}
