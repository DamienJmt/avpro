import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { videMatching } from "./matching";
import { ErreurApi } from "./types";
import type { Avp, Candidat, Candidature, Recruteur, Statut } from "./types";
import Connexion from "./screens/Connexion";
import Swipe from "./screens/Swipe";
import AvpList from "./screens/AvpList";
import Candidats from "./screens/Candidats";
import Entretiens from "./screens/Entretiens";
import Profil from "./screens/Profil";
// Pilotage (tableaux de bord Power BI, MS7) désactivé tant que le module n'est pas livré.
// Pour le réactiver : décommenter cet import, l'onglet dans ONGLETS et la ligne {onglet === "pilotage" …} plus bas.
// import Pilotage from "./screens/Pilotage";
import Confirmer from "./screens/Confirmer";
import { find, Icone, nom, Spinner, useSecondes, type EnAttente } from "./screens/shared";

type Onglet = "swipe" | "avp" | "candidats" | "entretiens" | "pilotage" | "profil";
const ONGLETS: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: "swipe", icone: "swipe", nom: "Swipe" },
  { cle: "avp", icone: "briefcase", nom: "AVP" },
  { cle: "candidats", icone: "users", nom: "Candidats" },
  { cle: "entretiens", icone: "calendar", nom: "Entretiens" },
  // { cle: "pilotage", icone: "chart", nom: "Pilotage" },   // désactivé, voir l'import plus haut
  { cle: "profil", icone: "user", nom: "Profil" },
];

/* Une décision du recruteur est définitive dans l'API et le candidat la voit
   aussitôt : elle n'est envoyée qu'après ce délai, annulable jusque-là. */
const DELAI = 30_000;

