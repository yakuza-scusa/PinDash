import { LegalPage } from "../../components/public-shell";
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 2, 2026">
      <h2>Service</h2>
      <p>
        PinDash helps authorized users draft, review, schedule, and publish
        content to Pinterest. You must own or be authorized to use every
        connected account, image, link, and piece of content.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not use PinDash for unlawful, deceptive, infringing, abusive,
        automated-spam, or platform-policy-violating activity. You must comply
        with Pinterest’s terms and developer policies.
      </p>
      <h2>Your responsibilities</h2>
      <p>
        You are responsible for reviewing every Pin before approval, keeping
        account access secure, and ensuring published content and destination
        links are accurate and lawful.
      </p>
      <h2>Availability and changes</h2>
      <p>
        The service may be changed, suspended, or limited for maintenance,
        security, Pinterest API restrictions, or misuse. Preview and Trial
        functionality may change before general availability.
      </p>
      <h2>Disclaimers and liability</h2>
      <p>
        The service is provided as available. To the extent permitted by law,
        PinDash is not liable for indirect losses, Pinterest availability,
        rejected Pins, or actions taken from compromised accounts.
      </p>
      <h2>Termination</h2>
      <p>
        You may disconnect Pinterest or delete your account at any time. We may
        suspend access for security threats, misuse, or legal requirements.
      </p>
    </LegalPage>
  );
}
