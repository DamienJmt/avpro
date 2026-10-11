import { useState } from "react";
import { Icone, Vide, type Ctx } from "./shared";

const date = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export default function AvpList({ avp, candidatures }: Ctx) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  // Les postes ouverts d'abord, les plus proches de leur date limite en tête.
  const tries = [...avp].sort((x, y) => Number(y.ouvert) - Number(x.ouvert) || (x.datelimite ?? "9999").localeCompare(y.datelimite ?? "9999"));
  return (
    <div className="pad" id="ec-avp">
      <h2>Avis de vacance de poste</h2>
      <p className="lead">Les postes publiés par l’OPT-NC. Touche un avis pour en voir le détail.</p>
      {avp.length === 0 && <Vide titre="Aucun AVP" texte="Aucun avis de vacance de poste publié pour l’instant." />}
      {tries.map((a) => {
        const l = candidatures.filter((k) => k.avpId === a.id && k.statut !== "retiree");
        const n = l.filter((k) => k.statut === "a_traiter").length;
        return (
          <div key={a.id} className={`item${a.ouvert ? "" : " closed"}`} onClick={() => setOuvert(ouvert === a.id ? null : a.id)}>
            <div className="sc">{l.length}<small>CAND.</small></div>
            <div>
              <h3>{a.titre}</h3>
              <div className="meta">{[a.direction, a.ville, a.contrat].filter(Boolean).join(" · ")}</div>
              <div className="quand">
                Réf. {a.reference} · {a.datelimite ? `${a.ouvert ? "Date limite" : "Clos depuis le"} ${date(a.datelimite)}` : "Sans date limite"}
                {n > 0 && <> · <b>{n} à traiter</b></>}
              </div>
              {ouvert === a.id && (
                <div className="detail">
                  {a.metier && <p><b>Métier :</b> {a.metier}{a.unite && ` · ${a.unite}`}</p>}
                  {a.description && <p>{a.description}</p>}
                  {a.responsabilites.length > 0 && <ul className="liste">{a.responsabilites.map((x) => <li key={x}>{x}</li>)}</ul>}
                  {a.debutTexte && <p><b>Début :</b> {a.debutTexte}</p>}
                </div>
              )}
            </div>
            <span className="chev"><Icone n="chev" /></span>
          </div>
        );
      })}
    </div>
  );
}
