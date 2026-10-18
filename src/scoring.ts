import type { Avp, Candidat } from "./types";

/* La compatibilité (compétences du poste couvertes par le CV) vient du service de matching : matching.ts.
   Restent ici les critères que le candidat a donnés dans l'app candidat et que le service ne lit pas :
   ce qu'il recherche. Ils ne font pas de score : ils s'affichent, le recruteur décide. */

/** v : 100 = dans ses critères, 0 = hors de ses critères, null = non renseigné. */
export interface Part { cle: string; v: number | null }

const plat = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const mois = (d: string) => { const [y, m] = d.split("-").map(Number); return y! * 12 + m!; };
const maintenant = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth() + 1; };

export function criteres(c: Candidat, a: Avp): { parts: Part[]; non: string[] } {
  const metierLibre = a.metier ? c.metiersVises.some((m) => plat(m) === plat(a.metier!)) : false;
  const debut = a.debut ? mois(a.debut) : maintenant();
  const parts: Part[] = [
    { cle: "Métier visé", v: c.metiersOpt.length || c.metiersVises.length
      ? ((a.metierCode && c.metiersOpt.includes(a.metierCode)) || metierLibre ? 100 : 0) : null },
    { cle: "Contrat", v: c.contratsVises.length ? (c.contratsVises.includes(a.contrat) ? 100 : 0) : null },
    { cle: "Lieu", v: c.zonesVisees.length ? (c.zonesVisees.includes(a.zone) ? 100 : 0) : null },
    // disponible au plus tard un mois après le début du poste : dans les temps
    { cle: "Disponibilité", v: c.disponibilite === null ? null : mois(c.disponibilite) <= debut + 1 ? 100 : 0 },
  ];
  const non = parts.filter((p) => p.v === 0).map((p) =>
    p.cle === "Métier visé" ? "Vise d'autres métiers que celui de l'AVP"
    : p.cle === "Contrat" ? `Ne recherche pas un ${a.contrat}`
    : p.cle === "Lieu" ? `Ne vise pas la zone ${a.zone}`
    : "Disponible après le début du poste");
  return { parts, non };
}
