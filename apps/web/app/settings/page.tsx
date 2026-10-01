import { Bell, Globe2, Save, Users } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { PageHeader } from "../../components/page-header";

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage workspace defaults, members, and notifications."
        action={
          <button className="button button-primary">
            <Save size={17} /> Save changes
          </button>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <a className="active" href="#general">
            <Globe2 size={17} /> General
          </a>
          <a href="#members">
            <Users size={17} /> Members
          </a>
          <a href="#notifications">
            <Bell size={17} /> Notifications
          </a>
        </nav>
        <section className="panel settings-form" id="general">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Workspace details</h2>
              <p className="panel-subtitle">
                Used for schedules and team activity.
              </p>
            </div>
          </div>
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
      </div>
    </AppShell>
  );
}
