// 🎨 SHARP ACADEMIC PRECISION - Professional Education System
// Avoiding AI clichés: No purple/indigo, no generic blue
// Philosophy: Trust + Clarity + Professionalism

export const tokens = {
  // Primary: Teal (Trust + Professionalism) - NOT generic blue
  primary: "#14b8a6", // Teal-500
  primaryDark: "#0d9488", // Teal-600
  primaryLight: "#5eead4", // Teal-300

  // Secondary: Emerald (Success + Growth)
  secondary: "#10b981", // Emerald-500
  secondaryDark: "#059669", // Emerald-600

  // Semantic Colors
  success: "#10b981", // Emerald-500
  warning: "#f59e0b", // Amber-500
  danger: "#ef4444", // Red-500
  info: "#06b6d4", // Cyan-500

  // Neutral Scale (Modern Slate)
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",

  // Spacing Scale (Compact & Professional)
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px"
  },

  // Border Radius (Sharp Geometry)
  radius: {
    none: "0px",
    sm: "2px", // Sharp, professional
    md: "4px", // Slightly softer for inputs
    lg: "6px", // Maximum for cards
    full: "9999px" // Only for avatars/pills
  }
} as const;
