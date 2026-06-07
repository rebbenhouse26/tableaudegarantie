import { Link } from 'react-router-dom'
import './Account.css'

type Page = 'mentions' | 'confidentialite' | 'cgu'

const TITLES: Record<Page, string> = {
  mentions: 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  cgu: "Conditions générales d'utilisation",
}

/**
 * Pages légales. Contenu = MODÈLE à compléter par l'éditeur (raison sociale, SIRET, DPO,
 * hébergeur HDS…). Ne constitue pas un conseil juridique : faire valider par un juriste/DPO.
 */
export default function Legal({ page }: { page: Page }) {
  return (
    <div className="acct">
      <div className="topbar">
        <Link to="/" className="brand">
          <div className="logo">TG</div>
          Tableau de Garanti
        </Link>
      </div>

      <div className="auth-wrap" style={{ maxWidth: 760, alignItems: 'flex-start' }}>
        <div className="auth-card" style={{ width: '100%', textAlign: 'left' }}>
          <h1>{TITLES[page]}</h1>
          <p className="sub" style={{ fontSize: 12.5 }}>
            Modèle à compléter et à faire valider par un juriste / DPO. Les champs entre crochets
            <code> [ ] </code> sont à renseigner par l'éditeur.
          </p>

          {page === 'mentions' && (
            <div className="legal">
              <h3>Éditeur</h3>
              <p>[Raison sociale] — [forme juridique] au capital de [montant] €. Siège : [adresse].
              SIRET [n°] — RCS [ville]. Directeur de la publication : [nom].</p>
              <h3>Contact</h3>
              <p>E-mail : [contact@domaine.fr] — Téléphone : [n°].</p>
              <h3>Hébergement</h3>
              <p>Hébergeur de Données de Santé certifié (HDS) : [nom de l'hébergeur HDS], [adresse].
              Certificat HDS n° [référence].</p>
            </div>
          )}

          {page === 'confidentialite' && (
            <div className="legal">
              <h3>Responsable de traitement</h3>
              <p>[Raison sociale], [adresse], [contact]. DPO : [nom / e-mail].</p>
              <h3>Données collectées</h3>
              <p>Identité (nom, e-mail), tableaux de garanties et devis dentaires transmis. Ce sont
              des <b>données de santé</b> (catégorie particulière, art. 9 RGPD).</p>
              <h3>Finalités & base légale</h3>
              <p>Estimation du reste à charge et préparation du devis. Base légale : <b>consentement</b>
              du patient et/ou exécution du contrat de soins.</p>
              <h3>Hébergement</h3>
              <p>Données hébergées chez un <b>hébergeur certifié HDS</b> en Union européenne.</p>
              <h3>Sous-traitants</h3>
              <p>Extraction par IA ([fournisseur], encadrée), envoi d'e-mails/SMS ([Brevo]), paiement
              en plusieurs fois ([Alma]/[Klarna]). Chacun fait l'objet d'un contrat (DPA).</p>
              <h3>Durée de conservation</h3>
              <p>Tableaux/devis : [12] mois après le dernier devis, puis suppression. Compte : tant
              qu'il est actif.</p>
              <h3>Vos droits</h3>
              <p>Accès, rectification, effacement, opposition, portabilité : [contact@domaine.fr].
              Réclamation possible auprès de la CNIL.</p>
            </div>
          )}

          {page === 'cgu' && (
            <div className="legal">
              <h3>Objet</h3>
              <p>L'outil estime, à titre <b>indicatif et non contractuel</b>, le remboursement et le
              reste à charge à partir des garanties et devis transmis. Le remboursement définitif
              relève de l'Assurance Maladie et de la complémentaire santé.</p>
              <h3>Responsabilité</h3>
              <p>Les estimations doivent être vérifiées par le chirurgien-dentiste. L'éditeur ne
              saurait être tenu responsable d'une décision prise sur la seule base de l'estimation.</p>
              <h3>Compte & sécurité</h3>
              <p>L'utilisateur est responsable de la confidentialité de ses identifiants.</p>
              <h3>Paiement en plusieurs fois</h3>
              <p>Assuré par un prestataire tiers ([Alma]/[Klarna]) sous réserve d'acceptation de sa part.</p>
            </div>
          )}

          <p className="sub" style={{ marginTop: 22 }}>
            <Link to="/mentions-legales" style={{ color: 'var(--blue)' }}>Mentions légales</Link>
            {' · '}
            <Link to="/confidentialite" style={{ color: 'var(--blue)' }}>Confidentialité</Link>
            {' · '}
            <Link to="/cgu" style={{ color: 'var(--blue)' }}>CGU</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
