"use client";

import { Bell, Globe2, Save, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

type SettingsSection = "general" | "members" | "notifications";

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Globe2;
}> = [
  { id: "general", label: "General", icon: Globe2 },
  { id: "members", label: "Members", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function sectionFromHash(): SettingsSection {
  const hash = window.location.hash.slice(1);
  return sections.some((section) => section.id === hash)
    ? (hash as SettingsSection)
    : "general";
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");

  useEffect(() => {
    const syncHash = () => setActiveSection(sectionFromHash());
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage workspace defaults, members, and notifications."
        action={
          <button className="button button-primary" type="button">
            <Save size={17} aria-hidden="true" /> Save changes
          </button>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <a
                className={active ? "active" : undefined}
                href={`#${section.id}`}
                aria-current={active ? "page" : undefined}
                key={section.id}
              >
                <Icon size={17} aria-hidden="true" /> {section.label}
              </a>
            );
          })}
        </nav>
        {activeSection === "general" ? <GeneralSettings /> : null}
        {activeSection === "members" ? <MemberSettings /> : null}
        {activeSection === "notifications" ? <NotificationSettings /> : null}
      </div>
    </AppShell>
  );
}

function GeneralSettings() {
  return (
    <section className="panel settings-form" id="general" tabIndex={-1}>
      <SettingsHeading
        title="Workspace details"
        description="Used for schedules and team activity."
      />
      <label>
        Workspace name
        <input defaultValue="Atelier Studio" />
      </label>
      <label>
        Workspace slug
        <input defaultValue="atelier-studio" />
      </label>
      <label>
        Default timezone
        <select defaultValue="Europe/Paris">
          <option>Europe/Paris</option>
          <option>UTC</option>
          <option>America/New_York</option>
        </select>
      </label>
    </section>
  );
}

function MemberSettings() {
  return (
    <section className="panel settings-form" id="members" tabIndex={-1}>
      <SettingsHeading
        title="Workspace members"
        description="People who can access this PinDash workspace."
      />
      <div className="settings-member">
        <span className="avatar">AM</span>
        <span>
          <strong>Alex Morgan</strong>
          <small>Owner</small>
        </span>
        <span className="status-pill">Active</span>
      </div>
    </section>
  );
}

function NotificationSettings() {
  return (
    <section className="panel settings-form" id="notifications" tabIndex={-1}>
      <SettingsHeading
        title="Notification preferences"
        description="Choose which publishing events require your attention."
      />
      <NotificationToggle
        title="Publishing failures"
        description="Notify me when a Pin cannot be published."
        enabled
      />
      <NotificationToggle
        title="Connection warnings"
        description="Notify me when Pinterest access needs attention."
        enabled
      />
      <NotificationToggle
        title="Successful publications"
        description="Notify me whenever a Pin is published."
      />
    </section>
  );
}

function SettingsHeading({
  title,
  description,
}: Readonly<{ title: string; description: string }>) {
  return (
    <div className="panel-header">
      <div>
        <h2 className="panel-title">{title}</h2>
        <p className="panel-subtitle">{description}</p>
      </div>
    </div>
  );
}

function NotificationToggle({
  title,
  description,
  enabled = false,
}: Readonly<{ title: string; description: string; enabled?: boolean }>) {
  return (
    <label className="settings-toggle">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input type="checkbox" defaultChecked={enabled} />
    </label>
  );
}
