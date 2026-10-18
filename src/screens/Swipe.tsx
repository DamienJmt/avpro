import { useRef, useState } from "react";
import { api } from "../api";
import { ErreurApi } from "../types";
import type { Avp, Candidat, Candidature } from "../types";
import { criteres, type Part } from "../scoring";
import { couleurNiveau, useMatching, type EtatMatching, type Preuve } from "../matching";
import { find, Icone, nom, Spinner, type Ctx } from "./shared";

const SEUIL = 90;
const mois = (d: string) => new Date(`${d}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const periode = (d: string, f: string) => (d ? (f ? `${d} – ${f}` : `depuis ${d}`) : f);
const NIVEAUX: Record<number, string> = { 1: "Bac", 2: "Bac+2", 3: "Bac+3", 4: "Bac+5" };

/** Les critères du candidat : dans ses critères, hors de ses critères, ou non renseignés. */
function Criteres({ parts }: { parts: Part[] }) {
  return (
    <div className="jauges">
      {parts.map((x) => {
        const inc = x.v === null;
        return (
          <div className={`jauge${inc ? " inconnu" : ""}`} key={x.cle}>
            <span>{x.cle}</span>
            <span className="piste"><b style={{ width: inc ? 0 : "100%", background: x.v === 100 ? "var(--yes)" : "var(--no)" }} /></span>
            <span className="v">{inc ? "inconnu" : x.v === 100 ? "oui" : "non"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Une liste de preuves du matching, tronquée à six. */
function Preuves({ titre, l, couleur, vide, proche }: { titre: string; l: Preuve[]; couleur: string; vide: string; proche?: boolean }) {
  return (
    <div>
      <b style={{ color: couleur, fontSize: "var(--t-sm)" }}>{titre}</b>
      <ul>
        {l.length === 0 && <li>{vide}</li>}
        {l.slice(0, 6).map((p, i) => (
          <li key={i}>{p.attendu}{p.phraseCv && <span className="preuve"> — {proche ? "au plus proche : " : ""}« {p.phraseCv} »</span>}</li>
        ))}
        {l.length > 6 && <li className="preuve">… et {l.length - 6} autre{l.length > 7 ? "s" : ""}</li>}
      </ul>
    </div>
  );
}

const STATUT_PREREQUIS: Record<string, string> = {
  rempli: "rempli", non_rempli: "non rempli", mention_probable: "probablement mentionné", a_verifier: "à vérifier",
};

/** Le résultat du service de matching, dans le panneau de détail. */
function Compatibilite({ e }: { e: EtatMatching }) {
  if (e.etat === "attente") return <p className="attente" role="status"><Spinner /> Calcul de la compatibilité…</p>;
  if (e.etat === "vide") return <p className="pa">Pas de CV à comparer : le candidat n’a ni rempli son profil ni déposé de CV lu.</p>;
  if (e.etat === "erreur") return <p className="pa">Compatibilité indisponible : {e.message}</p>;
  const m = e.m;
  return (
    <>
      <div className="jauges">
        <div className="jauge">
          <span>Compétences du poste</span>
          <span className="piste"><b style={{ width: `${m.pourcentage}%`, background: couleurNiveau(m.niveau) }} /></span>
          <span className="v">{m.pourcentage} %</span>
        </div>
      </div>
      <p style={{ fontSize: "var(--t-sm)", margin: "var(--s2) 0 0" }}>
        <b style={{ color: couleurNiveau(m.niveau) }}>{m.libelle}</b> · {m.couvertes}/{m.nbCompetences} compétences du poste couvertes
      </p>
      {(!m.fiable || m.avertissement) && <p className="pa" style={{ marginTop: "var(--s2)" }}>{m.avertissement ?? "Résultat peu fiable : CV trop court."}</p>}
    </>
  );
}

function Pourquoi({ e }: { e: EtatMatching }) {
  if (e.etat !== "ok") return null;
  const m = e.m;
  return (
    <>
      <h3>Pourquoi ce score</h3>
      <div className="deux">
        <Preuves titre="Points forts" l={m.pointsForts} couleur="var(--yes)" vide="Aucune compétence du poste retrouvée" />
        <Preuves titre="À vérifier" l={m.aVerifier} couleur="var(--accent)" vide="Rien à signaler" proche />
      </div>
      {m.savoirEtre.length > 0 && (<>
        <h3>Savoir-être, à vérifier en entretien</h3>
        <ul className="liste">{m.savoirEtre.slice(0, 6).map((p, i) => <li key={i}>{p.attendu}</li>)}</ul>
      </>)}
      {m.prerequis.length > 0 && (<>
        <h3>Prérequis</h3>
        <ul className="liste">
          {m.prerequis.map((p, i) => (
            <li key={i}><b>{p.prerequis}</b>{!p.obligatoire && " (souhaité)"} : {STATUT_PREREQUIS[p.statut] ?? p.statut}{p.motif && ` — ${p.motif}`}</li>
          ))}
        </ul>
      </>)}
    </>
  );
}

/** Ouvre le CV déposé par le candidat dans un nouvel onglet. */
function BoutonCv({ c }: { c: Candidat }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!c.aCv) return null;
  const ouvre = async () => {
    // L'onglet s'ouvre tout de suite (sinon le navigateur le bloque), le fichier arrive ensuite.
    const fen = window.open("", "_blank");
    setEnvoi(true); setErreur(null);
    try {
      const u = await api.urlFichierCv(c.id);
      if (fen) fen.location.href = u; else window.location.href = u;
    } catch (e) {
      fen?.close();
      setErreur(e instanceof ErreurApi ? e.message : "Le CV n'a pas pu être ouvert.");
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <p style={{ margin: "var(--s2) 0 0" }}>
      <button className="btn-mini" onClick={() => void ouvre()} disabled={envoi}>{envoi ? <><Spinner /> Ouverture…</> : "Voir le CV déposé"}</button>
      {erreur && <span className="etat refus" style={{ marginLeft: "var(--s2)" }}>{erreur}</span>}
    </p>
  );
}

/* Panneau de détail : même ossature que celui de l'app candidat, côté employeur. */
function Detail({ k, c, a }: { k: Candidature; c: Candidat; a: Avp }) {
  const e = useMatching(k, c, a);
  const cr = criteres(c, a);
  return (
    <>
      <div className="col-p">
        <div className="titre">{nom(c)}</div>
        <div className="org">{[c.titre, c.ville].filter(Boolean).join(" · ")}{c.titre || c.ville ? " · " : ""}candidat au poste « {a.titre} » · réf. {a.reference}</div>
        <BoutonCv c={c} />
        <h3>Compatibilité avec le poste</h3>
        <Compatibilite e={e} />
        <h3>Ce que le candidat recherche</h3>
        <Criteres parts={cr.parts} />
        {cr.non.length > 0 && (<>
          <b style={{ color: "var(--no)", fontSize: "var(--t-sm)", display: "block", marginTop: "var(--s3)" }}>Hors de ses critères — tu peux le retenir quand même</b>
          <ul className="liste">{cr.non.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      </div>
      <div className="col-p">
        <Pourquoi e={e} />
        <h3>Le parcours</h3>
        {c.experiences.length + c.formations.length === 0
          ? <p className="pa">Aucune expérience ni formation renseignée.</p>
          : <ul className="liste">
              {c.experiences.map((x, i) => <li key={i}><b>{x.poste}</b>{x.employeur && `, ${x.employeur}`}{(x.debut || x.fin) ? ` (${periode(x.debut, x.fin)})` : x.annees !== null ? ` (${x.annees} an${x.annees > 1 ? "s" : ""})` : ""}</li>)}
              {c.formations.map((x, i) => <li key={`f${i}`}><b>{x.diplome || x.domaine}</b>{x.diplome && x.domaine && `, ${x.domaine}`}{x.etablissement && ` · ${x.etablissement}`}</li>)}
            </ul>}
        {(c.email || c.telephone) && (<>
          <h3>Contact</h3>
          <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", margin: 0 }}>{[c.email, c.telephone].filter(Boolean).join(" · ")}</p>
        </>)}
        {a.description && (<>
          <h3>Le poste</h3>
          <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", margin: 0 }}>{a.description}</p>
        </>)}
      </div>
    </>
  );
}

interface CarteProps {
  k: Candidature; c: Candidat; a: Avp; profondeur: number; peutRevenir?: boolean;
  onDecide?: (ok: boolean) => void; onRetour?: () => void; onDetail?: () => void;
}

function Carte({ k, c, a, profondeur, peutRevenir, onDecide, onRetour, onDetail }: CarteProps) {
  const e = useMatching(k, c, a);
  const cr = criteres(c, a);
  /* Le glissé, comme l'app candidat : la capture du pointeur n'est prise
     qu'après un vrai mouvement horizontal, sinon elle détourne le clic des boutons. */
  const depart = useRef<{ x: number; y: number } | null>(null);
  const capture = useRef(false);
  const [dx, setDx] = useState(0);
  const [lache, setLache] = useState(false);
  const [sortie, setSortie] = useState<0 | 1 | -1>(0);
  const jouable = profondeur === 0;

  const decide = (ok: boolean) => {
    if (sortie) return;
    setSortie(ok ? 1 : -1);
    window.setTimeout(() => onDecide?.(ok), 160);
  };
  const debut = (ev: React.PointerEvent) => {
    if (!jouable) return;
    depart.current = { x: ev.clientX, y: ev.clientY };
    capture.current = false;
    setLache(false);
  };
  const bouge = (ev: React.PointerEvent) => {
    if (!depart.current) return;
    const d = ev.clientX - depart.current.x;
    if (!capture.current) {
      if (Math.abs(d) < 6 || Math.abs(ev.clientY - depart.current.y) > Math.abs(d)) return;
      capture.current = true;
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    }
    setDx(d);
  };
  const fin = () => {
    if (!depart.current) return;
    const aGlisse = capture.current;
    depart.current = null; capture.current = false; setLache(true);
    if (aGlisse && Math.abs(dx) > SEUIL) decide(dx > 0); else setDx(0);
  };
  const transform = sortie ? `translateX(${sortie * 700}px) rotate(${sortie * 22}deg)`
    : dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : `translateY(${profondeur * 8}px) scale(${1 - profondeur * 0.03})`;
  const stop = (ev: React.PointerEvent) => ev.stopPropagation();

  const vise = cr.parts.find((p) => p.cle === "Métier visé")?.v === 100;
  const zone = cr.parts.find((p) => p.cle === "Lieu")?.v === 100;
  // Les compétences du candidat que le matching a reconnues dans le poste (ses points forts) passent en vert.
  const reconnues = e.etat === "ok" ? e.m.pointsForts.map((p) => (p.phraseCv ?? "").toLowerCase()) : [];
  const vue = (x: string) => reconnues.some((r) => r.includes(x.toLowerCase()));
  return (
    <article className="card" aria-hidden={profondeur > 0 || undefined} inert={profondeur > 0}
      style={{ transform, zIndex: 10 - profondeur, transition: lache ? "transform .22s var(--ease)" : undefined,
        touchAction: "pan-y", pointerEvents: profondeur > 0 ? "none" : undefined }}
      onPointerDown={debut} onPointerMove={bouge} onPointerUp={fin} onPointerCancel={fin}>
      <span className={`teinte ${dx > 0 ? "oui" : "non"}`} aria-hidden="true" style={{ opacity: Math.min(1, Math.abs(dx) / SEUIL) }} />
      <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL)) }}>OUI</span>
      <span className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dx / SEUIL)) }}>NON</span>
      <div className="stage">
        <div className="hero">
          <div className="hero-top">
            <button type="button" className="score score-btn" onPointerDown={stop}
              onClick={(ev) => { ev.stopPropagation(); onDetail?.(); }} aria-label="Voir le détail du score">
              {e.etat === "ok"
                ? <><span className="gauge"><b style={{ width: `${e.m.pourcentage}%`, background: couleurNiveau(e.m.niveau) }} /></span>
                    <span className="v" style={{ color: couleurNiveau(e.m.niveau) }}>{e.m.pourcentage} %</span> {e.m.libelle.toLowerCase()}</>
                : e.etat === "attente" ? <><Spinner /> calcul du score…</>
                : <><span className="gauge" /><span className="v">?</span> compatibilité indisponible</>}
            </button>
            {cr.non.length > 0 && <span className="badge-pass">hors de ses critères</span>}
          </div>
          <div className="conf">
            {e.etat === "ok" ? `${e.m.couvertes}/${e.m.nbCompetences} compétences du poste couvertes${e.m.fiable ? "" : " · peu fiable"}`
              : e.etat === "erreur" ? e.message : e.etat === "vide" ? "pas de CV à comparer" : " "}
          </div>
          <h2 className="role">{nom(c)}</h2>
          <div className="org">{[c.titre, c.ville].filter(Boolean).join(" · ") || c.email}</div>
          <div className="cles">
            <span className="cle">{c.experienceAnnees === null ? "expérience inconnue" : `${c.experienceAnnees} an${c.experienceAnnees > 1 ? "s" : ""} d’expérience`}</span>
            {c.niveauFormation && <span className="cle">{NIVEAUX[c.niveauFormation]}</span>}
            <span className="cle">{c.disponibilite ? `dispo dès ${mois(c.disponibilite)}` : "disponibilité inconnue"}</span>
            {vise && <span className="cle moi">Vise ce métier</span>}
            {zone && <span className="cle moi">Dans sa zone</span>}
          </div>
        </div>
        <div className="pagebox">
          <div className="page-lead">Compétences</div>
          <div className="page-body">
            <div className="tags">
              {c.competences.length === 0 && <span className="doux">Aucune compétence renseignée</span>}
              {c.competences.map((x) => <span key={x} className={vue(x) ? "has" : undefined}>{x}</span>)}
            </div>
          </div>
        </div>
      </div>
      <div className="facts">
        <div className="line">
          <span>{a.titre}</span>
          <span>réf. {a.reference}</span>
          <span>{c.zonesVisees.length ? c.zonesVisees.join(", ") : "zones non renseignées"}</span>
          {c.salaireMin ? <em>{Math.round(c.salaireMin / 1000)} k XPF min.</em> : null}
        </div>
      </div>
      {jouable && (
        <div className="coins" onPointerDown={stop}>
          <div className="coin">
            <button type="button" className="retour" disabled={!peutRevenir} onClick={(ev) => { ev.stopPropagation(); onRetour?.(); }}
              aria-label="Annuler la dernière décision (avant son envoi)"><Icone n="undo" /></button>
            <span>Retour</span>
          </div>
          <div className="coin">
            <button type="button" className="non" onClick={(ev) => { ev.stopPropagation(); decide(false); }} aria-label="Écarter"><Icone n="x" /></button>
            <span>Écarter</span>
          </div>
          <div className="coin">
            <button type="button" className="oui" onClick={(ev) => { ev.stopPropagation(); decide(true); }} aria-label="Présélectionner"><Icone n="check" /></button>
            <span>Présélectionner</span>
          </div>
        </div>
      )}
    </article>
  );
}

/* Les filtres, comme le deck de l'app candidat : plusieurs choix dans une catégorie = l'un OU l'autre,
   d'une catégorie à l'autre = les deux. Chaque case affiche le nombre de candidats qu'on verrait en la cochant. */
type Categorie = "postes" | "directions" | "zones";
type Option = "profil" | "cv";
interface Filtres { postes: number[]; directions: string[]; zones: string[]; options: Option[] }
const AUCUN: Filtres = { postes: [], directions: [], zones: [], options: [] };
const CATEGORIES: { cle: Categorie; titre: string }[] = [
  { cle: "postes", titre: "Poste" }, { cle: "directions", titre: "Direction" }, { cle: "zones", titre: "Lieu du poste" },
];
const OPTIONS: { cle: Option; titre: string }[] = [
  { cle: "profil", titre: "Profil renseigné" }, { cle: "cv", titre: "CV déposé" },
];
interface Ligne { k: Candidature; c: Candidat; a: Avp }
type Valeur = string | number;
const valeurDe = (l: Ligne, cle: Categorie): Valeur | null =>
  cle === "postes" ? l.a.id : cle === "directions" ? l.a.direction : l.a.zone;
const choisis = (f: Filtres, cle: Categorie) => f[cle] as Valeur[];
const passe = (l: Ligne, f: Filtres, sauf?: Categorie) =>
  CATEGORIES.every(({ cle }) => cle === sauf || !f[cle].length || choisis(f, cle).includes(valeurDe(l, cle) ?? ""))
  && f.options.every((o) => (o === "profil" ? l.c.aProfil : l.c.aCv));
const nbActifs = (f: Filtres) => f.postes.length + f.directions.length + f.zones.length + f.options.length;
const bascule = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

function PanneauFiltres({ f, lignes, total, avp, change, fermer }: {
  f: Filtres; lignes: Ligne[]; total: number; avp: Avp[]; change: (f: Filtres) => void; fermer: () => void;
}) {
  const libelle = (cle: Categorie, v: Valeur) => (cle === "postes" ? find(avp, v as number)?.titre ?? "" : String(v));
  const ligne = (cle: string, coche: boolean, nomCase: string, n: number, agir: () => void) => (
    <label key={cle} className={`pf-ligne${!coche && n === 0 ? " vide" : ""}`}>
      <input type="checkbox" checked={coche} disabled={!coche && n === 0} onChange={agir} />
      <span className="pf-nom">{nomCase}</span>
      <span className="pf-n">{n}</span>
    </label>
  );
  return (
    <div className="pf">
      <div className="pf-tete">
        <h2>Filtres</h2>
        <p>{total} candidat{total > 1 ? "s" : ""} à traiter correspond{total > 1 ? "ent" : ""}</p>
      </div>
      {CATEGORIES.map(({ cle, titre }) => {
        const valeurs = [...new Set(lignes.map((l) => valeurDe(l, cle)).filter((v): v is Valeur => v !== null && v !== ""))];
        const c = choisis(f, cle);
        if (valeurs.length < 2 && !c.length) return null;      // une seule valeur ne filtre rien
        return (
          <section key={cle} className="pf-section">
            <h3>{titre}{c.length ? <span className="pf-choix">{c.length} choisi{c.length > 1 ? "s" : ""}</span> : null}</h3>
            <div className="pf-lignes">
              {valeurs.map((v) => ligne(`${cle}:${v}`, c.includes(v), libelle(cle, v),
                lignes.filter((l) => passe(l, f, cle) && valeurDe(l, cle) === v).length,
                () => change({ ...f, [cle]: bascule(c, v) })))}
            </div>
          </section>
        );
      })}
      <section className="pf-section">
        <h3>Options</h3>
        <div className="pf-lignes">
          {OPTIONS.map(({ cle, titre }) => ligne(`o:${cle}`, f.options.includes(cle), titre,
            lignes.filter((l) => passe(l, { ...f, options: [...new Set([...f.options, cle])] })).length,
            () => change({ ...f, options: bascule(f.options, cle) })))}
        </div>
      </section>
      <div className="pf-pied">
        <button className="btn" disabled={!nbActifs(f)} onClick={() => change(AUCUN)}>Tout effacer</button>
        <button className="btn primaire" onClick={fermer}>Voir {total} candidat{total > 1 ? "s" : ""}</button>
      </div>
    </div>
  );
}

export default function Swipe({ candidatures, candidats, avp, attente, decider, annuler }: Ctx) {
  const [filtres, setFiltres] = useState<Filtres>(AUCUN);
  const [panneau, setPanneau] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [feuille, setFeuille] = useState(false);

  const q = recherche.trim().toLowerCase();
  // Une candidature dont l'AVP ou le candidat manque ne peut pas faire de carte : elle reste dans l'onglet Candidats.
  const lignes: Ligne[] = candidatures.filter((k) => k.statut === "a_traiter").flatMap((k) => {
    const c = find(candidats, k.candidatId), a = find(avp, k.avpId);
    return c && a && (!q || `${nom(c)} ${c.titre ?? ""} ${a.titre}`.toLowerCase().includes(q)) ? [{ k, c, a }] : [];
  });
  const pile = lignes.filter((l) => passe(l, filtres));
  const [courante, suivante] = pile;
  const derniere = attente[attente.length - 1];
  const actifs = nbActifs(filtres);

  const rendu = (l: Ligne, profondeur: number) => (
    <Carte key={l.k.id} k={l.k} c={l.c} a={l.a} profondeur={profondeur} peutRevenir={Boolean(derniere)}
      onDecide={(ok) => decider(l.k.id, ok)} onRetour={() => derniere && annuler(derniere.id)} onDetail={() => setFeuille(true)} />
  );

  return (
    <div className="stack">
      <div className="filters filtres-avp">
        <input type="search" className="recherche" value={recherche} placeholder="Chercher un candidat, un métier…"
          onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher parmi les candidats" />
        <button type="button" className={`chip ouvre-filtres${actifs ? " on" : ""}`} onClick={() => setPanneau(true)} aria-haspopup="dialog">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          Filtres{actifs > 0 && <span className="pastille">{actifs}</span>}
        </button>
        {CATEGORIES.flatMap(({ cle }) => choisis(filtres, cle).map((v) => (
          <button key={`${cle}:${v}`} className="chip actif" title={String(cle === "postes" ? find(avp, v as number)?.titre : v)}
            onClick={() => setFiltres({ ...filtres, [cle]: bascule(choisis(filtres, cle), v) })}>
            <span className="lib">{cle === "postes" ? find(avp, v as number)?.titre : v}</span> <span className="croix" aria-hidden="true">✕</span>
          </button>
        )))}
        {OPTIONS.filter(({ cle }) => filtres.options.includes(cle)).map(({ cle, titre }) => (
          <button key={cle} className="chip actif" onClick={() => setFiltres({ ...filtres, options: bascule(filtres.options, cle) })}>
            <span className="lib">{titre}</span> <span className="croix" aria-hidden="true">✕</span>
          </button>
        ))}
        {actifs > 0 && <button className="lien-efface" onClick={() => setFiltres(AUCUN)}>Tout effacer</button>}
        <span className="filtres-total" aria-live="polite"><b>{pile.length}</b> candidat{pile.length > 1 ? "s" : ""}</span>
      </div>

      <div className="zone-deck">
        {!courante && (
          <div className="empty"><div>
            <h2>{lignes.length ? "Aucun candidat avec ces filtres" : "Tu as tout examiné"}</h2>
            <p>{lignes.length ? "Retire un filtre ou touche « Tout effacer »." : "Les candidatures présélectionnées sont dans l'onglet Candidats."}</p>
          </div></div>
        )}
        {suivante && rendu(suivante, 1)}
        {courante && rendu(courante, 0)}
      </div>

      {courante && (
        <aside className="side panneau" id="side"><Detail k={courante.k} c={courante.c} a={courante.a} /></aside>
      )}

      {feuille && courante && (
        <div className="sheet" onClick={() => setFeuille(false)}>
          <div className="sheet-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="poignee" />
            <div className="panneau"><Detail k={courante.k} c={courante.c} a={courante.a} /></div>
            <div className="btns" style={{ marginTop: "var(--s5)" }}>
              <button className="btn primaire" onClick={() => setFeuille(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {panneau && (
        <div className="sheet" onClick={() => setPanneau(false)}>
          <div className="sheet-box" role="dialog" aria-modal="true" aria-label="Filtres" onClick={(e) => e.stopPropagation()}>
            <div className="poignee" />
            <PanneauFiltres f={filtres} lignes={lignes} total={pile.length} avp={avp} change={setFiltres} fermer={() => setPanneau(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
