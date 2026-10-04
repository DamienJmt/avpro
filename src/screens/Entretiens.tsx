import { find, Icone, initiales, nom, Vide, type Ctx } from "./shared";

export default function Entretiens({ candidatures, candidats, avp, maj }: Ctx) {
  const liste = candidatures.filter((k) => k.statut === "entretien");
  return (
    <div className="pad" id="ec-entretiens">
      <h2>Entretiens</h2>
      <p className="lead">Les entretiens validés : le poste et le candidat reçu, sur un seul écran.</p>
      {liste.length === 0 && <Vide titre="Aucun entretien validé" texte="Valide-en un depuis l'onglet Candidats, une fois un profil présélectionné." />}
      {liste.map((k) => {
        const a = find(avp, k.avpId);
        const c = find(candidats, k.candidatId);
        return (
          <div key={k.id} className="tile entretien">
            <div className="duo">
              <span className="pastille eux"><Icone n="briefcase" /></span>
              <span className="lien"><Icone n="calendar" /></span>
              <span className="pastille moi">{initiales(c)}</span>
            </div>
            <b>{nom(c)}</b>
            <span>{a?.titre} · {a?.direction}</span>
            <div className="actes"><button onClick={() => maj(k.id, "preselectionne")}>Annuler l'entretien</button></div>
          </div>
        );
      })}
    </div>
  );
}
