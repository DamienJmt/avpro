# Adopte un Job — Espace recruteur (front-end)

React 19 + TypeScript + Vite, même socle que `beta/`. Le style est celui de l'app candidat :
`src/design.css` est une copie de `beta/src/design.css` (jetons, directions artistiques A/B/C via `data-da`,
deck, navigation, listes, feuilles), `src/recruteur.css` n'ajoute que le propre du recruteur.

Cinq sections : Swipe · AVP · Candidats (À traiter / Présélectionné / Toutes) · Entretiens · Profil.

    npm install && npm run dev

- Données de démo : `src/data/*.json`, lues via `src/api.ts` (à remplacer par des `fetch` vers l'API).
- Formats JSON : `src/types.ts` (à confirmer avec le back-end).
- Flux : `a_traiter` → swipe ou boutons → `preselectionne` / `rejete` → « Valider l'entretien » (simple confirmation : date et lieu ne sont pas gérés ici) → `entretien`.
- Pour fusionner dans `beta/` : supprimer `design.css` d'ici et importer celui de `beta/`, ajouter les symboles
  `i-briefcase`, `i-users`, `i-calendar`, `i-check`, `i-chev` au sprite de `index.html`.
- L'état est local : pas d'authentification ni de persistance pour l'instant.
