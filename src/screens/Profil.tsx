import { useState } from "react";
import { api } from "../api";
import { ErreurApi, type Recruteur } from "../types";
import { Spinner } from "./shared";

/* Mon compte, repris de l'app candidat (ecrans/MonCompte.tsx) : l'adresse du
   compte, et le changement de mot de passe par un code envoyé à cette adresse
   (forgot-password puis reset-password). L'API ne permet pas de changer d'adresse. */
export default function Profil({ moi }: { moi: Recruteur }) {
  const [ouvert, setOuvert] = useState(false);
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [code, setCode] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ferme = () => { setOuvert(false); setCodeEnvoye(false); setCode(""); setNouveau(""); setVoir(false); setErreur(null); };

  const agit = async (geste: () => Promise<void>, echec: string) => {
    setErreur(null); setInfo(null); setEnvoi(true);
    try {
      await geste();
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : echec);
    } finally {
      setEnvoi(false);
    }
  };

  const demandeCode = () => void agit(async () => {
    await api.oubli(moi.email);
    setCodeEnvoye(true);
  }, "Le code n’a pas pu être envoyé. Réessaie dans un instant.");

  const confirme = (e: React.FormEvent) => {
    e.preventDefault();
    void agit(async () => {
      await api.oubliConfirme(code.trim(), nouveau);
      ferme();
      setInfo("Mot de passe changé. Utilise-le à ta prochaine connexion.");
    }, "Le changement n’a pas abouti.");
  };

  return (
    <div className="pad" id="ec-profil">
      <h2>Profil</h2>
      <section className="mcompte">
        <h3>Mon compte</h3>
        <dl className="mc-ligne">
          <dt>Adresse e-mail</dt>
          <dd>{moi.email}</dd>
        </dl>

        {!ouvert && (
          <div className="mc-actions">
            <button className="btn-mini" onClick={() => { ferme(); setOuvert(true); }}>Changer mon mot de passe</button>
          </div>
        )}

        {info && <div className="pal ok"><b>C’est fait</b>{info}</div>}

        {ouvert && !codeEnvoye && (
          <div className="pform mc-form">
            <p className="pa">
              On envoie un code à <b>{moi.email}</b>. Il sert à choisir ton nouveau mot de passe, juste ici.
            </p>
            {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
            <div className="mc-actions">
              <button className="btn primaire" type="button" disabled={envoi} onClick={demandeCode}>
                {envoi ? <><Spinner />Envoi…</> : "Recevoir le code"}
              </button>
              <button className="btn" type="button" onClick={ferme}>Annuler</button>
            </div>
          </div>
        )}

        {ouvert && codeEnvoye && (
          <form className="pform mc-form" onSubmit={confirme}>
            <p className="pa">Code envoyé à <b>{moi.email}</b>. Pense à regarder dans les indésirables.</p>
            <label className="pf">
              <span className="pl">Code reçu</span>
              <input type="text" value={code} required autoComplete="one-time-code" onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="pf">
              <span className="pl">Nouveau mot de passe</span>
              <span className="mdp">
                <input type={voir ? "text" : "password"} value={nouveau} required minLength={12} autoComplete="new-password"
                  onChange={(e) => setNouveau(e.target.value)} />
                <button type="button" className="btn-mini" onClick={() => setVoir(!voir)} aria-pressed={voir}>
                  {voir ? "Masquer" : "Afficher"}
                </button>
              </span>
              <span className="pa">Douze caractères au minimum.</span>
            </label>
            {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
            <div className="mc-actions">
              <button className="btn primaire" type="submit" disabled={envoi}>
                {envoi ? <><Spinner />Un instant…</> : "Changer le mot de passe"}
              </button>
              <button className="btn-mini" type="button" disabled={envoi} onClick={demandeCode}>Renvoyer un code</button>
              <button className="btn" type="button" onClick={ferme}>Annuler</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
