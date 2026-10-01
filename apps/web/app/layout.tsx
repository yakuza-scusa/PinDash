import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PinDash", template: "%s · PinDash" },
  description: "Plan, review, and publish Pinterest content with confidence.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
