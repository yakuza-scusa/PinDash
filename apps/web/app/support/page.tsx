import { BookOpen, LifeBuoy, Mail, Video } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

const resources = [
  {
    icon: BookOpen,
    title: "Getting started",
    text: "Connect Pinterest and publish your first Pin.",
  },
  {
    icon: Video,
    title: "Trial review checklist",
    text: "Prepare the OAuth and publishing demo recording.",
  },
  {
    icon: LifeBuoy,
    title: "Troubleshooting",
    text: "Resolve connection, upload, and publishing issues.",
  },
];

export default function SupportPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Help center"
        title="Help & support"
        description="Find guidance for setup, publishing, and Pinterest approval."
      />
      <div className="support-grid">
        {resources.map(({ icon: Icon, title, text }) => (
          <a className="panel resource-card" href="#contact" key={title}>
            <span>
              <Icon size={21} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </a>
        ))}
      </div>
      <section className="panel contact-card" id="contact">
        <div>
          <span className="security-icon">
            <Mail size={20} />
          </span>
          <h2>Still need help?</h2>
          <p>
            Send the team your question and include the affected Pin or
            connection.
          </p>
        </div>
        <a
          className="button button-secondary"
          href="mailto:support@pindash.app"
        >
          Contact support
        </a>
      </section>
    </AppShell>
  );
}
