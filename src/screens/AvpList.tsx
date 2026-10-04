import { useState } from "react";
import { Icone, type Ctx } from "./shared";

export default function AvpList({ avp, candidatures }: Ctx) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  return (
    <div className="pad" id="ec-avp">
      <h2>Avis de vacance de poste</h2>
      <p className="lead">Les postes à pourvoir. Touche un avis pour en voir le détail.</p>
      {avp.map((a) => {
        const n = candidatures.filter((k) => k.avpId === a.id).length;
        return (
          <div key={a.id} className="item" onClick={() => setOuvert(ouvert === a.id ? null : a.id)}>
            <div className="sc">{n}<small>CAND.</small></div>
            <div>
              <h3>{a.titre}</h3>
              <div className="meta">{a.direction} · {a.ville} · {a.contrat}</div>
              <div className="quand">Date limite : {new Date(a.datelimite).toLocaleDateString("fr-FR")}</div>
              {ouvert === a.id && <p className="detail">{a.description}</p>}
            </div>
            <span className="chev"><Icone n="chev" /></span>
          </div>
        );
      })}
    </div>
  );
}
