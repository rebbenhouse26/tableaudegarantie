import { Link } from 'react-router-dom'
import './Account.css'

type Page = 'mentions' | 'confidentialite' | 'cgu' | 'securite'

const TITLES: Record<Page, string> = {
  mentions: 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  cgu: "Conditions générales d'utilisation",
  securite: 'Sécurité, RGPD & hébergement HDS',
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
          <div className="logo">GA</div>
          Garant-AI
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

          {page === 'securite' && (
            <div className="legal">
              <p>
                Garant-AI traite des <b>données de santé</b> (tableaux de garanties et devis
                dentaires). Ces données relèvent de la catégorie particulière de l'article 9 du RGPD et,
                en France, doivent être hébergées chez un <b>Hébergeur de Données de Santé (HDS) certifié</b>.
                Voici comment nous nous y conformons.
              </p>
              <h3>1. Hébergement certifié HDS</h3>
              <p>
                Les données sont hébergées en Union européenne chez un hébergeur <b>certifié HDS</b> :
                [nom de l'hébergeur], certificat HDS n° [référence]. Le contrat d'hébergement précise les
                conditions de sécurité, de réversibilité et de localisation des données.
              </p>
              <h3>2. Données collectées et finalité</h3>
              <p>
                Nous collectons uniquement ce qui est nécessaire à l'estimation du reste à charge : nom du
                patient, e-mail de contact, tableau de garanties et devis. <b>Aucune donnée n'est revendue</b>
                ni utilisée à des fins publicitaires.
              </p>
              <h3>3. Chiffrement</h3>
              <p>
                Échanges chiffrés en transit (HTTPS/TLS). Les fichiers (tableaux, devis) sont stockés sur un
                volume dédié et supprimés à l'issue de la durée de conservation. [Préciser le chiffrement au
                repos selon l'hébergeur.]
              </p>
              <h3>4. Consentement du patient</h3>
              <p>
                Le patient consent explicitement au traitement de ses données de santé avant tout envoi
                (case à cocher). Il peut retirer son consentement et demander la suppression à tout moment.
              </p>
              <h3>5. Sous-traitants encadrés (DPA)</h3>
              <p>
                Lecture par IA, envoi d'e-mails/SMS ([Brevo]) et paiement en plusieurs fois ([Alma]/[Klarna])
                font chacun l'objet d'un accord de traitement (DPA). La liste à jour est disponible sur demande.
              </p>
              <h3>6. Durée de conservation</h3>
              <p>
                Tableaux et devis : [12] mois après le dernier devis, puis suppression automatique. Le cabinet
                peut supprimer une demande patient à tout moment depuis son espace.
              </p>
              <h3>7. Vos droits</h3>
              <p>
                Accès, rectification, effacement, opposition et portabilité : [contact@domaine.fr].
                Réclamation possible auprès de la <b>CNIL</b>. DPO : [nom / e-mail].
              </p>
              <h3>8. Limite de l'estimation</h3>
              <p>
                Les montants affichés sont <b>indicatifs</b> et doivent être vérifiés par le cabinet. Le
                remboursement définitif relève de l'Assurance Maladie et de la complémentaire santé.
              </p>
              <p className="sub" style={{ marginTop: 14, fontSize: 12.5 }}>
                Cette page décrit notre démarche de conformité ; elle ne constitue pas un conseil juridique.
                Faire valider mentions et certificat HDS par un juriste / DPO avant mise en production.
              </p>
            </div>
          )}

          <p className="sub" style={{ marginTop: 22 }}>
            <Link to="/securite" style={{ color: 'var(--blue)' }}>Sécurité &amp; HDS</Link>
            {' · '}
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
