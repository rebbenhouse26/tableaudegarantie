import { useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'
import { api, ApiError } from '../api/client'

export default function LandingPage() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const f = e.currentTarget
    const val = (id: string) => (f.elements.namedItem(id) as HTMLInputElement | null)?.value ?? ''
    try {
      await api.post('/leads', {
        nom: val('nom'),
        cabinet: val('cab'),
        email: val('email'),
        tel: val('tel'),
        profil: val('type'),
        taille: val('taille'),
        message: val('msg'),
      })
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'envoyer la demande. Réessayez plus tard.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lp">
      <nav>
        <div className="container nav-in">
          <div className="brand">
            <div className="logo">GA</div>
            Garant-AI
          </div>
          <div className="nav-links">
            <a href="#probleme">Le problème</a>
            <a href="#fonctionnement">Fonctionnement</a>
            <a href="#avis">Avis</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#faq">FAQ</a>
            <Link to="/connexion">Connexion</Link>
            <Link className="btn" to="/app">
              Essayer la démo
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="container">
          <p className="eyebrow">Acceptation des devis dentaires</p>
          <h1>
            Faites <span>accepter plus de devis</span> en montrant son reste à charge à chaque
            patient.
          </h1>
          <p className="lead">
            Garant-AI lit la mutuelle du patient et génère un <b>devis optimisé</b> : le meilleur
            traitement, avec une <b>prise en charge maximale</b> et une <b>facilité de paiement</b>. Le
            patient comprend, accepte et signe — souvent dès le rendez‑vous.
          </p>
          <div className="hero-cta">
            <Link className="btn lg" to="/app">
              Essayer la démo interactive
            </Link>
            <a className="btn lg ghost" href="#fonctionnement">
              Voir comment ça marche
            </a>
          </div>
          <div className="social-proof">
            <div className="avatars">
              <span style={{ background: '#2f5fe0' }}>AD</span>
              <span style={{ background: '#16a34a' }}>SM</span>
              <span style={{ background: '#8b5cf6' }}>JL</span>
              <span style={{ background: '#f59e0b' }}>CB</span>
              <span className="more">+</span>
            </div>
            <div className="social-txt">
              <div className="stars">★★★★★</div>
              <span>Conçu avec et pour les chirurgiens‑dentistes</span>
            </div>
          </div>
          <div className="reassure">
            <span>
              <span className="tick">✓</span> Plus de devis acceptés
            </span>
            <span>
              <span className="tick">✓</span> Reste à charge clair en minutes
            </span>
            <span>
              <span className="tick">✓</span> Paiement en plusieurs fois
            </span>
          </div>
        </div>
      </header>

      {/* PROBLÈME */}
      <section id="probleme">
        <div className="container">
          <p className="eyebrow">Le problème</p>
          <h2 className="sec">Les garanties mutuelle freinent l'acceptation des devis</h2>
          <p className="sec-sub">
            Entre le diagnostic et la signature, l'opacité des remboursements coûte du temps au
            cabinet et des plans de traitement non réalisés.
          </p>
          <div className="grid2">
            <div>
              <Prob title="Des tableaux illisibles" text="Pourcentages, base de remboursement, plafonds, forfaits : le patient ne comprend pas ses droits réels." />
              <Prob title="Un temps administratif énorme" text="L'assistante interprète manuellement chaque contrat, mutuelle par mutuelle." />
              <Prob title="10 à 15 jours d'attente" text="Le devis part à la mutuelle, et la décision du patient se perd dans le délai." />
            </div>
            <div>
              <Prob title="Le patient bloque sur le prix" text="Sans connaître son reste à charge, il reporte ou refuse le traitement." />
              <Prob title="Des garanties très variables" text="D'un contrat à l'autre, le risque d'erreur ou de sous-estimation est réel." />
              <Prob title="Aucun outil de simulation" text="Impossible de comparer plusieurs options de traitement en un coup d'œil." />
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="alt">
        <div className="container">
          <p className="eyebrow">La solution</p>
          <h2 className="sec">Le copilote financier du devis dentaire</h2>
          <p className="sec-sub">
            Un assistant qui transforme un document incompréhensible en outil de décision clair,
            pour le patient comme pour le cabinet.
          </p>
          <div className="grid3">
            <Feature ico="📄" title="Lecture automatique" text="Le patient envoie sa mutuelle (photo, PDF ou capture). L'application extrait les garanties dentaires : prothèse, implant, paro, orthodontie." />
            <Feature ico="🧮" title="Reste à charge estimé" text="Croisement des garanties avec les actes envisagés. Double calcul et règles métier pour fiabiliser l'estimation." />
            <Feature ico="📊" title="Devis optimisé" text="Garant-AI propose au praticien le devis qui garantit le meilleur traitement, avec la prise en charge maximale et une facilité de paiement." />
            <Feature ico="⏱️" title="Moins d'administratif" text="Vos assistantes passent moins de temps à décrypter les contrats, plus de temps avec les patients." />
            <Feature ico="✅" title="Validation cabinet" text="Rien n'est envoyé sans votre contrôle. Le rapport patient reste explicitement une estimation non contractuelle." />
            <Feature ico="💳" title="Paiement fluide" text="Intégrations prévues avec Alma, Stripe et GoCardless pour proposer un paiement fractionné adapté au reste à charge." />
          </div>
        </div>
      </section>

      {/* FONCTIONNEMENT */}
      <section id="fonctionnement">
        <div className="container">
          <p className="eyebrow">Fonctionnement</p>
          <h2 className="sec">Quatre étapes, avant même le rendez-vous</h2>
          <p className="sec-sub">Le patient arrive informé, le cabinet présente un devis clair.</p>
          <div className="steps">
            <Step n={1} title="Le patient reçoit un lien" text="Envoyé avant le RDV, idéalement depuis votre logiciel ou Doctolib." />
            <Step n={2} title="Il transmet sa mutuelle" text="Photo, PDF ou capture de son espace adhérent. C'est tout." />
            <Step n={3} title="L'app génère le devis optimisé" text="Extraction, calcul du reste à charge et devis optimisé pour le patient." />
            <Step n={4} title="Le cabinet valide" text="Vous contrôlez, le patient reçoit un rapport clair et pédagogique." />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="alt">
        <div className="container">
          <div className="band">
            <div>
              <div className="big">+2-3</div>
              <div className="lab">devis acceptés / mois suffisent à rentabiliser l'outil</div>
            </div>
            <div>
              <div className="big">0 jour</div>
              <div className="lab">d'attente pour une première estimation au patient</div>
            </div>
            <div>
              <div className="big">100 %</div>
              <div className="lab">des estimations validées par le cabinet avant envoi</div>
            </div>
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES / AVIS */}
      <section id="avis">
        <div className="container">
          <p className="eyebrow">Témoignages</p>
          <h2 className="sec">Ils gagnent du temps et font accepter plus de devis</h2>
          <p className="sec-sub">
            Ce que les cabinets pensent de Garant-AI.
          </p>
          <div className="grid3">
            <Avis
              initials="AD"
              color="#2f5fe0"
              name="Dr A. Dubois"
              role="Chirurgien‑dentiste · Lyon"
              text="Le patient arrive en connaissant son reste à charge. Les devis se signent beaucoup plus vite, et mon assistante a gagné un temps fou."
            />
            <Avis
              initials="SM"
              color="#16a34a"
              name="S. Martin"
              role="Assistante dentaire · Nantes"
              text="Fini les heures à décortiquer les mutuelles. Une photo du tableau, et le devis optimisé est prêt. Il aide vraiment le patient à accepter le traitement."
            />
            <Avis
              initials="JL"
              color="#8b5cf6"
              name="Dr J. Lefèvre"
              role="Omnipraticien · Bordeaux"
              text="L'option « reste à charge 0 » rassure, et le paiement en plusieurs fois débloque les gros plans de traitement. Très convaincant en consultation."
            />
          </div>
          <p className="avis-note">
            Témoignages illustratifs — à remplacer par vos avis réels avant publication.
          </p>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="alt">
        <div className="container">
          <p className="eyebrow">Tarifs</p>
          <h2 className="sec">Un abonnement simple, par cabinet</h2>
          <p className="sec-sub">
            Sans engagement long. Le prix se rentabilise dès les premiers devis additionnels
            acceptés.
          </p>
          <div className="price-grid">
            <Plan name="Solo" lvl="Praticien seul" amt="49–79€" per="/mois" feats={['Lecture des garanties', 'Estimation reste à charge', 'Rapport patient', 'Mentions légales incluses']} />
            <Plan name="Pro" lvl="Cabinet avec assistante" amt="99–199€" per="/mois" hot feats={['Tout Solo', 'Devis optimisé', 'Plusieurs utilisateurs', 'Support prioritaire']} />
            <Plan name="Premium" lvl="Orienté prothèse / implanto" amt="299–499€" per="/mois" feats={['Tout Pro', 'Intégrations paiement', 'Modèles de devis avancés', 'Accompagnement dédié']} />
            <Plan name="Groupe" lvl="Centres & réseaux" amt="Sur devis" per="" feats={['Multi-sites', 'Reporting consolidé', 'API & intégrations', 'Conformité renforcée']} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="container">
          <p className="eyebrow">FAQ</p>
          <h2 className="sec">Les questions qu'on nous pose le plus</h2>
          <p className="sec-sub">
            Tout ce qu'il faut savoir avant de tester Garant-AI dans votre cabinet.
          </p>
          <div className="faq-list">
            <Faq
              q="Comment Garant-AI lit-il la mutuelle du patient ?"
              a="Le patient envoie une simple photo ou un PDF de son tableau de garanties. L'IA en extrait automatiquement les garanties dentaires (prothèse, implant, parodontie, orthodontie) ainsi que la base de remboursement."
            />
            <Faq
              q="Les estimations sont-elles contractuelles ?"
              a="Non, elles restent indicatives et sont toujours validées par le cabinet. Le remboursement définitif relève de l'Assurance Maladie et de la complémentaire santé."
            />
            <Faq
              q="Pourquoi un devis optimisé ?"
              a="Garant-AI propose au praticien un devis optimisé qui garantit le meilleur traitement pour le patient. Celui-ci bénéficie de la prise en charge maximale et d'une facilité de paiement, ce qui rend le plan de traitement plus simple à accepter."
            />
            <Faq
              q="Le patient doit-il créer un compte ?"
              a="Non, il reçoit simplement un lien et y dépose son tableau de garanties. Toute l'analyse se fait ensuite côté cabinet, sans aucune action de sa part."
            />
            <Faq
              q="Puis-je importer un devis depuis Logosw ?"
              a="Oui, vous pouvez l'importer en photo, en PDF ou en collant directement le texte. Le code CCAM et le montant sont lus automatiquement, et vous vérifiez les lignes avant de générer les devis."
            />
            <Faq
              q="Les données sont-elles protégées ?"
              a="Tous les échanges sont chiffrés et vos données ne sont jamais revendues. Pour un usage avec de vrais patients, l'hébergement doit être certifié HDS, comme expliqué sur notre page Sécurité & HDS."
            />
            <Faq
              q="Combien ça coûte ?"
              a="L'abonnement est mensuel, par cabinet et sans engagement, à partir de l'offre Solo. En général, 2 à 3 devis acceptés en plus chaque mois suffisent à le rentabiliser."
            />
            <Faq
              q="Le paiement en plusieurs fois, comment ça marche ?"
              a="Le reste à charge peut être réglé en plusieurs fois via Alma ou Klarna, sous réserve de leur acceptation. C'est particulièrement utile pour débloquer les plans de traitement importants."
            />
          </div>
        </div>
      </section>

      {/* DÉMO / LEADS */}
      <section id="demo" className="alt">
        <div className="container">
          <p className="eyebrow">Demander une démo</p>
          <h2 className="sec">Voyez l'outil sur vos propres cas</h2>
          <p className="sec-sub">
            Laissez-nous vos coordonnées : nous vous montrons comment Garant-AI s'intègre à
            votre cabinet.
          </p>
          <div className="form-wrap">
            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div>
                    <label htmlFor="nom">Nom du praticien *</label>
                    <input id="nom" required />
                  </div>
                  <div>
                    <label htmlFor="cab">Nom du cabinet</label>
                    <input id="cab" />
                  </div>
                  <div>
                    <label htmlFor="email">E-mail professionnel *</label>
                    <input id="email" type="email" required />
                  </div>
                  <div>
                    <label htmlFor="tel">Téléphone</label>
                    <input id="tel" type="tel" />
                  </div>
                  <div>
                    <label htmlFor="type">Profil du cabinet</label>
                    <select id="type">
                      <option>Cabinet généraliste</option>
                      <option>Orienté prothèse</option>
                      <option>Orienté implantologie</option>
                      <option>Orthodontie</option>
                      <option>Centre / réseau</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="taille">Nombre de praticiens</label>
                    <select id="taille">
                      <option>1</option>
                      <option>2–3</option>
                      <option>4–6</option>
                      <option>7 et +</option>
                    </select>
                  </div>
                  <div className="full">
                    <label htmlFor="msg">Votre besoin (optionnel)</label>
                    <textarea
                      id="msg"
                      placeholder="Ex. : nous perdons du temps à expliquer les remboursements de prothèse…"
                    />
                  </div>
                  <div className="full consent">
                    <input type="checkbox" id="rgpd" required />
                    <label htmlFor="rgpd" style={{ fontWeight: 400, margin: 0 }}>
                      J'accepte que mes coordonnées soient utilisées pour être recontacté au sujet de
                      cette démo, conformément à la{' '}
                      <a href="#" style={{ color: 'var(--blue)' }}>
                        politique de confidentialité
                      </a>{' '}
                      (RGPD). Aucune donnée de santé n'est collectée via ce formulaire.
                    </label>
                  </div>
                  {error && (
                    <div className="full">
                      <div className="disclaimer" style={{ marginTop: 0 }}>
                        <span>⚠️</span>
                        <div>{error}</div>
                      </div>
                    </div>
                  )}
                  <div className="full">
                    <button
                      className="btn lg"
                      type="submit"
                      style={{ width: '100%' }}
                      disabled={busy}
                    >
                      {busy ? 'Envoi en cours…' : 'Demander ma démo gratuite'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="ok-msg">
                ✓ Merci ! Votre demande a bien été enregistrée. Nous vous recontacterions sous 48 h.
              </div>
            )}
          </div>
          <div className="disclaimer">
            <span>⚠️</span>
            <div>
              <b>Estimation non contractuelle.</b> Garant-AI fournit une aide à la lecture
              des garanties et une estimation du reste à charge. Le remboursement définitif relève de
              la mutuelle et de l'Assurance Maladie. L'outil n'incite jamais à modifier un plan de
              traitement médicalement justifié.
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="foot-grid">
            <div>
              <div className="brand" style={{ color: '#fff', marginBottom: 12 }}>
                <div className="logo">GA</div>
                Garant-AI
              </div>
              <p style={{ margin: 0, maxWidth: 340, color: '#9fb8cb' }}>
                Le copilote financier du devis dentaire. Des remboursements lisibles, des patients
                informés, des devis mieux acceptés.
              </p>
            </div>
            <div>
              <h4>Produit</h4>
              <p><a href="#probleme">Le problème</a></p>
              <p><a href="#fonctionnement">Fonctionnement</a></p>
              <p><a href="#tarifs">Tarifs</a></p>
              <p><Link to="/app">Démo interactive</Link></p>
              <p><Link to="/guide">Guide d'utilisation</Link></p>
            </div>
            <div>
              <h4>Conformité</h4>
              <p><Link to="/securite">RGPD &amp; hébergement HDS</Link></p>
              <p><Link to="/confidentialite">Politique de confidentialité</Link></p>
              <p><Link to="/cgu">CGU</Link></p>
              <p><Link to="/mentions-legales">Mentions légales</Link></p>
            </div>
          </div>
          <div className="legal">
            Données de santé hébergées chez un hébergeur certifié HDS, conformément au RGPD. Les
            estimations fournies sont non contractuelles et soumises à la validation du cabinet. ©
            2026 Garant-AI — démonstration. Les mutuelles et montants présentés sont
            fictifs.
          </div>
        </div>
      </footer>
    </div>
  )
}

