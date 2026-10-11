/* Le seul endroit qui parle à l'API de l'équipe (Dan et Timothée) :
   https://hackavp-api.duckdns.org, documentée sur /swagger-ui/index.html.
   Même principe que beta/src/api.ts côté candidat : les écrans ne connaissent
   que les formes de types.ts, les réponses de l'API sont traduites ici.

   Ce qui vit dans le navigateur, et seulement là :
   - la session (leur jeton, 1 h, sans renouvellement), en sessionStorage ;
   - les entretiens validés, tant que l'API n'a pas de statut ENTRETIEN ;
   - les coordonnées de l'employeur, que l'API ne connaît pas.

   Leur serveur n'envoie pas d'en-têtes CORS : en développement, Vite relaie
   /api-equipe vers eux (vite.config.ts). En production, il faudra un relais
   du même genre, ou VITE_API_URL le jour où ils ouvriront CORS. */

import { ErreurApi } from "./types";
import type { Avp, Candidat, Candidature, Employeur, Recruteur, Statut } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api-equipe";

/* ================================================================ session */

interface Session { jeton: string; exp: number; id: number; email: string }
const CLE_SESSION = "avpro.session";

function lisSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? "null") as Session | null;
    return s && s.exp * 1000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function poseSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(CLE_SESSION, JSON.stringify(s));
    else sessionStorage.removeItem(CLE_SESSION);
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

/** Ce que porte leur jeton : `sub` (l'identifiant du compte), `exp`, et peut-être le rôle. */
function litJeton(t: string): { sub: number; exp: number; role: string | null } {
  try {
    const b = t.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const d = JSON.parse(atob(b)) as { sub?: string | number; exp?: number; role?: unknown; roles?: unknown; authorities?: unknown };
    const r = d.role ?? (Array.isArray(d.roles) ? d.roles[0] : d.roles) ?? (Array.isArray(d.authorities) ? d.authorities[0] : null);
    return {
      sub: Number(d.sub ?? 0),
      exp: Number(d.exp ?? Math.floor(Date.now() / 1000) + 3600),
      role: typeof r === "string" ? r.replace(/^ROLE_/, "").toUpperCase() : null,
    };
  } catch {
    return { sub: 0, exp: Math.floor(Date.now() / 1000) + 3600, role: null };
  }
}

function moiSession(): Session {
  const s = lisSession();
  if (!s) throw expiree();
  return s;
}

function expiree(): ErreurApi {
  poseSession(null);
  window.dispatchEvent(new Event("avpro:session-expiree"));
  return new ErreurApi("session_expiree", "La session a expiré : reconnecte-toi.", 401);
}

/* ============================================================ les appels */

interface Options {
  corps?: unknown;
  query?: Record<string, string | number | undefined>;
  anonyme?: boolean;
  /** Messages propres à cette route, par code HTTP. */
  messages?: Record<number, string>;
}

const MESSAGES: Record<number, string> = {
  400: "La demande a été refusée par l'API.",
  403: "Ce compte n'a pas accès à cette action : il faut un compte recruteur.",
  404: "Introuvable.",
  502: "L'API de l'équipe ne répond pas. Réessaie dans un instant.",
  503: "L'API de l'équipe ne répond pas. Réessaie dans un instant.",
};

function url(chemin: string, query?: Options["query"]): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") q.set(k, String(v));
  return `${BASE}${chemin}${q.size ? `?${q}` : ""}`;
}

