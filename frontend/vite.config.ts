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
  },
}));
