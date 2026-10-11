import { find, Icone, initiales, nom, titreAvp, Vide, type Ctx } from "./shared";

export default function Entretiens({ candidatures, candidats, avp, retirer }: Ctx & { retirer: (id: number) => void }) {
  const liste = candidatures.filter((k) => k.statut === "entretien");
  return (
    <div className="pad" id="ec-entretiens">
      <h2>Entretiens</h2>
      <p className="lead">Les entretiens validés : le poste et le candidat reçu, sur un seul écran.</p>
      {/* À retirer quand l'API aura le statut ENTRETIEN (voir api.valideEntretien). */}
      <p className="pa">
        Le statut « entretien » n’existe pas encore dans l’API de l’équipe : ces validations sont gardées dans ce
        navigateur, et le candidat ne les voit pas.
      </p>
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
            <span>{titreAvp(k, avp)}{a?.direction && ` · ${a.direction}`}</span>
            {c && <span className="quand">{[c.email, c.telephone].filter(Boolean).join(" · ")}</span>}
            <div className="actes"><button onClick={() => retirer(k.id)}>Annuler l'entretien</button></div>
          </div>
        );
      })}
    </div>
  );
}
