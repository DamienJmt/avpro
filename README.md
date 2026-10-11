# Adopte un Job — Espace recruteur (front-end)

React 19 + TypeScript + Vite, même socle que `beta/`. Le style est celui de l'app candidat :
`src/design.css`, `src/beta.css` et `src/v2.css` sont des copies de `beta/src/`, `src/recruteur.css` n'ajoute que le propre du recruteur.

Cinq sections : Swipe · AVP · Candidats (À traiter / Présélectionné / Toutes) · Entretiens · Profil.

    npm install && npm run dev      # http://localhost:5173

## Les données : l'API de l'équipe

Comme l'app candidat, l'espace recruteur n'a ni base ni API à lui : tout vient de l'API commune de l'équipe HackAVP,
`https://hackavp-api.duckdns.org` (doc : [/swagger-ui/index.html](https://hackavp-api.duckdns.org/swagger-ui/index.html)).
`src/api.ts` est le seul fichier qui lui parle et traduit ses réponses dans les formes de `src/types.ts`.

| Écran | Routes |
|---|---|
| Connexion | `POST /auth/login` (compte `RECRUTEUR`, créé par un recruteur ou un admin) |
| AVP | `GET /avp` |
| Swipe, Candidats | `GET /candidatures`, `GET /profils` (CV JSON Resume + `meta.criteres` écrits par l'app candidat), `GET /profils/{id}/cv` |
| Présélectionner / rejeter | `POST /swipes/recruteurs/candidature/{id}` `{ estLike }` : `VALIDEE` / `REJETEE`, **définitif** |

- **CORS** : leur serveur n'envoie pas d'en-têtes CORS. En développement, Vite relaie `/api-equipe/*` vers eux
  (`vite.config.ts`). En production, il faudra un relais (comme `beta/public/relais.php`) et le déclarer dans `VITE_API_URL`.
- **Session** : leur jeton JWT, valable 1 h sans renouvellement, en `sessionStorage`. À l'expiration, retour à la connexion.
- **Décisions** : définitives dans l'API, et vues aussitôt par le candidat. Elles ne partent donc qu'**après 30 s**,
  annulables jusque-là (barre en bas de l'écran, bouton retour du Swipe, onglet Candidats). Fermer la page les envoie.
- **Statuts** : `EN_ATTENTE` → à traiter, `VALIDEE` → présélectionné, `REJETEE` → rejetée, `ANNULEE` → retirée par le candidat.
- **Entretien** : le statut `ENTRETIEN` est à ajouter dans l'API. En attendant, la validation est gardée dans le navigateur
  (`api.valideEntretien` / `api.annuleEntretien`, les deux seules fonctions à changer) et le candidat ne la voit pas.
- **Score** (`src/scoring.ts`) : calculé ici, faute de module de matching dans l'API. Le plus faible des deux côtés,
  jamais la moyenne. Les compétences de l'AVP (savoir-faire, connaissances) sont rapprochées par le texte de celles
  du candidat ; expérience et formation demandées sont lues dans le texte de l'AVP et souvent absentes (« inconnu »).
  Pas de critère salaire : les AVP n'en donnent pas.
- **Profil employeur** : l'API ne le connaît pas, il est gardé dans le navigateur.

## Fusion dans `beta/`

Supprimer les copies de CSS d'ici et importer celles de `beta/`, ajouter les symboles
`i-briefcase`, `i-users`, `i-calendar`, `i-check`, `i-chev` au sprite de `index.html`.
