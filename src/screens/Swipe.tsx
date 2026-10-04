import { useRef, useState } from "react";
import type { Avp, Candidat, Candidature } from "../types";
import { evalue, type Evaluation, type Part } from "../scoring";
import { conf, find, Icone, nom, teinte, type Ctx } from "./shared";

const SEUIL = 90;
const mois = (d: string) => new Date(`${d}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

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

/* Panneau de détail : même ossature que celui de l'app candidat, côté employeur. */
function Detail({ c, a, e }: { c: Candidat; a: Avp; e: Evaluation }) {
  return (
    <>
      <div className="col-p">
        <div className="titre">{nom(c)}</div>
        <div className="org">{c.titre} · {c.ville} · candidat au poste « {a.titre} » · réf. {a.reference}</div>
        <h3>Ce que tu recherches</h3>
        <Jauges parts={e.poste} />
        <h3>Ce que le candidat recherche</h3>
        <Jauges parts={e.candidat} />
        <h3>Les compétences, en détail</h3>
        <Jauges parts={[{ cle: `Attendues (${e.ok.length}/${a.competencesRequises.length})`, v: e.vComp }]} />
        <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", margin: "var(--s3) 0 0" }}>
          Compatibilité {e.score} % — le plus faible des deux côtés, jamais la moyenne.
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
        <h3>Le parcours</h3>
        <ul className="liste">
          {c.experiences.map((x, i) => <li key={i}><b>{x.poste}</b>, {x.employeur} ({x.duree})</li>)}
          {c.formations.map((x, i) => <li key={`f${i}`}><b>{x.diplome}</b>, {x.etablissement}</li>)}
        </ul>
        <h3>Le poste</h3>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", margin: 0 }}>{a.description}</p>
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
  const [dx, setDx] = useState(0);
  const [lache, setLache] = useState(false);
  const [sortie, setSortie] = useState(0);
  const x0 = useRef<number | null>(null);
  const aGlisse = useRef(false);

  const decide = (ok: boolean) => {
    if (sortie) return;
    setSortie(ok ? 1 : -1);
    window.setTimeout(() => onDecide?.(ok), 160);
  };
  const fin = () => {
    if (x0.current === null) return;
    x0.current = null; setLache(true);
    if (Math.abs(dx) > SEUIL) decide(dx > 0); else setDx(0);
  };
  const transform = sortie ? `translateX(${sortie * 700}px) rotate(${sortie * 22}deg)`
    : dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : `translateY(${profondeur * 8}px) scale(${1 - profondeur * 0.03})`;
  const stop = (ev: React.PointerEvent) => ev.stopPropagation();

  const dispo = c.disponibilite ? `dispo dès ${mois(c.disponibilite)}` : "disponibilité inconnue";
  return (
    <article className="card" aria-hidden={profondeur > 0 || undefined} inert={profondeur > 0}
      style={{ transform, zIndex: 10 - profondeur, transition: lache ? "transform .22s var(--ease)" : undefined,
        touchAction: "pan-y", pointerEvents: profondeur > 0 ? "none" : undefined }}
      onPointerDown={(ev) => { x0.current = ev.clientX; aGlisse.current = false; setLache(false); ev.currentTarget.setPointerCapture(ev.pointerId); }}
      onPointerMove={(ev) => { if (x0.current !== null) { setDx(ev.clientX - x0.current); aGlisse.current = true; } }}
      onPointerUp={fin} onPointerCancel={fin}>
      <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL)) }}>OUI</span>
      <span className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -dx / SEUIL)) }}>NON</span>
      <div className="stage">
        <div className="hero">
          <div className="hero-top">
            <button type="button" className="score score-btn" onPointerDown={stop}
              onClick={(ev) => { ev.stopPropagation(); onDetail?.(); }} aria-label="Voir le détail du score">
              <span className="gauge"><b style={{ width: `${e.score}%`, background: teinte(e.score) }} /></span>
              <span className="v" style={{ color: teinte(e.score) }}>{e.score} %</span> compatible
            </button>
            {e.non.length > 0 && <span className="badge-pass">hors de ses critères</span>}
          </div>
          <div className="conf">confiance {conf(e.confiance)} · {e.confiance} % des critères renseignés
            {e.manque.length > 0 && <> · <b style={{ color: "var(--no)" }}>{e.manque.length} compétence{e.manque.length > 1 ? "s" : ""} manquante{e.manque.length > 1 ? "s" : ""}</b></>}
          </div>
          <h2 className="role">{nom(c)}</h2>
          <div className="org">{c.titre} · {c.ville}</div>
        </div>
        <div className="pagebox">
          <div className="page-lead">Compétences vs AVP</div>
          <div className="tags">
            {e.ok.map((x) => <span key={x} className="has">{x}</span>)}
            {c.competences.filter((x) => !e.ok.some((o) => o.toLowerCase() === x.toLowerCase())).map((x) => <span key={x}>{x}</span>)}
            {e.manque.map((x) => <span key={x} className="miss">{x} ?</span>)}
          </div>
        </div>
      </div>
      <div className="facts">
        <div className="line"><em>{c.ville}</em> <span className="dot" /> {dispo}</div>
        <div className="line">
          <em>{c.experienceAnnees === null ? "expérience inconnue" : `${c.experienceAnnees} an${c.experienceAnnees > 1 ? "s" : ""} d’expérience`}</em>
          {c.formations[0] && <> <span className="dot" /> {c.formations[0].diplome}</>}
        </div>
        <div className="line">
          <em>{c.salaireMin ? `${Math.round(c.salaireMin / 1000)} k XPF min.` : "prétentions non annoncées"}</em>
          <span className="dot" /> {a.titre} <span className="dot" /> réf. {a.reference}
        </div>
      </div>
      <div className="coins" onPointerDown={stop}>
        <button type="button" className="retour" disabled={!peutRevenir} onClick={(ev) => { ev.stopPropagation(); onRetour?.(); }}
          aria-label="Revenir sur la dernière décision"><Icone n="undo" /></button>
        <button type="button" className="non" onClick={(ev) => { ev.stopPropagation(); decide(false); }} aria-label="Rejeter"><Icone n="x" /></button>
        <button type="button" className="oui" onClick={(ev) => { ev.stopPropagation(); decide(true); }} aria-label="Présélectionner"><Icone n="check" /></button>
      </div>
    </article>
  );
}

export default function Swipe({ candidatures, candidats, avp, maj }: Ctx) {
  const [filtre, setFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [dernier, setDernier] = useState<string | null>(null);
  const [feuille, setFeuille] = useState(false);

  const atraiter = candidatures.filter((k) => k.statut === "a_traiter");
  const q = recherche.trim().toLowerCase();
  const pile = atraiter.filter((k) => {
    const c = find(candidats, k.candidatId);
    return (filtre === "tous" || k.avpId === filtre) && (!q || `${c ? nom(c) : ""} ${c?.titre ?? ""}`.toLowerCase().includes(q));
  });
  const [courante, suivante] = pile;
  const cc = courante && find(candidats, courante.candidatId);
  const ca = courante && find(avp, courante.avpId);

  const decide = (ok: boolean) => { if (courante) { maj(courante.id, ok ? "preselectionne" : "rejete"); setDernier(courante.id); } };
  const reviens = () => { if (dernier) { maj(dernier, "a_traiter"); setDernier(null); } };
  const rendu = (k: Candidature, profondeur: number) => {
    const c = find(candidats, k.candidatId), a = find(avp, k.avpId);
    return c && a ? (
      <Carte key={k.id} k={k} c={c} a={a} profondeur={profondeur} peutRevenir={Boolean(dernier)}
        onDecide={decide} onRetour={reviens} onDetail={() => setFeuille(true)} />
    ) : null;
  };

  return (
    <div className="stack">
      <div className="filters filtres-avp">
        <input type="search" className="recherche" value={recherche} placeholder="Chercher un candidat, un métier…"
          onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher parmi les candidats" />
        <button className="chip" aria-pressed={filtre === "tous"} onClick={() => setFiltre("tous")}>
          Tous les postes <span className="cpt">{atraiter.length}</span>
        </button>
        {avp.map((a) => (
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
