"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileText,
  Image,
  LayoutDashboard,
  Menu,
  Pin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "../lib/pin-data";

const primaryNavigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Pins", href: "/pins", icon: Pin },
  { label: "Drafts", href: "/drafts", icon: FileText },
  { label: "Media library", href: "/media", icon: Image },
];

const secondaryNavigation = [
  { label: "Connections", href: "/connections", icon: Sparkles },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Data controls", href: "/data-controls", icon: ShieldCheck },
  { label: "Help & support", href: "/support", icon: CircleHelp },
];

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${API_URL}/auth/session`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          const next = encodeURIComponent(pathname);
          router.replace(`/signin?next=${next}`);
          return;
        }
        setSessionChecked(true);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        router.replace("/signin?error=session-check");
      });
    return () => controller.abort();
  }, [pathname, router]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!sessionChecked) {
    return (
      <main className="auth-page" aria-busy="true">
        <p role="status">Checking your secure session…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <button
        className={`mobile-overlay ${menuOpen ? "open" : ""}`}
        aria-label="Close navigation"
        onClick={() => setMenuOpen(false)}
        type="button"
      />
      <aside
        className={`sidebar ${menuOpen ? "open" : ""}`}
        aria-label="Application navigation"
      >
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">
            <Pin size={19} strokeWidth={2.5} aria-hidden="true" />
          </span>
          PinDash
        </Link>

        <button
          className="workspace-switcher"
          type="button"
          aria-label="Change workspace"
        >
          <span className="workspace-logo">AS</span>
          <span className="workspace-copy">
            <strong>Atelier Studio</strong>
            <span>Business workspace</span>
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>

        <span className="nav-label">Workspace</span>
        <nav>
          <ul className="nav-list">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    className={`nav-link ${isActive(item.href) ? "active" : ""}`}
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <span className="nav-label">Manage</span>
        <nav aria-label="Workspace management">
          <ul className="nav-list">
            {secondaryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Link
                    className={`nav-link ${isActive(item.href) ? "active" : ""}`}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <span className="avatar">AM</span>
            <span className="workspace-copy">
              <strong>Alex Morgan</strong>
              <span>Owner</span>
            </span>
            <ChevronDown size={15} color="#777c8d" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </button>
          <label className="search-box">
            <span className="sr-only">Search PinDash</span>
            <Search size={17} aria-hidden="true" />
            <input
              className="search-input"
              placeholder="Search Pins, boards, drafts…"
              type="search"
            />
            <span className="search-shortcut">Ctrl K</span>
          </label>
          <div className="topbar-actions">
            <Link
              className="icon-button notification-button"
              href="/notifications"
              aria-label="Notifications"
            >
              <Bell size={18} aria-hidden="true" />
            </Link>
            <Link
              className="button button-secondary desktop-action"
              href="/pins/new"
            >
              <Plus size={16} aria-hidden="true" /> Create
            </Link>
          </div>
        </header>
        <main className="page" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
