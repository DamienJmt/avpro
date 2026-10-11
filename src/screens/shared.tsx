import { useEffect, useState } from "react";
import type { Avp, Candidat, Candidature, Statut } from "../types";
import { evalue } from "../scoring";

/** Une décision prise mais pas encore envoyée : annulable jusqu'à l'échéance. */
export interface EnAttente { id: number; ok: boolean; echeance: number }

export interface Ctx {
  avp: Avp[]; candidats: Candidat[]; candidatures: Candidature[];
  attente: EnAttente[];
  /** Présélectionner (ok) ou rejeter : envoyé à l'API après le délai d'annulation. */
  decider: (id: number, ok: boolean) => void;
  /** Annule une décision encore en attente. */
  annuler: (id: number) => void;
  confirmer: (id: number) => void;
}

export const find = <T extends { id: number }>(l: T[], id: number) => l.find((x) => x.id === id);
export const Icone = ({ n }: { n: string }) => <svg aria-hidden="true"><use href={`#i-${n}`} /></svg>;
export const teinte = (q: number) => (q >= 75 ? "var(--yes)" : q >= 50 ? "var(--accent)" : "var(--no)");
export const conf = (v: number) => (v >= 90 ? "élevée" : v >= 60 ? "moyenne" : "faible");
export const initiales = (c?: Candidat) => (c ? `${c.prenom[0] ?? ""}${c.nom[0] ?? ""}`.toUpperCase() || "?" : "?");
export const nom = (c?: Candidat) => (c ? `${c.prenom} ${c.nom}`.trim() || c.email : "Candidat inconnu");
export const scoreDe = (k: Candidature, candidats: Candidat[], avp: Avp[]) => {
  const c = find(candidats, k.candidatId), a = find(avp, k.avpId);
  return c && a ? evalue(c, a).score : null;   // null : rien de mesurable, affiché « – »
};
export const titreAvp = (k: Candidature, avp: Avp[]) => find(avp, k.avpId)?.titre ?? k.avpTitre ?? "Poste inconnu";

export const LIBELLE: Record<Statut, string> = {
  a_traiter: "À traiter", preselectionne: "Présélectionné", rejete: "Rejetée", entretien: "Entretien",
  retiree: "Retirée par le candidat",
};
export const classeEtat = (s: Statut) =>
  s === "preselectionne" || s === "entretien" ? "match" : s === "rejete" ? "refus" : s === "retiree" ? "ferme" : "attente";

/** Secondes restantes avant l'envoi, rafraîchies chaque seconde. */
export function useSecondes(echeance: number | undefined): number {
  const [, tic] = useState(0);
  useEffect(() => {
    if (!echeance) return;
    const t = window.setInterval(() => tic((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [echeance]);
  return echeance ? Math.max(0, Math.ceil((echeance - Date.now()) / 1000)) : 0;
}

export function Spinner({ grand }: { grand?: boolean }) {
  return <span className={grand ? "spin grand" : "spin"} aria-hidden="true" />;
}

export function Vide({ titre, texte }: { titre: string; texte: string }) {
  return <div className="vide"><b>{titre}</b>{texte}</div>;
}
