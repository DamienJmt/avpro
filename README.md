# Adopte un Job — Espace recruteur (front-end)

React 19 + TypeScript + Vite, même socle que `beta/`. Le style est celui de l'app candidat :
`src/design.css`, `src/beta.css` et `src/v2.css` sont des copies de `beta/src/`, `src/recruteur.css` n'ajoute que le propre du recruteur.

Cinq sections : Swipe · AVP · Candidats (À traiter / Présélectionné / Toutes) · Entretiens · Profil.
Une sixième, Pilotage (tableaux de bord Power BI de MS7), est prête dans `src/screens/Pilotage.tsx` mais désactivée
dans `src/App.tsx` (lignes commentées) tant que le module n’est pas livré.

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
| Entretien à programmer | `PATCH /candidatures/{id}/entretien-a-prog` `{ entretienAProg }` |
| Compatibilité | service de matching : `POST /v1/score` `{ reference, cv }` |
| Présélectionner / rejeter | `POST /swipes/recruteurs/candidature/{id}` `{ estLike }` : `VALIDEE` / `REJETEE`, **définitif** |

- **CORS** : leur serveur n'envoie pas d'en-têtes CORS. En développement, Vite relaie `/api-equipe/*` vers eux
  (`vite.config.ts`). En production, il faudra un relais (comme `beta/public/relais.php`) et le déclarer dans `VITE_API_URL`.
- **Session** : leur jeton JWT, valable 1 h sans renouvellement, en `sessionStorage`. À l'expiration, retour à la connexion.
- **Décisions** : définitives dans l'API, et vues aussitôt par le candidat. Elles ne partent donc qu'**après 30 s**,
  annulables jusque-là (barre en bas de l'écran, bouton retour du Swipe, onglet Candidats). Fermer la page les envoie.
- **Statuts** : `EN_ATTENTE` → à traiter, `VALIDEE` → présélectionné, `REJETEE` → rejetée, `ANNULEE` → retirée par le candidat.
- **Entretien** : booléen `entretienAProg` de la candidature, posé ou retiré par `PATCH /candidatures/{id}/entretien-a-prog`.
  Affiché « Entretien » sur une candidature `VALIDEE`.
- **Compatibilité** (`src/matching.ts`) : calculée par le service de matching de l'équipe (MS5, Jo-Michel),
  `POST /v1/score` sur https://myz0-cv-matching.hf.space/docs : un CV (JSON Resume) face à la référence d'un AVP.
  Affiché : la part des compétences du poste couvertes, le libellé, les points forts, ce qui est à vérifier, les
  savoir-être et les prérequis. Le CV envoyé est construit par `api.ts` (`cvMatching`) **sans l'identité** du
  candidat ; les formats courts des comptes de démonstration sont convertis en JSON Resume. Scores demandés à
  l'affichage, trois à la fois, gardés pour la session (vidés par « Actualiser »).
- **Clé du matching** : le service exige `X-API-Key`. La mettre dans `.env.local` (`MATCHING_API_KEY=…`, voir
  `.env.example`) : le proxy de développement l'ajoute, elle n'est jamais dans le code du navigateur.
- **Critères du candidat** (`src/scoring.ts`) : métier visé, contrat, zone, disponibilité, saisis dans l'app
  candidat. Affichés à côté de la compatibilité (« hors de ses critères »), ils ne font pas de score.
- **Profil** : « Mon compte » repris de l'app candidat : adresse du compte, changement de mot de passe par code
  (`/auth/forgot-password` puis `/auth/reset-password`). L'API ne permet pas de changer d'adresse.

## Fusion dans `beta/`

Supprimer les copies de CSS d'ici et importer celles de `beta/`, ajouter les symboles
`i-briefcase`, `i-users`, `i-calendar`, `i-check`, `i-chev` au sprite de `index.html`.
