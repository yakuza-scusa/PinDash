import { LegalPage } from "../../components/public-shell";
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2, 2026">
      <h2>Information we process</h2>
      <p>
        PinDash processes account identity, workspace membership, Pinterest
        account identifiers and OAuth credentials, board identifiers, Pin
        drafts, media, schedules, publication results, notifications, and
        security audit events.
      </p>
      <h2>How we use information</h2>
      <p>
        We use this information only to authenticate users, operate requested
        Pinterest publishing workflows, protect the service, provide support,
        and meet legal obligations. We do not sell personal information.
      </p>
      <h2>Pinterest data</h2>
      <p>
        Pinterest access tokens are encrypted and never exposed to the browser.
        PinDash requests only the scopes needed to read boards and Pins and
        create Pins. You can disconnect Pinterest from the Connections page at
        any time.
      </p>
      <h2>Retention</h2>
      <p>
        OAuth attempts expire after 10 minutes, sign-in links after 15 minutes,
        sessions after 30 days, operational logs after 30 days, audit history
        after 12 months, and backups after 30 days. Deleted accounts are removed
        from active systems promptly and age out of backups within 30 days.
      </p>
      <h2>Your choices</h2>
      <p>
        You may export your data or delete your account from Data controls.
        Contact privacy@pindash.app for access, correction, deletion, or
        portability questions.
      </p>
      <h2>Processors and security</h2>
      <p>
        Infrastructure, object storage, email delivery, error monitoring, and
        Pinterest may process limited data to provide their services. PinDash
        uses encryption in transit, restricted access, private object storage,
        redacted logs, and security monitoring.
      </p>
    </LegalPage>
  );
}
