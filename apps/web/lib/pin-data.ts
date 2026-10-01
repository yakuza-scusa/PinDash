export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface PinRecord {
  id: string;
  workspaceId: string;
  boardId: string | null;
  title: string;
  description: string;
  status: string;
  scheduledForUtc: string | null;
  scheduleTimezone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DataProblem = "offline" | "expired" | "error";

export async function loadPins(signal?: AbortSignal): Promise<PinRecord[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("offline");
  }
  const response = await fetch(`${API_URL}/pins`, {
    credentials: "include",
    ...(signal ? { signal } : {}),
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) throw new Error("expired");
  if (!response.ok) throw new Error("error");
  return (await response.json()) as PinRecord[];
}

export async function startDevelopmentSession(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/development-session`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("error");
}

export function readableStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function relativeDate(value: string): string {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
