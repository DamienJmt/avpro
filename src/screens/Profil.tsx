import { useState } from "react";
import type { Employeur } from "../types";

const CHAMPS: [keyof Employeur, string][] = [
  ["organisme", "Organisme"], ["contact", "Contact"], ["email", "E-mail"], ["telephone", "Téléphone"],
];

export default function Profil({ employeur, onChange }: { employeur: Employeur; onChange: (e: Employeur) => void }) {
  const [brouillon, setBrouillon] = useState(employeur);
  const [ok, setOk] = useState(false);
  return (
    <div className="pad" id="ec-profil">
      <h2>Profil</h2>
      <p className="lead">Les informations de compte et les coordonnées de l'employeur.</p>
      <div className="pform">
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