export default function App() {
  const [moi, setMoi] = useState<Recruteur | null>(() => api.moi());
  const [onglet, setOnglet] = useState<Onglet>("swipe");
  const [chargement, setChargement] = useState(false);
  const [panne, setPanne] = useState<string | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);
  const [avp, setAvp] = useState<Avp[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [attente, setAttente] = useState<EnAttente[]>([]);
  const [aConfirmer, setAConfirmer] = useState<number | null>(null);
  const minuteurs = useRef(new Map<number, { t: number; ok: boolean }>());

  const charge = useCallback(async () => {
    setChargement(true);
    setPanne(null);
    try {
      const d = await api.chargerDonnees();
      setAvp(d.avp); setCandidats(d.candidats); setCandidatures(d.candidatures);
    } catch (e) {
      setPanne(e instanceof ErreurApi ? e.message : "Les données n'ont pas pu être chargées.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (!moi) return;
    void charge();
  }, [moi, charge]);

  // Jeton expiré (1 h) : retour à la connexion. Les décisions en attente ne peuvent plus partir.
  useEffect(() => {
    const sort = () => {
      for (const m of minuteurs.current.values()) window.clearTimeout(m.t);
      if (minuteurs.current.size) setAlerte("Session expirée : les décisions encore en attente n'ont pas été envoyées.");
      minuteurs.current.clear();
      setAttente([]);
      setMoi(null);
    };
    window.addEventListener("avpro:session-expiree", sort);
    return () => window.removeEventListener("avpro:session-expiree", sort);
  }, []);

  // Page fermée ou rechargée : les décisions en attente partent quand même.
  useEffect(() => {
    const part = () => {
      for (const [id, m] of minuteurs.current) api.decideAuDepart(id, m.ok);
      minuteurs.current.clear();
    };
    window.addEventListener("pagehide", part);
    return () => window.removeEventListener("pagehide", part);
  }, []);

  const maj = (id: number, statut: Statut) =>
    setCandidatures((l) => l.map((c) => (c.id === id ? { ...c, statut } : c)));

  const envoie = useCallback(async (id: number, ok: boolean) => {
    minuteurs.current.delete(id);
    setAttente((l) => l.filter((x) => x.id !== id));
    try {
      await api.decide(id, ok);
    } catch (e) {
      setAlerte(e instanceof ErreurApi ? e.message : "La décision n'a pas pu être envoyée.");
      // On relit la candidature : retirée par le candidat, déjà traitée, ou toujours à traiter.
      try {
        const k = await api.candidature(id);
        setCandidatures((l) => l.map((c) => (c.id === id ? k : c)));
      } catch {
        setCandidatures((l) => l.map((c) => (c.id === id ? { ...c, statut: "a_traiter" } : c)));
      }
    }
  }, []);

  const decider = (id: number, ok: boolean) => {
    const avant = minuteurs.current.get(id);
    if (avant) window.clearTimeout(avant.t);
    maj(id, ok ? "preselectionne" : "rejete");
    const t = window.setTimeout(() => void envoie(id, ok), DELAI);
    minuteurs.current.set(id, { t, ok });
    setAttente((l) => [...l.filter((x) => x.id !== id), { id, ok, echeance: Date.now() + DELAI }]);
  };

  const annuler = (id: number) => {
    const m = minuteurs.current.get(id);
    if (!m) return;
    window.clearTimeout(m.t);
    minuteurs.current.delete(id);
    setAttente((l) => l.filter((x) => x.id !== id));
    maj(id, "a_traiter");
  };

  const toutEnvoyer = async () => {
    const l = [...minuteurs.current];
    for (const [, m] of l) window.clearTimeout(m.t);
    await Promise.all(l.map(([id, m]) => envoie(id, m.ok)));
  };

  const deconnexion = async () => {
    await toutEnvoyer();
    api.deconnexion();
    setMoi(null);
    setAvp([]); setCandidats([]); setCandidatures([]);
    setOnglet("swipe");
  };

  const entretien = async (id: number, aProgrammer: boolean) => {
    try {
      const k = await api.entretien(id, aProgrammer);
      setCandidatures((l) => l.map((c) => (c.id === id ? k : c)));
    } catch (e) {
      setAlerte(e instanceof ErreurApi ? e.message : "L'entretien n'a pas pu être enregistré.");
    }
  };

  if (!moi) return <>{alerte && <Alerte texte={alerte} onFerme={() => setAlerte(null)} />}<Connexion onEntre={(r) => { setAlerte(null); setMoi(r); }} /></>;

  const ctx = { avp, candidats, candidatures, attente, decider, annuler, confirmer: setAConfirmer };
  const aTraiter = candidatures.filter((k) => k.statut === "a_traiter").length;
  const k = aConfirmer !== null ? find(candidatures, aConfirmer) : undefined;
  const derniere = attente[attente.length - 1];

  return (
    <div className="app">
      <header className="topbar">
        <span className="mark">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`} alt="Adopte un Job" className="logo" width={168} height={36} />
        </span>
        <span className="tag-demo">Espace recruteur</span>
        <span className="spacer" />
        <button className="btn-mini" onClick={() => { videMatching(); void charge(); }} disabled={chargement}>
          {chargement ? <><Spinner /> Chargement</> : "Actualiser"}
        </button>
        <button className="iconbtn sortie-haut" onClick={() => void deconnexion()} title="Se déconnecter" aria-label="Se déconnecter">
          <Icone n="sortie" />
        </button>
      </header>

      <div className="screen" id={onglet === "swipe" ? "ec-swipe" : undefined}>
        {panne ? (
          <div className="pad"><div className="pal manque"><b>Ça n’a pas marché</b>{panne}</div>
            <button className="btn primaire" style={{ marginTop: "var(--s4)" }} onClick={() => void charge()}>Réessayer</button></div>
        ) : chargement && !candidatures.length && !avp.length ? (
          <p className="attente centre" role="status"><Spinner grand /> Chargement des candidatures…</p>
        ) : (<>
          {onglet === "swipe" && <Swipe {...ctx} />}
          {onglet === "avp" && <AvpList {...ctx} />}
          {onglet === "candidats" && <Candidats {...ctx} />}
          {onglet === "entretiens" && <Entretiens {...ctx} retirer={(id) => void entretien(id, false)} />}
          {/* {onglet === "pilotage" && <Pilotage />} — désactivé, voir l'import en haut du fichier */}
          {onglet === "profil" && <Profil moi={moi} />}
        </>)}
        {k && (
          <Confirmer candidat={find(candidats, k.candidatId)} avp={find(avp, k.avpId)}
            onFerme={() => setAConfirmer(null)}
            onValide={() => { void entretien(k.id, true); setAConfirmer(null); setOnglet("entretiens"); }} />
        )}
      </div>

      {derniere && (
        <BarreAttente e={derniere} autres={attente.length - 1}
          qui={nom(find(candidats, find(candidatures, derniere.id)?.candidatId ?? 0))}
          onAnnule={() => annuler(derniere.id)} onEnvoie={() => void toutEnvoyer()} />
      )}
      {alerte && <Alerte texte={alerte} onFerme={() => setAlerte(null)} />}

      <nav className="nav">
        {ONGLETS.map((o) => (
          <button key={o.cle} onClick={() => setOnglet(o.cle)} aria-current={onglet === o.cle ? "page" : undefined}>
            <Icone n={o.icone} />
            {o.cle === "candidats" && aTraiter > 0 && <span className="badge">{aTraiter}</span>}
            {o.nom}
          </button>
        ))}
        {/* sur grand écran, la déconnexion vit en bas du rail ; sur téléphone, dans la barre du haut (comme l'app candidat) */}
        <button className="nav-sortie" onClick={() => void deconnexion()} title="Se déconnecter">
          <Icone n="sortie" />
          Déconnexion
        </button>
      </nav>
    </div>
  );
}

function BarreAttente({ e, autres, qui, onAnnule, onEnvoie }: {
  e: EnAttente; autres: number; qui: string; onAnnule: () => void; onEnvoie: () => void;
}) {
  const s = useSecondes(e.echeance);
  return (
    <div className="barre-attente" role="status">
      <span><b>{qui}</b> {e.ok ? "présélectionné(e)" : "écarté(e)"} · envoi dans {s} s
        {autres > 0 && <> · {autres} autre{autres > 1 ? "s" : ""} en attente</>}</span>
      <button className="btn-mini" onClick={onAnnule}>Annuler</button>
      <button className="btn-mini" onClick={onEnvoie}>Envoyer maintenant</button>
    </div>
  );
}

function Alerte({ texte, onFerme }: { texte: string; onFerme: () => void }) {
  return (
    <div className="alerte pal manque" role="alert">
      <span>{texte}</span>
      <button className="btn-mini" onClick={onFerme} aria-label="Fermer">OK</button>
    </div>
  );
}
