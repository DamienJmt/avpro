// Formats JSON attendus du back-end (à confirmer : étape 2 de la présentation).
export interface Avp {
  id: string; reference: string; titre: string; metier: string; direction: string; ville: string; province: string;
  contrat: string; duree?: string; debut: string; datelimite: string; description: string;
  competencesRequises: string[]; experienceMin: number; niveauFormationMin: number;
  teletravail: "non" | "partiel"; salaire?: [number, number?];
}
export interface Candidat {
  id: string; prenom: string; nom: string; titre: string; ville: string;
  competences: string[];
  experiences: { poste: string; employeur: string; duree: string }[];
  formations: { diplome: string; etablissement: string }[];
  // Critères « ce que le candidat recherche » ; null = non renseigné (affiché « inconnu »).
  experienceAnnees: number | null; niveauFormation: number | null; disponibilite: string | null;
  metiersVises: string[]; contratsVises: string[]; villesVisees: string[]; salaireMin: number | null;
}
export type Statut = "a_traiter" | "preselectionne" | "rejete" | "entretien";
export interface Candidature {
  id: string; candidatId: string; avpId: string; statut: Statut;
}
export interface Employeur { organisme: string; contact: string; email: string; telephone: string }
