/* Le score de compatibilité vient du service de matching de l'équipe (MS5, Jo-Michel) :
   https://myz0-cv-matching.hf.space/docs, route POST /v1/score : un CV (JSON Resume) face à un AVP
   (sa référence). Il renvoie un pourcentage de compétences du poste couvertes, un libellé, et les preuves.

   Le service exige une clé (en-tête X-API-Key) : elle est ajoutée par le proxy de développement
   (vite.config.ts, MATCHING_API_KEY dans .env.local) et n'est jamais dans le code du navigateur.

   Les scores sont demandés à la volée, quand un écran en affiche un, trois à la fois au plus, et gardés
   en mémoire pour la session : un candidat ne change pas de CV pendant qu'on le regarde. */

import { useSyncExternalStore } from "react";
import type { Avp, Candidat, Candidature } from "./types";

const BASE = (import.meta.env.VITE_MATCHING_URL as string | undefined) ?? "/api-matching";
const EN_PARALLELE = 3;

export type Niveau = "excellente" | "tres_bonne" | "bonne" | "partielle" | "faible";

export interface Preuve { attendu: string; phraseCv: string | null; note: number; points: number }
export interface Prerequis { prerequis: string; statut: string; motif: string | null; phraseCv: string | null; obligatoire: boolean }

export interface Matching {
  /** Part des compétences (savoir-faire) du poste couvertes, 0..100 : le chiffre affiché. */
  pourcentage: number;
  /** Adéquation 0..100, savoir-être compris : sert au tri. */
  score: number;
  libelle: string;
  niveau: Niveau;
  couvertes: number;
  nbCompetences: number;
  pointsForts: Preuve[];
  aVerifier: Preuve[];
  savoirEtre: Preuve[];
  prerequis: Prerequis[];
  fiable: boolean;
  avertissement: string | null;
}

export type EtatMatching =
  | { etat: "attente" }
  | { etat: "ok"; m: Matching }
  | { etat: "vide" }                       // pas de CV à comparer
  | { etat: "erreur"; message: string };

/* ------------------------------------------------------------- l'appel */

type Brut = Record<string, unknown>;
const nombre = (v: unknown) => (typeof v === "number" ? v : 0);
const chaine = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const preuves = (v: unknown): Preuve[] => (Array.isArray(v) ? v : []).map((p: Brut) => ({
  attendu: String(p.attendu ?? ""), phraseCv: chaine(p.phrase_cv), note: nombre(p.note), points: nombre(p.points),
}));

async function appelScore(reference: string, cv: Record<string, unknown>): Promise<Matching> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/v1/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ reference, cv }),
    });
  } catch {
    throw new Error("Service de matching injoignable.");
  }
  if (r.status === 401 || r.status === 403) throw new Error("Clé du service de matching absente ou refusée.");
  if (r.status === 404) throw new Error("AVP inconnu du service de matching.");
  if (!r.ok) throw new Error(`Service de matching : erreur ${r.status}.`);
  const d = (await r.json()) as Brut;
  return {
    pourcentage: Math.round(nombre(d.pourcentage)),
    score: Math.round(nombre(d.score)),
    libelle: String(d.libelle ?? ""),
    niveau: (String(d.niveau ?? "faible") as Niveau),
    couvertes: nombre(d.competences_couvertes),
    nbCompetences: nombre(d.nb_competences),
    pointsForts: preuves(d.points_forts),
    aVerifier: preuves(d.a_verifier),
    savoirEtre: preuves(d.savoir_etre),
    prerequis: (Array.isArray(d.prerequis) ? d.prerequis : []).map((p: Brut) => ({
      prerequis: String(p.prerequis ?? ""), statut: String(p.statut ?? "a_verifier"), motif: chaine(p.motif),
      phraseCv: chaine(p.phrase_cv), obligatoire: p.obligatoire !== false,
    })),
    fiable: d.fiable !== false,
    avertissement: chaine(d.avertissement),
  };
}

/* ------------------------------------------- le cache et la file d'attente */

const etats = new Map<number, EtatMatching>();      // par candidature
const abonnes = new Set<() => void>();
const file: (() => Promise<void>)[] = [];
let enCours = 0;

const previens = () => abonnes.forEach((f) => f());
const pose = (id: number, e: EtatMatching) => { etats.set(id, e); previens(); };

function suivant(): void {
  while (enCours < EN_PARALLELE && file.length) {
    const tache = file.shift()!;
    enCours++;
    void tache().finally(() => { enCours--; suivant(); });
  }
}

/** Demande le score d'une candidature s'il n'est ni connu ni en cours. */
export function demandeMatching(k: Candidature, c: Candidat | undefined, a: Avp | undefined): void {
  if (etats.has(k.id)) return;
  if (!c?.cvMatching || !a) { pose(k.id, { etat: "vide" }); return; }
  const cv = c.cvMatching, reference = a.reference;
  etats.set(k.id, { etat: "attente" });
  file.push(async () => {
    try {
      pose(k.id, { etat: "ok", m: await appelScore(reference, cv) });
    } catch (e) {
      pose(k.id, { etat: "erreur", message: e instanceof Error ? e.message : "Score indisponible." });
    }
  });
  suivant();
}

/** Oublie les scores (bouton Actualiser) : ils seront redemandés à l'affichage. */
export function videMatching(): void {
  etats.clear();
  previens();
}

const abonne = (f: () => void) => { abonnes.add(f); return () => abonnes.delete(f); };
let version = 0;
abonnes.add(() => { version++; });

/** L'état du score d'une candidature ; le demande au premier affichage. */
export function useMatching(k: Candidature | undefined, c: Candidat | undefined, a: Avp | undefined): EtatMatching {
  useSyncExternalStore(abonne, () => version);
  if (!k) return { etat: "vide" };
  if (!etats.has(k.id)) queueMicrotask(() => demandeMatching(k, c, a));
  return etats.get(k.id) ?? { etat: "attente" };
}

/** Couleur d'un niveau, avec les jetons de l'app. */
export const couleurNiveau = (n: Niveau) =>
  n === "excellente" || n === "tres_bonne" ? "var(--yes)" : n === "bonne" ? "var(--accent)" : "var(--no)";
