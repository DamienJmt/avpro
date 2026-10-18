/* Le seul endroit qui parle à l'API de l'équipe (Dan et Timothée) :
   https://hackavp-api.duckdns.org, documentée sur /swagger-ui/index.html.
   Même principe que beta/src/api.ts côté candidat : les écrans ne connaissent
   que les formes de types.ts, les réponses de l'API sont traduites ici.

   Seule la session vit dans le navigateur : leur jeton, 1 h, sans
   renouvellement, en sessionStorage.

   Leur serveur n'envoie pas d'en-têtes CORS : en développement, Vite relaie
   /api-equipe vers eux (vite.config.ts). En production, il faudra un relais
   du même genre, ou VITE_API_URL le jour où ils ouvriront CORS. */

import { ErreurApi } from "./types";
import type { Avp, Candidat, Candidature, Recruteur, Statut } from "./types";

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
  400: "La demande a été refusée.",
  403: "Ce compte n'a pas accès à cette action : il faut un compte recruteur.",
  404: "Introuvable.",
  502: "Le serveur ne répond pas. Réessaie dans un instant.",
  503: "Le serveur ne répond pas. Réessaie dans un instant.",
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
  statut: string; entretienAProg?: boolean | null; createdAt: string; updatedAt?: string | null;
}
interface ProfilEquipe { candidat: UserEquipe; cv?: unknown; cvJsonGenere?: unknown; cvDocument?: string | null }

const STATUTS: Record<string, Statut> = {
  EN_ATTENTE: "a_traiter", VALIDEE: "preselectionne", REJETEE: "rejete", ANNULEE: "retiree",
};

/* L'entretien n'est pas un statut chez eux mais un booléen à part (entretienAProg),
   modifiable quel que soit le statut : on ne le montre que sur une candidature retenue. */
