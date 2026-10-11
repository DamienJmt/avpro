import { useState } from "react";
import { evalue } from "../scoring";
import { find, Icone, nom, titreAvp, Vide, type Ctx } from "./shared";

const NIVEAUX: Record<number, string> = { 1: "Bac", 2: "Bac+2", 3: "Bac+3", 4: "Bac+5" };
const date = (d: string) => new Date(d).toLocaleDateString("fr-FR");
const mois = (d: string) => new Date(`${d}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

/** Une ligne du récapitulatif : rien n'est affiché quand la valeur manque. */
function Ligne({ dt, dd }: { dt: string; dd: React.ReactNode }) {
  return dd ? <div><dt>{dt}</dt><dd>{dd}</dd></div> : null;
}

export default function Entretiens({ candidatures, candidats, avp, retirer }: Ctx & { retirer: (id: number) => void }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const liste = candidatures.filter((k) => k.statut === "entretien");
  return (
    <div className="pad" id="ec-entretiens">
      <h2>Entretiens</h2>
      <p className="lead">Les entretiens à programmer. Touche une ligne pour revoir le poste et la candidature.</p>
      {liste.length === 0 && <Vide titre="Aucun entretien validé" texte="Valide-en un depuis l'onglet Candidats, une fois un profil présélectionné." />}
      {liste.map((k) => {
        const a = find(avp, k.avpId);
        const c = find(candidats, k.candidatId);
        const e = a && c ? evalue(c, a) : null;
        const deplie = ouvert === k.id;
        return (
          <div key={k.id} className={`item${deplie ? " on" : ""}`} onClick={() => setOuvert(deplie ? null : k.id)}>
            <div className="sc">{e?.score ?? "–"}<small>SCORE</small></div>
            <div>
              <h3>{nom(c)}</h3>
              <div className="meta">{titreAvp(k, avp)}{a?.direction && ` · ${a.direction}`}</div>
              <div className="quand">Mis à jour le {date(k.depuis)}</div>
              {deplie && (
                <div className="recap" onClick={(ev) => ev.stopPropagation()}>
                  <section>
                    <h4>Le poste</h4>
                    <dl>
                      <Ligne dt="Intitulé" dd={a?.titre ?? k.avpTitre} />
                      <Ligne dt="Référence" dd={a?.reference ?? k.avpReference} />
                      <Ligne dt="Direction" dd={[a?.direction, a?.unite].filter(Boolean).join(" · ")} />
                      <Ligne dt="Lieu" dd={a && [a.ville, a.zone].filter(Boolean).join(" · ")} />
                      <Ligne dt="Contrat" dd={a?.contrat} />
                      <Ligne dt="Début" dd={a?.debut ? mois(a.debut) : a?.debutTexte} />
                      <Ligne dt="Date limite" dd={a?.datelimite && date(a.datelimite)} />
                    </dl>
                  </section>
                  <section>
                    <h4>La candidature</h4>
                    <dl>
                      <Ligne dt="Profil" dd={c?.titre} />
                      <Ligne dt="Contact" dd={c && [c.email, c.telephone].filter(Boolean).join(" · ")} />
                      <Ligne dt="Expérience" dd={c?.experienceAnnees != null && `${c.experienceAnnees} an${c.experienceAnnees > 1 ? "s" : ""}`} />
                      <Ligne dt="Formation" dd={c?.niveauFormation && NIVEAUX[c.niveauFormation]} />
                      <Ligne dt="Disponible" dd={c?.disponibilite && `dès ${mois(c.disponibilite)}`} />
                      <Ligne dt="Compatibilité" dd={e?.score != null && `${e.score} % · ${e.ok.length}/${a?.competences.length ?? 0} compétences attendues`} />
                    </dl>
                    {c && c.competences.length > 0 && (
                      <div className="mtags">{c.competences.slice(0, 6).map((x) => <span key={x}>{x}</span>)}</div>
                    )}
                  </section>
                </div>
              )}
              <div className="actes" onClick={(ev) => ev.stopPropagation()}>
                <button onClick={() => retirer(k.id)}>Annuler l'entretien</button>
              </div>
            </div>
            <span className="chev"><Icone n="chev" /></span>
          </div>
        );
      })}
    </div>
  );
}
