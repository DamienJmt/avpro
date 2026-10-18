import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // MATCHING_API_KEY vient de .env.local (non versionné). Sans préfixe VITE_, elle reste côté serveur :
  // c'est le proxy qui l'ajoute aux requêtes, elle n'est jamais dans le code envoyé au navigateur.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: "./",
    server: {
      proxy: {
        // L'API de l'équipe n'envoie pas d'en-têtes CORS : Vite relaie /api-equipe/* vers elle
        // (même idée que relais.php côté candidat).
        "/api-equipe": {
          target: "https://hackavp-api.duckdns.org",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-equipe/, ""),
        },
        // Le service de matching (MS5, Jo-Michel) : /api-matching/* → son API, avec la clé.
        "/api-matching": {
          target: env.MATCHING_URL || "https://myz0-cv-matching.hf.space",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api-matching/, ""),
          headers: env.MATCHING_API_KEY ? { "X-API-Key": env.MATCHING_API_KEY } : {},
        },
      },
    },
  };
});