function candidatureDepuisEquipe(c: CandidatureEquipe): Candidature {
  let statut = STATUTS[c.statut] ?? "a_traiter";
  if (statut === "preselectionne" && c.entretienAProg) statut = "entretien";
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

/** Un champ CV de l'API : objet, chaîne JSON, ou rien. */
function docJson(v: unknown): Json {
  if (typeof v === "string") {
    try { return objet(JSON.parse(v)); } catch { return {}; }
  }
  return objet(v);
}
/** Le document porte-t-il un parcours (et pas seulement des repères comme meta) ? */
const utile = (d: Json) => Object.keys(d).some((k) => k !== "meta" && k !== "$schema");

/**
 * Le compte et le CV JSON → le candidat des écrans. Plusieurs formats circulent dans l'API :
 * - JSON Resume + meta.criteres, écrit par l'app candidat, dans `cv` ;
 * - JSON Resume produit par la lecture du CV déposé (n8n), dans `cvJsonGenere` ;
 * - les formats courts des comptes de démonstration : titre, resume, ville, permisB, anneesExperience,
 *   competences: string[], experiences: {poste, entreprise | employeur, annees}[],
 *   formation: {diplome, ville}[] ou une simple chaîne (« CAP »).
 */
function candidatDepuisEquipe(u: UserEquipe, p: ProfilEquipe | undefined): Candidat {
  const saisi = docJson(p?.cv);
  const lu = docJson(p?.cvJsonGenere);
  const doc = utile(saisi) ? saisi : utile(lu) ? lu : saisi;
  const b = objet(doc.basics);
  const c = objet(objet(saisi.meta).criteres);          // les critères ne sont saisis que dans l'app candidat
  const morceaux = String(b.name ?? "").trim().split(/\s+/).filter(Boolean);
  const work = tableau(doc.work);
  const education = tableau(doc.education);

  const court = tableau(doc.experiences);
  const experiences = [
    ...work.map((w) => ({ poste: String(w.position ?? "").trim(), employeur: String(w.name ?? "").trim(),
      debut: anneeMois(w.startDate), fin: anneeMois(w.endDate), annees: null })),
    ...court.map((x) => ({ poste: String(x.poste ?? "").trim(), employeur: String(x.entreprise ?? x.employeur ?? "").trim(),
      debut: "", fin: "", annees: typeof x.annees === "number" ? x.annees : null })),
  ].filter((x) => x.poste);
  const formationCourte = typeof doc.formation === "string"
    ? [{ diplome: doc.formation.trim(), domaine: "", etablissement: "" }]
    : tableau(doc.formation).map((f) => ({ diplome: String(f.diplome ?? "").trim(), domaine: String(f.domaine ?? "").trim(), etablissement: String(f.etablissement ?? f.ville ?? "").trim() }));
  const formations = [
    ...education.map((e) => ({ diplome: String(e.studyType ?? "").trim(), domaine: String(e.area ?? "").trim(), etablissement: String(e.institution ?? "").trim() })),
    ...formationCourte,
  ].filter((f) => f.diplome || f.domaine);
  const niveaux = formations.map((f) => niveauDepuisTexte(f.diplome)).filter((n): n is number => n !== null);
  const anneesCourt = typeof doc.anneesExperience === "number" ? doc.anneesExperience
    : court.some((x) => typeof x.annees === "number") ? court.reduce((s, x) => s + (typeof x.annees === "number" ? x.annees : 0), 0) : null;
  // Une compétence JSON Resume peut être une rubrique (« Compétences techniques ») et ses mots-clés : on garde les mots-clés.
  const competences = [...new Set([
    ...tableau(doc.skills).flatMap((s) => {
      const mots = liste(s.keywords).filter((k) => !k.startsWith("OPT-NC:"));
      return mots.length > 1 ? mots : [String(s.name ?? "").trim()];
    }),
    ...liste(doc.competences),
  ].filter(Boolean))];
  const titre = texte(b.label) ?? texte(doc.titre) ?? texte(experiences[0]?.poste);
  return {
    id: u.id,
    prenom: texte(u.prenom) ?? morceaux[0] ?? "",
    nom: texte(u.nom) ?? morceaux.slice(1).join(" "),
    email: texte(u.email) ?? texte(b.email) ?? "",
    telephone: texte(b.phone),
    titre,
    ville: texte(objet(b.location).city) ?? texte(doc.ville),
    competences,
    experiences,
    formations,
    experienceAnnees: work.length ? anneesExperience(work) : anneesCourt,
    niveauFormation: niveaux.length ? Math.max(...niveaux) : null,
    disponibilite: /^\d{4}-\d{2}/.exec(String(c.disponibilite ?? ""))?.[0] ?? null,
    metiersOpt: liste(c.metiersOpt),
    metiersVises: liste(c.metiers),
    contratsVises: liste(c.contrats),
    zonesVisees: liste(c.zones),
    salaireMin: typeof c.salaireMinimumMensuelXPF === "number" ? c.salaireMinimumMensuelXPF : null,
    aProfil: Boolean(titre || competences.length || experiences.length || formations.length || Object.keys(c).length),
    aCv: Boolean(p?.cvDocument),
    cvMatching: cvPourMatching(doc, [texte(u.prenom), texte(u.nom), ...morceaux]),
  };
}

/**
 * Le CV envoyé au service de matching : du JSON Resume, SANS l'identité (nom, adresse, téléphone,
 * profils en ligne). Le service ne la lit pas ; elle n'a pas à quitter l'API de l'équipe.
 * Un format court est converti ; null si le profil est vide.
 */
function cvPourMatching(doc: Json, noms: (string | null)[]): Record<string, unknown> | null {
  if (!utile(doc)) return null;
  // Le résumé commence souvent par le nom (« Léa Wamytan, 3 ans d'expérience… ») : on l'en retire.
  const mots = noms.flatMap((n) => (n ?? "").split(/\s+/)).filter((n) => n.length > 1);
  const echappe = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sansNom = (t: unknown): string | undefined => {
    if (typeof t !== "string") return undefined;
    const r = mots.reduce((acc, n) => acc.replace(new RegExp(echappe(n), "gi"), ""), t);
    return r.replace(/^[\s,;:-]+/, "").replace(/\s{2,}/g, " ").trim() || undefined;
  };
  if (doc.basics || doc.work || doc.skills || doc.education) {
    const b = objet(doc.basics);
    const { meta: _meta, $schema: _schema, references: _refs, ...reste } = doc;
    return { ...reste, basics: { label: b.label, summary: sansNom(b.summary), location: objet(b.location).city ? { city: objet(b.location).city } : undefined } };
  }
  const formation = typeof doc.formation === "string" ? [{ studyType: doc.formation }]
    : tableau(doc.formation).map((f) => ({ studyType: f.diplome, area: f.domaine, institution: f.etablissement }));
  return {
    basics: { label: doc.titre, summary: sansNom(doc.resume), location: doc.ville ? { city: doc.ville } : undefined },
    work: tableau(doc.experiences).map((x) => ({
      position: x.poste, name: x.entreprise ?? x.employeur,
      summary: typeof x.annees === "number" ? `${x.annees} an${x.annees > 1 ? "s" : ""} d'expérience` : undefined,
    })),
    education: formation,
    skills: liste(doc.competences).map((name) => ({ name })),
    languages: liste(doc.langues).map((language) => ({ language })),
    certificates: doc.permisB === true ? [{ name: "Permis B" }] : [],
  };
}

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
    const profilDe = new Map(profils.map((p) => [p.candidat.id, p]));
    const comptes = new Map<number, UserEquipe>();
    for (const c of cands) if (c.candidat) comptes.set(c.candidat.id, c.candidat);
    return {
      avp: avp.map(avpDepuisEquipe),
      candidats: [...comptes.values()].map((u) => candidatDepuisEquipe(u, profilDe.get(u.id))),
      candidatures: cands.map(candidatureDepuisEquipe),
    };
  },

  /** Une candidature relue, pour connaître son vrai statut après un refus. */
  async candidature(id: number): Promise<Candidature> {
    return candidatureDepuisEquipe(await appel<CandidatureEquipe>("GET", `/candidatures/${id}`));
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

  /** Entretien à programmer (true) ou plus (false) : rend la candidature à jour. */
  async entretien(candidatureId: number, aProgrammer: boolean): Promise<Candidature> {
    return candidatureDepuisEquipe(await appel<CandidatureEquipe>("PATCH", `/candidatures/${candidatureId}/entretien-a-prog`, {
      corps: { entretienAProg: aProgrammer },
      messages: { 404: "Cette candidature n'existe plus." },
    }));
  },

  /** Le CV déposé par le candidat : leur route exige le jeton, on rend une adresse locale. */
  async urlFichierCv(candidatId: number): Promise<string> {
    const r = await brut("GET", `/profils/${candidatId}/cv`, { messages: { 404: "Ce candidat n'a pas déposé de CV." } });
    return URL.createObjectURL(await r.blob());
  },

  /* ---------------------------------------------------- mot de passe */
  /** Envoie un code à l'adresse du compte. Un 404 (adresse inconnue) n'est pas répété. */
  async oubli(email: string): Promise<void> {
    await brut("POST", "/auth/forgot-password", { anonyme: true, corps: { email } }).catch((e) => {
      if (!(e instanceof ErreurApi) || e.http >= 500 || e.http === 0) throw e;
    });
  },
  async oubliConfirme(code: string, motdepasse: string): Promise<void> {
    await brut("POST", "/auth/reset-password", {
      anonyme: true,
      corps: { token: code, password: motdepasse },
      messages: { 400: "Ce code est inconnu, expiré ou déjà utilisé.", 404: "Ce code est inconnu, expiré ou déjà utilisé." },
    });
  },
};
