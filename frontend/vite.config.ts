import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_BACKEND_URL:
//   - Dentro do Docker Compose: http://backend:5000  (definido no docker-compose.yml)
//   - Dev local sem Docker:     http://localhost:5000  (padrão)
const backendUrl = process.env.VITE_BACKEND_URL ?? "http://localhost:5000";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: mode !== "production",
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("@mui/icons-material")) {
            return "vendor-mui-icons";
          }
          if (id.includes("@mui/x-data-grid")) {
            return "vendor-mui-grid";
          }
          if (id.includes("@mui/x-charts")) {
            return "vendor-mui-charts";
          }
          if (id.includes("@mui/") || id.includes("@emotion/")) {
            return "vendor-mui";
          }
          if (id.includes("/recharts/") || id.includes("/d3-")) {
            return "vendor-charts";
          }
          if (id.includes("@reduxjs/toolkit") || id.includes("/react-redux/")) {
            return "vendor-state";
          }
          if (id.includes("/react-router-dom/") || id.includes("/@remix-run/")) {
            return "vendor-router";
          }
          if (id.includes("/axios/") || id.includes("/react-hook-form/") || id.includes("/zod/")) {
            return "vendor-forms-api";
          }
          return "vendor";
        },
      },
    },
  },
}));
