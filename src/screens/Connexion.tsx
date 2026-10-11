import { useState } from "react";
import { api } from "../api";
import { ErreurApi, type Recruteur } from "../types";
import { Spinner } from "./shared";

/* Entrée de l'espace recruteur : même écran que l'app candidat, sans inscription.
   Les comptes vivent dans l'API de l'équipe, et un compte recruteur ne peut être
   créé que par un recruteur ou un admin (`/auth/register`). */
export default function Connexion({ onEntre }: { onEntre: (r: Recruteur) => void }) {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      onEntre(await api.connexion(email, mdp));
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Quelque chose a échoué. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="accueil">
      <div className="accueil-in">
        <span className="mark grand">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`} alt="Adopte un Job" className="logo" width={224} height={48} />
        </span>
        <h1>Espace recruteur</h1>
        <p className="lead">
          Les candidatures reçues sur vos avis de vacance de poste : <b>à droite pour présélectionner</b>, à gauche pour écarter.
        </p>

        <form className="pform" onSubmit={(e) => void soumets(e)}>
          <label className="pf">
            <span className="pl">Adresse e-mail</span>
            <input type="email" value={email} required autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="pf">
            <span className="pl">Mot de passe</span>
            <input type="password" value={mdp} required autoComplete="current-password" onChange={(e) => setMdp(e.target.value)} />
          </label>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <button className="btn primaire" type="submit" disabled={envoi}>
            {envoi ? <><Spinner />Un instant…</> : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
