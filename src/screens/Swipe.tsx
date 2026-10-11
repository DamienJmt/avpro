import { useRef, useState } from "react";
import { api } from "../api";
import { ErreurApi } from "../types";
import type { Avp, Candidat, Candidature } from "../types";
import { demandee, evalue, type Evaluation, type Part } from "../scoring";
import { conf, find, Icone, nom, Spinner, teinte, type Ctx } from "./shared";

const SEUIL = 90;
const mois = (d: string) => new Date(`${d}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const periode = (d: string, f: string) => (d ? (f ? `${d} – ${f}` : `depuis ${d}`) : f);
const NIVEAUX: Record<number, string> = { 1: "Bac", 2: "Bac+2", 3: "Bac+3", 4: "Bac+5" };

function Jauges({ parts }: { parts: Part[] }) {
  return (
    <div className="jauges">
      {parts.map((x) => {
        const inc = x.v === null;
        return (
          <div className={`jauge${inc ? " inconnu" : ""}`} key={x.cle}>
            <span>{x.cle}</span>
            <span className="piste"><b style={{ width: `${inc ? 0 : x.v}%`, background: inc ? "var(--line)" : teinte(x.v!) }} /></span>
            <span className="v">{inc ? "inconnu" : `${x.v} %`}</span>
          </div>
        );
      })}
    </div>
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
function Detail({ c, a, e }: { c: Candidat; a: Avp; e: Evaluation }) {
  return (
    <>
      <div className="col-p">
        <div className="titre">{nom(c)}</div>
        <div className="org">{[c.titre, c.ville].filter(Boolean).join(" · ")}{c.titre || c.ville ? " · " : ""}candidat au poste « {a.titre} » · réf. {a.reference}</div>
        <BoutonCv c={c} />
        {!c.aProfil && <p className="pa" style={{ marginTop: "var(--s3)" }}>Ce candidat n’a pas encore rempli son profil : le score ne peut rien mesurer.</p>}
        <h3>Ce que tu recherches</h3>
        <Jauges parts={e.poste} />
        <h3>Ce que le candidat recherche</h3>
        <Jauges parts={e.candidat} />
        <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", margin: "var(--s3) 0 0" }}>
          {e.score === null ? "Compatibilité inconnue : aucun critère mesurable." : `Compatibilité ${e.score} % — le plus faible des deux côtés, jamais la moyenne.`}{" "}
          Confiance {conf(e.confiance)}, {e.confiance} % des critères renseignés.
        </p>
      </div>
      <div className="col-p">
        <h3>Pourquoi ce score</h3>
        <div className="deux">
          <div><b style={{ color: "var(--yes)", fontSize: "var(--t-sm)" }}>Ce qui colle</b>
            <ul>{(e.oui.length ? e.oui : ["Rien de mesurable encore"]).map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><b style={{ color: "var(--accent)", fontSize: "var(--t-sm)" }}>À vérifier</b>
            <ul>{(e.att.length ? e.att : ["Rien à signaler"]).map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
        {e.non.length > 0 && (<>
          <b style={{ color: "var(--no)", fontSize: "var(--t-sm)" }}>Ne colle pas avec ses critères — tu peux le retenir quand même</b>
          <ul className="liste">{e.non.map((x) => <li key={x}>{x}</li>)}</ul></>)}
        {a.competences.length > 0 && (<>
          <h3>Ce que l’AVP demande ({e.ok.length}/{a.competences.length} chez le candidat)</h3>
          <ul className="liste competences">
            {a.competences.map((x) => <li key={x} className={e.ok.includes(x) ? "has" : undefined}>{x}</li>)}
          </ul>
        </>)}
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

function Carte({ c, a, profondeur, peutRevenir, onDecide, onRetour, onDetail }: CarteProps) {
  const e = evalue(c, a);
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

  const autres = c.competences.filter((x) => !demandee(x, a));
  const vise = e.candidat.find((p) => p.cle === "Métier visé")?.v === 100;
  const zone = e.candidat.find((p) => p.cle === "Lieu")?.v === 100;
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
              {e.score === null
                ? <><span className="gauge" /><span className="v">?</span> compatibilité inconnue</>
                : <><span className="gauge"><b style={{ width: `${e.score}%`, background: teinte(e.score) }} /></span>
                    <span className="v" style={{ color: teinte(e.score) }}>{e.score} %</span> compatible</>}
            </button>
            {e.non.length > 0 && <span className="badge-pass">hors de ses critères</span>}
          </div>
          <div className="conf">confiance {conf(e.confiance)} · {e.confiance} % des critères renseignés</div>
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
          <div className="page-lead">
            {a.competences.length ? `Compétences · ${e.ok.length}/${a.competences.length} attendues par l’AVP` : "Compétences"}
          </div>
          <div className="page-body">
            <div className="tags">
              {c.competences.length === 0 && <span className="doux">Aucune compétence renseignée</span>}
              {c.competences.filter((x) => !autres.includes(x)).map((x) => <span key={x} className="has">{x}</span>)}
              {autres.map((x) => <span key={x}>{x}</span>)}
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

export default function Swipe({ candidatures, candidats, avp, attente, decider, annuler }: Ctx) {
  const [filtre, setFiltre] = useState<number | null>(null);
  const [recherche, setRecherche] = useState("");
  const [feuille, setFeuille] = useState(false);

  const atraiter = candidatures.filter((k) => k.statut === "a_traiter");
  const q = recherche.trim().toLowerCase();
  // Une candidature dont l'AVP ou le candidat manque ne peut pas faire de carte : elle reste dans l'onglet Candidats.
  const pile = atraiter.filter((k) => {
    const c = find(candidats, k.candidatId);
    return c && find(avp, k.avpId) && (filtre === null || k.avpId === filtre) && (!q || `${nom(c)} ${c.titre ?? ""}`.toLowerCase().includes(q));
  });
  const [courante, suivante] = pile;
  const cc = courante && find(candidats, courante.candidatId);
  const ca = courante && find(avp, courante.avpId);
  // Seuls les postes qui ont des candidatures à traiter ont une puce.
  const postes = avp.filter((a) => a.id === filtre || atraiter.some((k) => k.avpId === a.id));
  const derniere = attente[attente.length - 1];

  const rendu = (k: Candidature, profondeur: number) => {
    const c = find(candidats, k.candidatId), a = find(avp, k.avpId);
    return c && a ? (
      <Carte key={k.id} k={k} c={c} a={a} profondeur={profondeur} peutRevenir={Boolean(derniere)}
        onDecide={(ok) => decider(k.id, ok)} onRetour={() => derniere && annuler(derniere.id)} onDetail={() => setFeuille(true)} />
    ) : null;
  };

  return (
    <div className="stack">
      <div className="filters filtres-avp">
        <input type="search" className="recherche" value={recherche} placeholder="Chercher un candidat, un métier…"
          onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher parmi les candidats" />
        <button className="chip" aria-pressed={filtre === null} onClick={() => setFiltre(null)}>
          Tous les postes <span className="cpt">{atraiter.length}</span>
        </button>
        {postes.map((a) => (
          <button key={a.id} className="chip" aria-pressed={filtre === a.id} onClick={() => setFiltre(a.id)}>
            {a.titre} <span className="cpt">{atraiter.filter((k) => k.avpId === a.id).length}</span>
          </button>
        ))}
      </div>

      <div className="zone-deck">
        {!courante && (
          <div className="empty"><div>
            <h2>{atraiter.length ? "Aucun candidat avec ces filtres" : "Tu as tout examiné"}</h2>
            <p>{atraiter.length ? "Retire un filtre ou touche « Tous les postes »." : "Les candidatures présélectionnées sont dans l'onglet Candidats."}</p>
          </div></div>
        )}
        {suivante && rendu(suivante, 1)}
        {courante && rendu(courante, 0)}
      </div>

      {courante && cc && ca && (
        <aside className="side panneau" id="side"><Detail c={cc} a={ca} e={evalue(cc, ca)} /></aside>
      )}

      {feuille && courante && cc && ca && (
        <div className="sheet" onClick={() => setFeuille(false)}>
          <div className="sheet-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="poignee" />
            <div className="panneau"><Detail c={cc} a={ca} e={evalue(cc, ca)} /></div>
            <div className="btns" style={{ marginTop: "var(--s5)" }}>
              <button className="btn primaire" onClick={() => setFeuille(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
