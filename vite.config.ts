import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// L'API de l'équipe n'envoie pas d'en-têtes CORS : en développement, Vite relaie
// /api-equipe/* vers elle (même idée que relais.php côté candidat).
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api-equipe": {
        target: "https://hackavp-api.duckdns.org",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api-equipe/, ""),
      },
    },
  },
});
