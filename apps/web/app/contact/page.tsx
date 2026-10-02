import Link from "next/link";
import { PublicShell } from "../../components/public-shell";
export default function ContactPage() {
  return (
    <PublicShell>
      <section className="legal-page">
        <p className="eyebrow">Support</p>
        <h1>How can we help?</h1>
        <p>
          For product support, privacy requests, security reports, or account
          questions, email{" "}
          <a href="mailto:support@pindash.app">support@pindash.app</a>.
        </p>
        <h2>Pinterest disconnection</h2>
        <ol>
          <li>
            Open <Link href="/connections">Connections</Link> while signed in.
          </li>
          <li>Select the connected Pinterest account.</li>
          <li>
            Choose <strong>Disconnect</strong> and confirm.
          </li>
          <li>
            PinDash removes stored access and refresh credentials and stops
            pending publications that require the connection.
          </li>
        </ol>
        <p>
          You can also remove PinDash from Pinterest account settings. If you do
          that first, disconnect the account in PinDash to clear its local
          credentials.
        </p>
        <h2>Response targets</h2>
        <p>
          General support: two business days. Security and privacy requests: one
          business day acknowledgment.
        </p>
      </section>
    </PublicShell>
  );
}
