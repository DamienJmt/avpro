import { useState } from "react";
import type { Employeur, Recruteur } from "../types";

const CHAMPS: [keyof Employeur, string][] = [
  ["organisme", "Organisme"], ["contact", "Contact"], ["email", "E-mail"], ["telephone", "Téléphone"],
];

export default function Profil({ moi, employeur, onChange }: {
  moi: Recruteur; employeur: Employeur; onChange: (e: Employeur) => void;
}) {
  const [brouillon, setBrouillon] = useState(employeur);
  const [ok, setOk] = useState(false);
  return (
    <div className="pad" id="ec-profil">
      <h2>Profil</h2>
      <p className="lead">Connecté avec <b>{moi.email}</b>.</p>
      <div className="pform">
        <p className="pa" style={{ margin: 0 }}>
          Les coordonnées de l’employeur ne sont pas encore dans l’API de l’équipe : elles sont gardées dans ce navigateur.
        </p>
        <div className="pgrid">
          {CHAMPS.map(([k, label]) => (
            <label key={k} className="pf"><span className="pl">{label}</span>
              <input value={brouillon[k]} onChange={(e) => { setOk(false); setBrouillon({ ...brouillon, [k]: e.target.value }); }} />
            </label>
          ))}
        </div>
        <div>
          <button className="btn-fort" onClick={() => { onChange(brouillon); setOk(true); }}>Enregistrer</button>
          {ok && <span className="etat match" style={{ marginLeft: "var(--s3)" }}>Enregistré</span>}
        </div>
      </div>
    </div>
  );
}
