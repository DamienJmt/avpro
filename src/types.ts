/* Les formes que les écrans connaissent. Les réponses de l'API de l'équipe
   (https://hackavp-api.duckdns.org/swagger-ui/index.html) sont traduites dans
   ces formes par api.ts : quand leur API change, c'est api.ts qui s'adapte. */

export interface Avp {
  id: number; reference: string; titre: string;
  metier: string | null; metierCode: string | null;
  direction: string | null; unite: string | null; ville: string | null; province: string | null;
  /** Grand Nouméa · Sud · Nord · Îles : les zones que le candidat choisit dans son profil. */
  zone: string;
  contrat: "CDI" | "CDD" | "Stage";
  /** « 2026-11 » quand l'AVP donne une date, sinon null (voir debutTexte). */
  debut: string | null; debutTexte: string | null;
  datelimite: string | null; ouvert: boolean;
  description: string | null; responsabilites: string[];
  /** Savoir-faire et connaissances de l'AVP, dans ses mots. */
  competences: string[];
  /** Déduits du texte de l'AVP : null quand il ne dit rien. */
  experienceMin: number | null; niveauFormationMin: number | null;
}

export interface Candidat {
  id: number; prenom: string; nom: string; email: string; telephone: string | null;
  titre: string | null; ville: string | null;
  competences: string[];
  experiences: { poste: string; employeur: string; debut: string; fin: string }[];
  formations: { diplome: string; domaine: string; etablissement: string }[];
  // Critères du candidat (meta.criteres de son CV JSON) ; null ou liste vide = non renseigné (affiché « inconnu »).
  experienceAnnees: number | null;
  /** 1 Bac · 2 Bac+2 · 3 Bac+3 · 4 Bac+5 */
  niveauFormation: number | null;
  /** « 2026-11 » */
  disponibilite: string | null;
  metiersOpt: string[]; metiersVises: string[]; contratsVises: string[]; zonesVisees: string[];
  salaireMin: number | null;
  aProfil: boolean; aCv: boolean;
}

/** `retiree` : le candidat a annulé sa candidature (ANNULEE dans l'API). */
export type Statut = "a_traiter" | "preselectionne" | "rejete" | "entretien" | "retiree";

export interface Candidature {
  id: number; candidatId: number; avpId: number; statut: Statut;
  avpTitre: string | null; avpReference: string | null;
  /** Dernier changement, ISO. */
  depuis: string;
}

export interface Employeur { organisme: string; contact: string; email: string; telephone: string }

export interface Recruteur { id: number; email: string }

/** Une erreur d'API porte un code exploitable, pas seulement un texte. */
export class ErreurApi extends Error {
  constructor(readonly code: string, message: string, readonly http: number) {
    super(message);
  }
}
