import { useMemo, useState, useEffect, createContext, useContext } from "react";
import { ThemeProvider as MuiThemeProvider, createTheme, Theme, alpha } from "@mui/material";

import { brand } from "./brandTokens";

const buildTheme = (mode: "light" | "dark") =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: brand.azulPrincipal,
        dark: brand.azulEscuro,
        light: brand.azulApoio,
        contrastText: brand.branco,
      },
      secondary: {
        main: brand.verde,
        dark: '#0F5C4D',
        light: '#1A9B80',
        contrastText: brand.branco,
      },
      background: {
        default: mode === "light" ? brand.fundoClaroQuente : '#0f172a',
        paper: mode === "light" ? brand.branco : '#1e293b',
      },
      text: {
        primary: mode === "light" ? brand.grafite : '#f8fafc',
        secondary: mode === "light" ? brand.cinza500 : '#94a3b8',
      },
      divider: mode === "light" ? brand.cinza100 : '#334155',
    },
    typography: {
      fontFamily: '"Inter", "DM Sans", "Segoe UI", system-ui, sans-serif',
      h1: {
        fontWeight: 800,
        fontSize: "2.5rem",
        letterSpacing: "-0.02em",
        lineHeight: 1.15,
      },
      h2: {
        fontWeight: 700,
        fontSize: "2rem",
        letterSpacing: "-0.01em",
        lineHeight: 1.2,
      },
      h3: {
        fontWeight: 700,
        fontSize: "1.5rem",
        lineHeight: 1.3,
      },
      h4: {
        fontWeight: 600,
        fontSize: "1.25rem",
        lineHeight: 1.4,
      },
      h5: {
        fontWeight: 600,
        fontSize: "1.1rem",
        lineHeight: 1.4,
      },
      h6: {
        fontWeight: 600,
        fontSize: "1rem",
        lineHeight: 1.5,
      },
      subtitle1: {
        fontSize: "1.1rem",
        fontWeight: 400,
        lineHeight: 1.6,
      },
      body1: {
        fontSize: "0.9375rem",
        lineHeight: 1.7,
      },
      body2: {
        fontSize: "0.875rem",
        lineHeight: 1.6,
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
        letterSpacing: "0.01em",
      },
      caption: {
        fontSize: "0.75rem",
        lineHeight: 1.5,
      },
    },
    shape: {
      borderRadius: 6,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 6,
            paddingInline: 24,
            fontSize: "0.95rem",
            fontWeight: 600,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "0 2px 8px rgba(10,60,160,0.18)",
            },
          },
          containedPrimary: {
            backgroundColor: brand.azulPrincipal,
            "&:hover": {
              backgroundColor: brand.azulEscuro,
            },
          },
          containedSecondary: {
            backgroundColor: brand.verde,
            "&:hover": {
              backgroundColor: '#0F5C4D',
            },
          },
          outlined: {
            borderWidth: 2,
            "&:hover": {
              borderWidth: 2,
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            border: `1px solid ${brand.cinza100}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 6,
            },
          },
        },
      },
      MuiContainer: {
        defaultProps: {
          maxWidth: "lg",
        },
      },
    },
  });

interface ThemeContextType {
  mode: "light" | "dark";
  toggleTheme: () => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "colaboraedu-theme-mode";

export const useAppTheme = () => {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") return stored;
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
  });

  const theme = useMemo(() => buildTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  const toggleTheme = () => setMode((prev) => (prev === "light" ? "dark" : "light"));

  return { theme, mode, toggleTheme };
};

export const useColorMode = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useColorMode must be used within an AppThemeProvider");
  return context;
};

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const themeManagement = useAppTheme();

  return (
    <ThemeContext.Provider value={themeManagement}>
      <MuiThemeProvider theme={themeManagement.theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export { alpha };
