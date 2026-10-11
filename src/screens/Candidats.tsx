import { useState } from "react";
import { classeEtat, find, LIBELLE, nom, scoreDe, titreAvp, useSecondes, Vide, type Ctx, type EnAttente } from "./shared";

const ONGLETS = [
  { id: "a_traiter", label: "À traiter" },
  { id: "preselectionne", label: "Présélectionné" },
  { id: "toutes", label: "Toutes" },
] as const;
type Onglet = (typeof ONGLETS)[number]["id"];

function AnnulerAttente({ e, onAnnule }: { e: EnAttente; onAnnule: () => void }) {
  const s = useSecondes(e.echeance);
  return <button className="fort" onClick={onAnnule}>Annuler ({s} s)</button>;
}

export default function Candidats({ candidatures, candidats, avp, attente, decider, annuler, confirmer }: Ctx) {
  const [onglet, setOnglet] = useState<Onglet>("a_traiter");
  const compte = (o: Onglet) => candidatures.filter((k) => o === "toutes" || k.statut === o).length;
  const liste = candidatures.filter((k) => onglet === "toutes" || k.statut === onglet);

  return (
    <div className="pad" id="ec-candidats">
      <h2>Candidats</h2>
      <p className="lead">
        Le suivi des candidatures reçues et de tes décisions. Une décision part après 30 secondes :
        ensuite, elle est définitive et le candidat la voit.
      </p>
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
        const s = scoreDe(k, candidats, avp);
        const enAttente = attente.find((x) => x.id === k.id);
        return (
          <div key={k.id} className={`item${k.statut === "retiree" ? " closed" : ""}`} style={{ cursor: "default" }}>
            <div className="sc">{s ?? "–"}<small>SCORE</small></div>
            <div>
              <h3>{nom(c)}</h3>
              <div className="meta">{[c?.titre, c?.ville].filter(Boolean).join(" · ") || c?.email}</div>
              <div className="quand">Poste : {titreAvp(k, avp)}</div>
              <div className="mtags">{c?.competences.slice(0, 4).map((x) => <span key={x}>{x}</span>)}</div>
              <span className={`etat ${classeEtat(k.statut)}`}>
                {LIBELLE[k.statut]}{enAttente && " · pas encore envoyé"}
              </span>
              <div className="actes">
                {enAttente
                  ? <AnnulerAttente e={enAttente} onAnnule={() => annuler(k.id)} />
                  : <>
                      {k.statut === "a_traiter" && <>
                        <button className="fort" onClick={() => decider(k.id, true)}>Présélectionner</button>
                        <button onClick={() => decider(k.id, false)}>Rejeter</button>
                      </>}
                      {k.statut === "preselectionne" && <button className="fort" onClick={() => confirmer(k.id)}>Valider un entretien</button>}
                    </>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