async function brut(methode: string, chemin: string, o: Options = {}): Promise<Response> {
  const entetes: Record<string, string> = { Accept: "application/json" };
  if (!o.anonyme) entetes.Authorization = `Bearer ${moiSession().jeton}`;
  if (o.corps !== undefined) entetes["Content-Type"] = "application/json";
  let r: Response;
  try {
    r = await fetch(url(chemin, o.query), {
      method: methode,
      headers: entetes,
      body: o.corps === undefined ? undefined : JSON.stringify(o.corps),
    });
  } catch {
    throw new ErreurApi("reseau", "Pas de connexion au serveur. Réessaie dans un instant.", 0);
  }
  if (r.status === 401 && !o.anonyme) throw expiree();
  if (!r.ok) {
    let d: { message?: string } | null = null;
    try { d = (await r.json()) as { message?: string }; } catch { d = null; }
    const m = o.messages?.[r.status] ?? d?.message ?? MESSAGES[r.status] ?? `Erreur ${r.status}`;
    throw new ErreurApi(`http_${r.status}`, m, r.status);
  }
  return r;
}

async function appel<T>(methode: string, chemin: string, o: Options = {}): Promise<T> {
  const r = await brut(methode, chemin, o);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

/** Une liste paginée de leur API, toutes pages lues (100 par page). */
async function toutesPages<T>(chemin: string, o: Options = {}): Promise<T[]> {
  const tout: T[] = [];
  for (let page = 1, pages = 1; page <= pages && page <= 50; page++) {
    const d = await appel<{ contenu: T[]; totalPages: number }>("GET", chemin, { ...o, query: { page, taille: 100 } });
    tout.push(...(d.contenu ?? []));
    pages = Math.max(1, d.totalPages ?? 1);
  }
  return tout;
}

/* ======================================================= petits outils */

type Json = Record<string, unknown>;
const objet = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const tableau = (v: unknown): Json[] => (Array.isArray(v) ? v.map(objet) : []);
const texte = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

/** Même lecture du niveau que l'app candidat : 1 Bac · 2 Bac+2 · 3 Bac+3 · 4 Bac+5. */
function niveauDepuisTexte(t: string): number | null {
  const s = t.toLowerCase();
  if (/bac\s*\+\s*5|master|ingénieur|ingenieur/.test(s)) return 4;
  if (/bac\s*\+\s*3|licence|bachelor/.test(s)) return 3;
  if (/bac\s*\+\s*2|bts|dut/.test(s)) return 2;
  if (/\bbac\b|baccalaur/.test(s)) return 1;
  return null;
}

/* ================================================================ AVP */

const GRAND_NOUMEA = ["Nouméa", "Dumbéa", "Mont-Dore", "Païta"];

/** Même découpage que l'app candidat, pour comparer avec les zones de son profil. */
function zone(ville: string | null, province: string | null): string {
  if (ville && GRAND_NOUMEA.includes(ville)) return "Grand Nouméa";
  const p = (province ?? "").toLowerCase();
  if (p.includes("nord")) return "Nord";
  if (p.includes("îles") || p.includes("iles") || p.includes("loyaut")) return "Îles";
  return "Sud";
}

/** La date limite reste ouverte toute la journée, à Nouméa. */
function ouvert(date: string | null): boolean {
  if (!date) return true;
  const t = Date.parse(`${date.slice(0, 10)}T23:59:59+11:00`);
  return Number.isNaN(t) || t >= Date.now();
}

interface AvpEquipe {
  id: number; reference?: string | null; titre?: string | null; intituleAlternatif?: string | null;
  description?: string | null; direction?: string | null; uniteOrganisationnelle?: string | null;
  metierCode?: string | null; metierLibelle?: string | null; ville?: string | null; province?: string | null;
  typeContrat?: string | null; niveauDiplome?: string | null; experienceRequise?: string | null;
  qualifications?: string | null; dateDebut?: string | null; dateDebutTexte?: string | null;
  debutImmediat?: boolean | null; dateLimite?: string | null;
  connaissances?: string[] | null; savoirFaire?: string[] | null; responsabilites?: string[] | null;
}

function avpDepuisEquipe(a: AvpEquipe): Avp {
  const ville = texte(a.ville);
  const province = texte(a.province);
  const xp = /(\d+)\s*an/.exec(a.experienceRequise ?? "")?.[1];
  const limite = texte(a.dateLimite);
  return {
    id: a.id,
    reference: texte(a.reference) ?? `#${a.id}`,
    titre: texte(a.titre) ?? texte(a.intituleAlternatif) ?? "Sans titre",
    metier: texte(a.metierLibelle),
    metierCode: texte(a.metierCode),
    direction: texte(a.direction),
    unite: texte(a.uniteOrganisationnelle),
    ville,
    province,
    zone: zone(ville, province),
    contrat: a.typeContrat === "TEMPORARY" || a.typeContrat === "CONTRACTOR" ? "CDD" : a.typeContrat === "INTERN" ? "Stage" : "CDI",
    debut: /^(\d{4}-\d{2})/.exec(a.dateDebut ?? "")?.[1] ?? null,
    debutTexte: texte(a.dateDebutTexte) ?? (a.debutImmediat ? "dès que possible" : null),
    datelimite: limite,
    ouvert: ouvert(limite),
    description: texte(a.description),
    responsabilites: liste(a.responsabilites),
    competences: [...liste(a.savoirFaire), ...liste(a.connaissances)],
    experienceMin: xp ? Math.min(15, Number(xp)) : null,
    niveauFormationMin: niveauDepuisTexte(`${a.qualifications ?? ""} ${a.niveauDiplome ?? ""}`),
  };
}

/* ========================================================= candidatures */

interface UserEquipe { id: number; nom?: string | null; prenom?: string | null; email?: string | null; role?: string | null }
interface CandidatureEquipe {
  id: number; candidat?: UserEquipe | null; avpId: number; avpReference?: string | null; avpTitre?: string | null;
  statut: string; createdAt: string; updatedAt?: string | null;
}
interface ProfilEquipe { candidat: UserEquipe; cv?: unknown; cvDocument?: string | null }

/* ENTRETIEN n'existe pas encore dans l'API : il est déjà lu s'il arrive. */
const STATUTS: Record<string, Statut> = {
  EN_ATTENTE: "a_traiter", VALIDEE: "preselectionne", REJETEE: "rejete", ANNULEE: "retiree", ENTRETIEN: "entretien",
};

function candidatureDepuisEquipe(c: CandidatureEquipe, entretiens: number[]): Candidature {
  let statut = STATUTS[c.statut] ?? "a_traiter";
  if (statut === "preselectionne" && entretiens.includes(c.id)) statut = "entretien";
  return {
    id: c.id,
    candidatId: c.candidat?.id ?? 0,
    avpId: c.avpId,
    statut,
    avpTitre: texte(c.avpTitre),
    avpReference: texte(c.avpReference),
    depuis: c.updatedAt ?? c.createdAt,
  };
}

/* ============================================================ candidats */

/** Ancienneté cumulée en années, comme l'app candidat. Une année seule compte pour l'année entière. */
function anneesExperience(work: Json[]): number | null {
  if (!work.length) return null;
  let mois = 0;
  for (const w of work) {
    const d = String(w.startDate ?? ""), f = String(w.endDate ?? "");
    if (!/^\d{4}/.test(d)) continue;
    const a = new Date(`${d.length === 4 ? `${d}-01` : d.slice(0, 7)}-01`);
    const b = f ? new Date(`${f.length === 4 ? `${f}-12` : f.slice(0, 7)}-01`) : new Date();
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) continue;
    mois += (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }
  return mois > 0 ? Math.round(mois / 12) : 0;
}

const anneeMois = (v: unknown) => /^(\d{4})(-\d{2})?/.exec(String(v ?? ""))?.slice(1).join("") ?? "";

/** Le compte et le CV JSON (JSON Resume + meta.criteres, écrit par l'app candidat) → le candidat des écrans. */
function candidatDepuisEquipe(u: UserEquipe, p: ProfilEquipe | undefined): Candidat {
  let cv: unknown = p?.cv;
  if (typeof cv === "string") {
    try { cv = JSON.parse(cv); } catch { cv = {}; }
  }
  const doc = objet(cv);
  const b = objet(doc.basics);
  const c = objet(objet(doc.meta).criteres);
  const morceaux = String(b.name ?? "").trim().split(/\s+/).filter(Boolean);
  const work = tableau(doc.work);
  const education = tableau(doc.education);
  const niveaux = education.map((e) => niveauDepuisTexte(String(e.studyType ?? ""))).filter((n): n is number => n !== null);
  return {
    id: u.id,
    prenom: texte(u.prenom) ?? morceaux[0] ?? "",
    nom: texte(u.nom) ?? morceaux.slice(1).join(" "),
    email: texte(u.email) ?? texte(b.email) ?? "",
    telephone: texte(b.phone),
    titre: texte(b.label) ?? texte(work[0]?.position),
    ville: texte(objet(b.location).city),
    competences: tableau(doc.skills).map((s) => String(s.name ?? "").trim()).filter(Boolean),
    experiences: work
      .map((w) => ({ poste: String(w.position ?? "").trim(), employeur: String(w.name ?? "").trim(), debut: anneeMois(w.startDate), fin: anneeMois(w.endDate) }))
      .filter((x) => x.poste),
    formations: education
      .map((e) => ({ diplome: String(e.studyType ?? "").trim(), domaine: String(e.area ?? "").trim(), etablissement: String(e.institution ?? "").trim() }))
      .filter((f) => f.diplome || f.domaine),
    experienceAnnees: anneesExperience(work),
    niveauFormation: niveaux.length ? Math.max(...niveaux) : null,
    disponibilite: /^\d{4}-\d{2}/.exec(String(c.disponibilite ?? ""))?.[0] ?? null,
    metiersOpt: liste(c.metiersOpt),
    metiersVises: liste(c.metiers),
    contratsVises: liste(c.contrats),
    zonesVisees: liste(c.zones),
    salaireMin: typeof c.salaireMinimumMensuelXPF === "number" ? c.salaireMinimumMensuelXPF : null,
    aProfil: Object.keys(doc).length > 0,
    aCv: Boolean(p?.cvDocument),
  };
}

/* =========================================== ce que l'API ne garde pas */

function lisLocal<T>(cle: string, defaut: T): T {
  try { return (JSON.parse(localStorage.getItem(cle) ?? "null") as T | null) ?? defaut; } catch { return defaut; }
}
function poseLocal(cle: string, v: unknown): void {
  try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* sans effet */ }
}
const cleEntretiens = () => `avpro.entretiens.${lisSession()?.id ?? 0}`;
const cleEmployeur = () => `avpro.employeur.${lisSession()?.id ?? 0}`;

