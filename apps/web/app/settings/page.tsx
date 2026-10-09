"use client";

import { Bell, Globe2, Mail, Plus, Save, Users, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";
import { API_URL } from "../../lib/pin-data";

type SettingsSection = "general" | "members" | "notifications";
type Member = {
  userId: string;
  email: string;
  displayName: string | null;
  role: string;
};
type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};
type Session = { user: { workspaces: Array<{ id: string }> } };
type Preferences = { notifyInApp: boolean; notifyByEmail: boolean };

const sections = [
  { id: "general" as const, label: "General", icon: Globe2 },
  { id: "members" as const, label: "Members", icon: Users },
  { id: "notifications" as const, label: "Notifications", icon: Bell },
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
            <Save size={17} /> Save changes
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
                <Icon size={17} /> {section.label}
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
  const [workspaceId, setWorkspaceId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const sessionResponse = await fetch(`${API_URL}/auth/session`, {
      credentials: "include",
    });
    if (!sessionResponse.ok) return;
    const session = (await sessionResponse.json()) as Session;
    const id = session.user.workspaces[0]?.id;
    if (!id) return;
    setWorkspaceId(id);
    const response = await fetch(`${API_URL}/auth/workspaces/${id}/members`, {
      credentials: "include",
    });
    if (!response.ok) return;
    const data = (await response.json()) as {
      members: Member[];
      invitations: Invitation[];
    };
    setMembers(data.members);
    setInvitations(data.invitations);
  }

  useEffect(() => {
    // Load the current server-backed workspace membership after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch(
      `${API_URL}/auth/workspaces/${workspaceId}/invitations`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok) {
      setMessage(result.message ?? "Could not send the invitation.");
      setBusy(false);
      return;
    }
    setOpen(false);
    setEmail("");
    setMessage(
      "Invitation sent securely. The member will choose their own password.",
    );
    setBusy(false);
    await load();
  }

  return (
    <section className="panel settings-form" id="members" tabIndex={-1}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Workspace members</h2>
          <p className="panel-subtitle">
            Invite people without sharing or emailing passwords.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setOpen(true)}
        >
          <Plus size={16} /> Add new member
        </button>
      </div>
      {message ? (
        <p className="settings-message" role="status">
          {message}
        </p>
      ) : null}
      {members.map((member) => (
        <div className="settings-member" key={member.userId}>
          <span className="avatar">
            {(member.displayName ?? member.email).slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong>{member.displayName ?? member.email}</strong>
            <small>{member.email}</small>
          </span>
          <span className="status-pill">{member.role.toLowerCase()}</span>
        </div>
      ))}
      {invitations.map((invitation) => (
        <div className="settings-member pending" key={invitation.id}>
          <span className="avatar">
            <Mail size={16} />
          </span>
          <span>
            <strong>{invitation.email}</strong>
            <small>
              Invitation expires{" "}
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </small>
          </span>
          <span className="status-pill">Pending</span>
        </div>
      ))}
      {open ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <form
            className="panel invite-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            onSubmit={(event) => void invite(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              type="button"
              aria-label="Close invitation"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
            <p className="eyebrow">Team access</p>
            <h2 id="invite-title">Add a new member</h2>
            <p>
              We’ll send a one-time invitation. The member creates their own
              private password.
            </p>
            <label>
              Email address
              <input
                required
                type="email"
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="EDITOR">Editor</option>
                <option value="APPROVER">Approver</option>
              </select>
            </label>
            <button
              className="button button-primary"
              disabled={busy || !workspaceId}
              type="submit"
            >
              {busy ? "Sending…" : "Send secure invitation"}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function NotificationSettings() {
  const [preferences, setPreferences] = useState<Preferences>({
    notifyInApp: true,
    notifyByEmail: false,
  });
  const [saved, setSaved] = useState("");
  useEffect(() => {
    void fetch(`${API_URL}/notifications/preferences`, {
      credentials: "include",
    }).then(async (response) => {
      if (response.ok) setPreferences((await response.json()) as Preferences);
    });
  }, []);
  async function update(next: Preferences) {
    setPreferences(next);
    const response = await fetch(`${API_URL}/notifications/preferences`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inApp: next.notifyInApp,
        email: next.notifyByEmail,
      }),
    });
    setSaved(response.ok ? "Preferences saved" : "Could not save preferences");
  }
  return (
    <section
      className="panel settings-form notification-settings"
      id="notifications"
      tabIndex={-1}
    >
      <SettingsHeading
        title="Notification preferences"
        description="Choose where important publishing updates should reach you."
      />
      <NotificationToggle
        icon={<Bell size={20} />}
        title="In-app activity"
        description="Publishing results, connection warnings and actions appear in your notification center."
        enabled={preferences.notifyInApp}
        onChange={(enabled) =>
          void update({ ...preferences, notifyInApp: enabled })
        }
      />
      <NotificationToggle
        icon={<Mail size={20} />}
        title="Email alerts"
        description="Receive high-priority account and publishing alerts by email."
        enabled={preferences.notifyByEmail}
        onChange={(enabled) =>
          void update({ ...preferences, notifyByEmail: enabled })
        }
      />
      {saved ? (
        <p className="settings-save-state" role="status">
          {saved}
        </p>
      ) : null}
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
  icon,
  title,
  description,
  enabled,
  onChange,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onChange(enabled: boolean): void;
}>) {
  return (
    <label className="notification-option">
      <span className="notification-option-icon">{icon}</span>
      <span className="notification-option-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="switch-control">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  );
}
