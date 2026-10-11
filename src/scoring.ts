import type { Avp, Candidat } from "./types";

/** v : 0..100, null = inconnu ; `faute` dit qui ne renseigne pas le critère. */
export interface Part { cle: string; v: number | null; faute?: "candidat" | "avp" }
export interface Evaluation {
  poste: Part[]; candidat: Part[]; ok: string[]; manque: string[]; vComp: number | null;
  /** null quand aucun des deux côtés n'est mesurable (profil vide, AVP muet). */
  scorePoste: number | null; scoreCandidat: number | null; score: number | null; confiance: number;
  oui: string[]; att: string[]; non: string[];
}

const plat = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const moyenne = (p: Part[]) => {
  const k = p.filter((x) => x.v !== null) as { v: number }[];
  return k.length ? Math.round(k.reduce((s, x) => s + x.v, 0) / k.length) : null;
};
const mois = (d: string) => { const [y, m] = d.split("-").map(Number); return y! * 12 + m!; };
const maintenant = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() + 1; };

/* Les compétences de l'AVP sont des phrases (« Analyser les risques d'une situation »),
   celles du candidat des intitulés : même rapprochement que le surlignage de l'app candidat. */
function aLaCompetence(attendue: string, mots: string[]): boolean {
  const t = plat(attendue);
  return mots.some((m) => t.includes(m) || (t.length >= 4 && m.includes(t)));
}

/** Une compétence du candidat est-elle demandée par l'AVP ? (pour la surligner) */
export function demandee(competence: string, a: Avp): boolean {
  const m = plat(competence);
  return m.length >= 3 && a.competences.some((r) => aLaCompetence(r, [m]));
}

/* Même règle que l'app candidat : le score est le plus faible des deux côtés, jamais la moyenne. */
export function evalue(c: Candidat, a: Avp): Evaluation {
  const mots = c.competences.map(plat).filter((x) => x.length >= 3);
  const req = a.competences;
  const ok = mots.length ? req.filter((r) => aLaCompetence(r, mots)) : [];
  const manque = mots.length ? req.filter((r) => !ok.includes(r)) : [];
  const vComp = req.length && mots.length ? Math.round((100 * ok.length) / req.length) : null;

  const debut = a.debut ? mois(a.debut) : maintenant();
  const poste: Part[] = [
    { cle: "Compétences", v: vComp, faute: !req.length ? "avp" : !mots.length ? "candidat" : undefined },
    c.experienceAnnees === null ? { cle: "Expérience", v: null, faute: "candidat" }
      : a.experienceMin === null ? { cle: "Expérience", v: null, faute: "avp" }
      : { cle: "Expérience", v: a.experienceMin ? Math.min(100, Math.round((100 * c.experienceAnnees) / a.experienceMin)) : 100 },
    c.niveauFormation === null ? { cle: "Formation", v: null, faute: "candidat" }
      : a.niveauFormationMin === null ? { cle: "Formation", v: null, faute: "avp" }
      : { cle: "Formation", v: Math.min(100, Math.round((100 * c.niveauFormation) / a.niveauFormationMin)) },
    c.disponibilite === null ? { cle: "Disponibilité", v: null, faute: "candidat" }
      : { cle: "Disponibilité", v: Math.max(0, 100 - 25 * Math.max(0, mois(c.disponibilite) - debut)) },
  ];

  const metierLibre = a.metier ? c.metiersVises.some((m) => plat(m) === plat(a.metier!)) : false;
  const critere = (cle: string, v: number | null): Part => (v === null ? { cle, v, faute: "candidat" } : { cle, v });
  const candidat: Part[] = [
    critere("Métier visé", c.metiersOpt.length || c.metiersVises.length
      ? ((a.metierCode && c.metiersOpt.includes(a.metierCode)) || metierLibre ? 100 : 0) : null),
    critere("Contrat", c.contratsVises.length ? (c.contratsVises.includes(a.contrat) ? 100 : 0) : null),
    critere("Lieu", c.zonesVisees.length ? (c.zonesVisees.includes(a.zone) ? 100 : 0) : null),
  ];

  const scorePoste = moyenne(poste);
  const scoreCandidat = moyenne(candidat);
  const cotes = [scorePoste, scoreCandidat].filter((x): x is number => x !== null);
  const score = cotes.length ? Math.min(...cotes) : null;
  const tous = [...poste, ...candidat];
  const confiance = Math.round((100 * tous.filter((x) => x.v !== null).length) / tous.length);

  const oui: string[] = [];
  if (ok.length) oui.push(`${ok.length} compétence${ok.length > 1 ? "s" : ""} attendue${ok.length > 1 ? "s" : ""} sur ${req.length}`);
  for (const p of poste.slice(1)) if (p.v === 100) oui.push(`${p.cle} conforme à l'AVP`);
  for (const p of candidat) if (p.v === 100) oui.push(`${p.cle} : dans ses critères`);
  const att: string[] = [];
  for (const p of tous) {
    if (p.v !== null) continue;
    att.push(p.faute === "avp" ? `${p.cle} : non précisé(e) dans l'AVP` : `${p.cle} : non renseigné(e) par le candidat`);
  }
  const non = candidat.filter((p) => p.v === 0).map((p) =>
    p.cle === "Métier visé" ? "Vise d'autres métiers que celui de l'AVP"
    : p.cle === "Contrat" ? `Ne recherche pas un ${a.contrat}` : `Ne vise pas la zone ${a.zone}`);
  return { poste, candidat, ok, manque, vComp, scorePoste, scoreCandidat, score, confiance, oui, att, non };
}
