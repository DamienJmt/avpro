import { useState } from "react";
import { classeEtat, find, LIBELLE, nom, scoreDe, Vide, type Ctx } from "./shared";

const ONGLETS = [
  { id: "a_traiter", label: "À traiter" },
  { id: "preselectionne", label: "Présélectionné" },
  { id: "toutes", label: "Toutes" },
] as const;
type Onglet = (typeof ONGLETS)[number]["id"];

export default function Candidats({ candidatures, candidats, avp, maj, confirmer }: Ctx) {
  const [onglet, setOnglet] = useState<Onglet>("a_traiter");
  const compte = (o: Onglet) => candidatures.filter((k) => o === "toutes" || k.statut === o).length;
  const liste = candidatures.filter((k) => onglet === "toutes" || k.statut === onglet);

  return (
    <div className="pad" id="ec-candidats">
      <h2>Candidats</h2>
      <p className="lead">Le suivi des candidatures reçues et de tes décisions au Swipe.</p>
      <div className="seg" role="tablist">
        {ONGLETS.map((o) => (
          <button key={o.id} role="tab" aria-selected={onglet === o.id} onClick={() => setOnglet(o.id)}>
            {o.label} <span className="n">{compte(o.id)}</span>
          </button>
        ))}
      </div>
      {liste.length === 0 && <Vide titre="Rien ici pour l'instant" texte="Les candidatures apparaîtront dans cet onglet." />}
      {liste.map((k) => {
        const c = find(candidats, k.candidatId);
        return (
          <div key={k.id} className="item" style={{ cursor: "default" }}>
            <div className="sc">{scoreDe(k, candidats, avp)}<small>SCORE</small></div>
            <div>
              <h3>{nom(c)}</h3>
              <div className="meta">{c?.titre} · {c?.ville}</div>
              <div className="quand">Poste : {find(avp, k.avpId)?.titre}</div>
              <div className="mtags">{c?.competences.slice(0, 4).map((x) => <span key={x}>{x}</span>)}</div>
              <span className={`etat ${classeEtat(k.statut)}`}>{LIBELLE[k.statut]}</span>
              <div className="actes">
                {k.statut === "a_traiter" && <>
                  <button className="fort" onClick={() => maj(k.id, "preselectionne")}>Présélectionner</button>
                  <button onClick={() => maj(k.id, "rejete")}>Rejeter</button>
                </>}
                {k.statut === "preselectionne" && <button className="fort" onClick={() => confirmer(k.id)}>Valider un entretien</button>}
                {k.statut === "rejete" && <button onClick={() => maj(k.id, "a_traiter")}>Remettre à traiter</button>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
