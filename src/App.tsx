import { useEffect, useState } from "react";
import { chargerDonnees } from "./api";
import type { Avp, Candidat, Candidature, Employeur, Statut } from "./types";
import Swipe from "./screens/Swipe";
import AvpList from "./screens/AvpList";
import Candidats from "./screens/Candidats";
import Entretiens from "./screens/Entretiens";
import Profil from "./screens/Profil";
import Confirmer from "./screens/Confirmer";
import { find, Icone } from "./screens/shared";

type Onglet = "swipe" | "avp" | "candidats" | "entretiens" | "profil";
const ONGLETS: { cle: Onglet; icone: string; nom: string }[] = [
  { cle: "swipe", icone: "swipe", nom: "Swipe" },
  { cle: "avp", icone: "briefcase", nom: "AVP" },
  { cle: "candidats", icone: "users", nom: "Candidats" },
  { cle: "entretiens", icone: "calendar", nom: "Entretiens" },
  { cle: "profil", icone: "user", nom: "Profil" },
];

export default function App() {
  const [onglet, setOnglet] = useState<Onglet>("swipe");
  const [avp, setAvp] = useState<Avp[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const [employeur, setEmployeur] = useState<Employeur>({
    organisme: "OPT-NC", contact: "Service recrutement", email: "recrutement@opt.nc", telephone: "+687 00 00 00",
  });

  useEffect(() => {
    chargerDonnees().then((d) => { setAvp(d.avp); setCandidats(d.candidats); setCandidatures(d.candidatures); });
  }, []);

  const maj = (id: string, statut: Statut) =>
    setCandidatures((l) => l.map((c) => (c.id === id ? { ...c, statut } : c)));
  const ctx = { avp, candidats, candidatures, maj, confirmer: setAConfirmer };
  const aTraiter = candidatures.filter((k) => k.statut === "a_traiter").length;
  const k = aConfirmer ? find(candidatures, aConfirmer) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <span className="mark">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`} alt="Adopte un Job" className="logo" width={168} height={36} />
        </span>
        <span className="tag-demo">Espace recruteur</span>
        <span className="spacer" />
      </header>

      <div className="screen" id={onglet === "swipe" ? "ec-swipe" : undefined}>
        {onglet === "swipe" && <Swipe {...ctx} />}
        {onglet === "avp" && <AvpList {...ctx} />}
        {onglet === "candidats" && <Candidats {...ctx} />}
        {onglet === "entretiens" && <Entretiens {...ctx} />}
        {onglet === "profil" && <Profil employeur={employeur} onChange={setEmployeur} />}
        {k && (
          <Confirmer candidat={find(candidats, k.candidatId)} avp={find(avp, k.avpId)}
            onFerme={() => setAConfirmer(null)}
            onValide={() => { maj(k.id, "entretien"); setAConfirmer(null); setOnglet("entretiens"); }} />
        )}
      </div>

      <nav className="nav">
        {ONGLETS.map((o) => (
          <button key={o.cle} onClick={() => setOnglet(o.cle)} aria-current={onglet === o.cle ? "page" : undefined}>
            <Icone n={o.icone} />
            {o.cle === "candidats" && aTraiter > 0 && <span className="badge">{aTraiter}</span>}
            {o.nom}
          </button>
        ))}
      </nav>
    </div>
  );
}
