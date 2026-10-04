import avp from "./data/avp.json";
import candidats from "./data/candidats.json";
import candidatures from "./data/candidatures.json";
import type { Avp, Candidat, Candidature } from "./types";

// Point unique d'accès aux données : remplacer par des fetch() vers l'API
// quand les formats JSON seront confirmés avec le back-end.
export async function chargerDonnees() {
  return {
    avp: avp as Avp[],
    candidats: candidats as Candidat[],
    candidatures: candidatures as Candidature[],
  };
}
