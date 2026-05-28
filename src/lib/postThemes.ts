export type PostBackgroundTheme =
  | "default"
  | "cream"
  | "sand"
  | "lavender"
  | "wine"
  | "midnight"
  | "gold"
  | "forest";

import type { CSSProperties } from "react";

export type ThemeSpec = {
  id: PostBackgroundTheme;
  label: string;
  preview: string;
  style: CSSProperties;
  ink?: string;
};

export const POST_BACKGROUND_THEMES: ThemeSpec[] = [
  { id: "default", label: "Default", preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", style: { background: "linear-gradient(135deg,#1a1a1a,#2a2a2a)" }, ink: "#F5F3EF" },
  { id: "cream", label: "Cream", preview: "#F5F3EF", style: { background: "#F5F3EF" }, ink: "#121212" },
  { id: "sand", label: "Sand", preview: "linear-gradient(135deg,#EFE6D6,#E8DDC9)", style: { background: "linear-gradient(135deg,#EFE6D6,#E8DDC9)" }, ink: "#3A2A1A" },
  { id: "lavender", label: "Lavender", preview: "linear-gradient(135deg,#EDE7F6,#D6CDE8)", style: { background: "linear-gradient(135deg,#EDE7F6,#D6CDE8)" }, ink: "#3B2860" },
  { id: "wine", label: "Wine", preview: "linear-gradient(135deg,#1A0F14,#3B1A1F)", style: { background: "linear-gradient(135deg,#1A0F14,#3B1A1F)" }, ink: "#F5E2C2" },
  { id: "midnight", label: "Midnight", preview: "linear-gradient(135deg,#0E0717,#1A0F2E)", style: { background: "linear-gradient(135deg,#0E0717,#1A0F2E)" }, ink: "#E8E0F0" },
  { id: "gold", label: "Gold dusk", preview: "linear-gradient(135deg,#1C0F06,#2E1A0C)", style: { background: "linear-gradient(135deg,#1C0F06,#2E1A0C)" }, ink: "#F5E2C2" },
  { id: "forest", label: "Forest", preview: "linear-gradient(135deg,#0F1A12,#1A2E1F)", style: { background: "linear-gradient(135deg,#0F1A12,#1A2E1F)" }, ink: "#E2F0E8" },
];

export function themeById(id?: string | null): ThemeSpec {
  return POST_BACKGROUND_THEMES.find((t) => t.id === id) ?? POST_BACKGROUND_THEMES[0];
}

export function themeBackgroundStyle(id?: string | null): CSSProperties {
  return themeById(id).style;
}
