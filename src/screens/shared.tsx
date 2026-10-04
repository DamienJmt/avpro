import type { Avp, Candidat, Candidature, Statut } from "../types";
import { evalue } from "../scoring";

export interface Ctx {
  avp: Avp[]; candidats: Candidat[]; candidatures: Candidature[];
  maj: (id: string, statut: Statut) => void;
  confirmer: (id: string) => void;
}

export const find = <T extends { id: string }>(l: T[], id: string) => l.find((x) => x.id === id);
export const Icone = ({ n }: { n: string }) => <svg aria-hidden="true"><use href={`#i-${n}`} /></svg>;
export const teinte = (q: number) => (q >= 75 ? "var(--yes)" : q >= 50 ? "var(--accent)" : "var(--no)");
export const conf = (v: number) => (v >= 90 ? "élevée" : v >= 60 ? "moyenne" : "faible");
export const initiales = (c?: Candidat) => (c ? (c.prenom[0] + c.nom[0]).toUpperCase() : "?");
export const nom = (c?: Candidat) => (c ? `${c.prenom} ${c.nom}` : "Candidat inconnu");
export const scoreDe = (k: Candidature, candidats: Candidat[], avp: Avp[]) => {
  const c = find(candidats, k.candidatId), a = find(avp, k.avpId);
  return c && a ? evalue(c, a).score : 0;
};

export const LIBELLE: Record<Statut, string> = {
  a_traiter: "À traiter", preselectionne: "Présélectionné", rejete: "Rejetée", entretien: "Entretien",
};
export const classeEtat = (s: Statut) =>
  s === "preselectionne" || s === "entretien" ? "match" : s === "rejete" ? "refus" : "attente";

export function Vide({ titre, texte }: { titre: string; texte: string }) {
  return <div className="vide"><b>{titre}</b>{texte}</div>;
}
