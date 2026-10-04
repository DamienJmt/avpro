import type { Avp, Candidat } from "../types";
import { nom } from "./shared";

interface Props { candidat?: Candidat; avp?: Avp; onValide: () => void; onFerme: () => void }

/* Simple confirmation : l'organisation de l'entretien (date, lieu) n'est pas le rôle de l'application. */
export default function Confirmer({ candidat, avp, onValide, onFerme }: Props) {
  return (
    <div className="sheet" onClick={onFerme}>
      <div className="sheet-box" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="poignee" />
        <div className="eyebrow">Entretien</div>
        <h2>Valider l'entretien ?</h2>
        <p className="qui">
          Voulez-vous valider l'entretien de <b>{nom(candidat)}</b> pour le poste <b>{avp?.titre}</b> ?
        </p>
        <div className="btns">
          <button className="btn primaire" onClick={onValide}>Valider l'entretien</button>
          <button className="btn" onClick={onFerme}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