/* ==================================================================== api */

export const api = {
  /* ------------------------------------------------------------- comptes */
  /** Pas d'inscription ici : seul un recruteur ou un admin peut créer un compte recruteur. */
  async connexion(email: string, motdepasse: string): Promise<Recruteur> {
    const d = await appel<{ accessToken: string }>("POST", "/auth/login", {
      anonyme: true,
      corps: { email, password: motdepasse },
      messages: { 401: "Adresse ou mot de passe incorrect.", 400: "Adresse ou mot de passe incorrect." },
    });
    const j = litJeton(d.accessToken);
    if (j.role && j.role !== "RECRUTEUR" && j.role !== "ADMIN") {
      throw new ErreurApi("role", "Ce compte n'est pas un compte recruteur. Les candidats passent par l'app Adopte un Job.", 403);
    }
    const e = email.trim().toLowerCase();
    poseSession({ jeton: d.accessToken, exp: j.exp - 30, id: j.sub, email: e });
    return { id: j.sub, email: e };
  },
  deconnexion(): void {
    poseSession(null);
  },
  moi(): Recruteur | null {
    const s = lisSession();
    return s ? { id: s.id, email: s.email } : null;
  },

  /* -------------------------------------------------------------- données */
  /** Les AVP, les candidatures et les candidats concernés, en une fois. */
  async chargerDonnees(): Promise<{ avp: Avp[]; candidats: Candidat[]; candidatures: Candidature[] }> {
    const refus = { messages: { 403: "Ce compte n'a pas accès aux candidatures : il faut un compte recruteur." } };
    const [avp, cands, profils] = await Promise.all([
      toutesPages<AvpEquipe>("/avp"),
      toutesPages<CandidatureEquipe>("/candidatures", refus),
      toutesPages<ProfilEquipe>("/profils", refus),
    ]);
    const entretiens = lisLocal<number[]>(cleEntretiens(), []);
    const profilDe = new Map(profils.map((p) => [p.candidat.id, p]));
    const comptes = new Map<number, UserEquipe>();
    for (const c of cands) if (c.candidat) comptes.set(c.candidat.id, c.candidat);
    return {
      avp: avp.map(avpDepuisEquipe),
      candidats: [...comptes.values()].map((u) => candidatDepuisEquipe(u, profilDe.get(u.id))),
      candidatures: cands.map((c) => candidatureDepuisEquipe(c, entretiens)),
    };
  },

  /** Une candidature relue, pour connaître son vrai statut après un refus. */
  async candidature(id: number): Promise<Candidature> {
    return candidatureDepuisEquipe(await appel<CandidatureEquipe>("GET", `/candidatures/${id}`), lisLocal<number[]>(cleEntretiens(), []));
  },

  /**
   * La décision du recruteur, définitive dans leur API : un like passe la
   * candidature en VALIDEE, un dislike en REJETEE, et le candidat le voit tout
   * de suite. D'où le délai d'annulation tenu par App.tsx avant cet appel.
   */
  async decide(candidatureId: number, ok: boolean): Promise<void> {
    await brut("POST", `/swipes/recruteurs/candidature/${candidatureId}`, {
      corps: { estLike: ok },
      messages: {
        409: "Cette candidature a déjà été traitée par un recruteur, ou retirée par le candidat.",
        403: "Seul un compte recruteur peut décider (un compte admin peut lire, pas trancher).",
      },
    });
  },
  /** Même décision, envoyée pendant la fermeture de la page : le navigateur la termine seul. */
  decideAuDepart(candidatureId: number, ok: boolean): void {
    const s = lisSession();
    if (!s) return;
    void fetch(url(`/swipes/recruteurs/candidature/${candidatureId}`), {
      method: "POST",
      keepalive: true,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${s.jeton}` },
      body: JSON.stringify({ estLike: ok }),
    }).catch(() => undefined);
  },

  /* ENTRETIEN : pas encore de statut ni de route dans l'API de l'équipe.
     En attendant, la validation est gardée dans ce navigateur ; le jour où la
     route existe, seules ces deux fonctions changent. */
  async valideEntretien(candidatureId: number): Promise<void> {
    const l = lisLocal<number[]>(cleEntretiens(), []);
    if (!l.includes(candidatureId)) poseLocal(cleEntretiens(), [...l, candidatureId]);
  },
  async annuleEntretien(candidatureId: number): Promise<void> {
    poseLocal(cleEntretiens(), lisLocal<number[]>(cleEntretiens(), []).filter((x) => x !== candidatureId));
  },

  /** Le CV déposé par le candidat : leur route exige le jeton, on rend une adresse locale. */
  async urlFichierCv(candidatId: number): Promise<string> {
    const r = await brut("GET", `/profils/${candidatId}/cv`, { messages: { 404: "Ce candidat n'a pas déposé de CV." } });
    return URL.createObjectURL(await r.blob());
  },

  /* ----------------------------------------------- coordonnées employeur */
  employeur(): Employeur {
    return lisLocal<Employeur>(cleEmployeur(), { organisme: "OPT-NC", contact: "", email: lisSession()?.email ?? "", telephone: "" });
  },
  enregistreEmployeur(e: Employeur): void {
    poseLocal(cleEmployeur(), e);
  },
};