function Prob({ title, text }: { title: string; text: string }) {
  return (
    <div className="prob">
      <span className="x">✕</span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
    </div>
  )
}

function Feature({ ico, title, text }: { ico: string; title: string; text: string }) {
  return (
    <div className="card">
      <div className="ico">{ico}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function Avis({
  initials,
  color,
  name,
  role,
  text,
}: {
  initials: string
  color: string
  name: string
  role: string
  text: string
}) {
  return (
    <div className="card avis-card">
      <div className="stars">★★★★★</div>
      <p className="avis-quote">« {text} »</p>
      <div className="avis-author">
        <span className="avis-ava" style={{ background: color }}>
          {initials}
        </span>
        <div>
          <b>{name}</b>
          <span className="avis-role">{role}</span>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="stp">
      <div className="num">{n}</div>
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  )
}

function Plan({
  name,
  lvl,
  amt,
  per,
  feats,
  hot,
}: {
  name: string
  lvl: string
  amt: string
  per: string
  feats: string[]
  hot?: boolean
}) {
  return (
    <div className={'plan' + (hot ? ' hot' : '')}>
      <h3>{name}</h3>
      <div className="lvl">{lvl}</div>
      <div className="amt">
        {amt}
        {per && <small>{per}</small>}
      </div>
      <ul>
        {feats.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Link className={'btn' + (hot ? '' : ' ghost')} to="/app">
        Essayer la démo
      </Link>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="faq-item">
      <summary>
        <span>{q}</span>
        <span className="faq-chev" aria-hidden>
          ＋
        </span>
      </summary>
      <p>{a}</p>
    </details>
  )
}
