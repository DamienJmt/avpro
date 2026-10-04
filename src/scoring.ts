import type { Avp, Candidat } from "./types";

export interface Part { cle: string; v: number | null }   // v : 0..100, null = inconnu
export interface Evaluation {
  poste: Part[]; candidat: Part[]; ok: string[]; manque: string[]; vComp: number | null;
  scorePoste: number | null; scoreCandidat: number | null; score: number; confiance: number;
  oui: string[]; att: string[]; non: string[];
}

const norm = (s: string) => s.trim().toLowerCase();
const moyenne = (p: Part[]) => {
  const k = p.filter((x) => x.v !== null) as { v: number }[];
  return k.length ? Math.round(k.reduce((s, x) => s + x.v, 0) / k.length) : null;
};
const mois = (d: string) => { const [y, m] = d.split("-").map(Number); return y * 12 + m; };

/* Même règle que l'app candidat : le score est le plus faible des deux côtés, jamais la moyenne. */
export function evalue(c: Candidat, a: Avp): Evaluation {
  const req = a.competencesRequises;
  const ok = req.filter((r) => c.competences.some((x) => norm(x) === norm(r)));
  const manque = req.filter((r) => !ok.includes(r));
  const vComp = req.length ? Math.round((100 * ok.length) / req.length) : null;

  const dispo = c.disponibilite === null ? null
    : Math.max(0, 100 - 25 * Math.max(0, mois(c.disponibilite) - mois(a.debut)));
  const poste: Part[] = [
    { cle: "Compétences", v: vComp },
    { cle: "Expérience", v: c.experienceAnnees === null ? null : a.experienceMin ? Math.min(100, Math.round((100 * c.experienceAnnees) / a.experienceMin)) : 100 },
    { cle: "Formation", v: c.niveauFormation === null ? null : Math.min(100, Math.round((100 * c.niveauFormation) / a.niveauFormationMin)) },
    { cle: "Disponibilité", v: dispo },
  ];
  const sal = a.salaire ? (a.salaire[1] ?? a.salaire[0]) : null;
  const candidat: Part[] = [
    { cle: "Métier visé", v: c.metiersVises.length ? (c.metiersVises.includes(a.metier) ? 100 : 0) : null },
    { cle: "Contrat", v: c.contratsVises.length ? (c.contratsVises.includes(a.contrat) ? 100 : 0) : null },
    { cle: "Salaire", v: sal === null || c.salaireMin === null ? null : Math.min(100, Math.round((100 * sal) / c.salaireMin)) },
    { cle: "Lieu", v: c.villesVisees.length ? (c.villesVisees.includes(a.ville) ? 100 : 0) : null },
  ];
  const scorePoste = moyenne(poste);
  const scoreCandidat = moyenne(candidat);
  const cotes = [scorePoste, scoreCandidat].filter((x): x is number => x !== null);
  const score = cotes.length ? Math.min(...cotes) : 0;
  const tous = [...poste, ...candidat];
  const confiance = Math.round((100 * tous.filter((x) => x.v !== null).length) / tous.length);

  const oui: string[] = [];
  if (ok.length) oui.push(`${ok.length} compétence${ok.length > 1 ? "s" : ""} attendue${ok.length > 1 ? "s" : ""} sur ${req.length} : ${ok.join(", ")}`);
  for (const p of poste.slice(1)) if (p.v === 100) oui.push(`${p.cle} conforme à l'AVP`);
  const att: string[] = [];
  if (manque.length) att.push(`Compétences non déclarées : ${manque.join(", ")}`);
  for (const p of tous) if (p.v === null) att.push(`${p.cle} non renseigné(e)`);
  const non = candidat.filter((p) => p.v === 0).map((p) =>
    p.cle === "Métier visé" ? "Vise d'autres métiers que celui de l'AVP"
    : p.cle === "Contrat" ? `Ne recherche pas un ${a.contrat}` : "Ne vise pas ce lieu de travail");
  return { poste, candidat, ok, manque, vComp, scorePoste, scoreCandidat, score, confiance, oui, att, non };
}
