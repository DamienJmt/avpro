import { Vide } from "./shared";

/* Accueillera les tableaux de bord Power BI d'un autre groupe. */
export default function Statistiques() {
  return (
    <div className="pad" id="ec-stats">
      <h2>Statistiques</h2>
      <p className="lead">Les tableaux de bord du recrutement.</p>
      <Vide titre="Section en cours de construction" texte="Cette section est en cours de construction. Les statistiques arriveront bientôt." />
    </div>
  );
}
