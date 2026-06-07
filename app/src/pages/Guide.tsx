import { Link } from 'react-router-dom'
import './Account.css'

/**
 * Guide d'utilisation — côté cabinet et côté patient.
 * Page d'aide accessible depuis le pied de page et l'espace cabinet.
 */
export default function Guide() {
  return (
    <div className="acct">
      <div className="topbar">
        <Link to="/" className="brand">
          <div className="logo">TG</div>
          Tableau de Garanti
        </Link>
      </div>

      <div className="auth-wrap" style={{ maxWidth: 820, alignItems: 'flex-start' }}>
        <div className="auth-card" style={{ width: '100%', textAlign: 'left' }}>
          <h1>Guide d'utilisation</h1>
          <p className="sub">
            En quelques minutes : récupérer la mutuelle du patient, générer 3 devis clairs et faire
            signer dès le rendez-vous.
          </p>

          <div className="legal">
            <h3>① Côté cabinet — préparer la demande</h3>
            <ol>
              <li>Connectez-vous à votre <Link to="/connexion" style={{ color: 'var(--blue)' }}>espace cabinet</Link>.</li>
              <li>
                Partagez votre <b>lien permanent</b> (ou un lien d'invitation) au patient : il pourra y
                déposer son tableau de garanties sans rien installer.
              </li>
              <li>
                Vous pouvez aussi téléverser vous-même le tableau du patient depuis le tableau de bord.
              </li>
            </ol>

            <h3>② Côté patient — envoyer son tableau</h3>
            <ol>
              <li>
                Le patient ouvre le lien, indique son nom et dépose son <b>tableau de garanties</b>
                (photo ou PDF). <i>Aucune analyse de son côté : il envoie simplement le fichier.</i>
              </li>
              <li>Il coche son consentement (données de santé) puis valide l'envoi.</li>
              <li>Où trouver le tableau ? Espace adhérent de la mutuelle, e-mail annuel, ou appli mobile.</li>
            </ol>

            <h3>③ Côté cabinet — analyser et générer les 3 devis</h3>
            <ol>
              <li>Dans le tableau de bord, ouvrez la demande du patient (vous pouvez télécharger le fichier joint).</li>
              <li>L'IA lit le tableau de garanties et calcule la part Sécu + mutuelle + reste à charge.</li>
              <li>
                Importez le devis : <b>photo/PDF</b>, ou collez-le en <b>texte</b> depuis Logosw (le code
                CCAM et le montant sont lus automatiquement). Vérifiez et corrigez les lignes.
              </li>
              <li>
                L'app génère <b>3 devis</b> :
                <ul>
                  <li><b>Initial</b> — tel que saisi.</li>
                  <li><b>Remboursement maximal</b> — pousse vers le tarif libre pour maximiser la prise en charge ; le reste à charge peut être réglé en plusieurs fois.</li>
                  <li><b>Reste à charge 0 €</b> — privilégie le panier 100 % Santé.</li>
                </ul>
              </li>
              <li>Exportez le PDF et présentez-le au patient : il comprend, compare et signe.</li>
            </ol>

            <h3>Bonnes pratiques</h3>
            <ul>
              <li>Présentez toujours les montants comme <b>indicatifs</b> et à confirmer avec la mutuelle.</li>
              <li>Un tableau récent et lisible améliore nettement la précision de la lecture.</li>
              <li>Le paiement en plusieurs fois est proposé via un prestataire tiers (sous réserve d'acceptation).</li>
            </ul>

            <h3>Questions fréquentes</h3>
            <p><b>Le patient doit-il créer un compte ?</b> Non, le lien suffit.</p>
            <p><b>Les estimations sont-elles contractuelles ?</b> Non, elles sont indicatives ; le cabinet reste responsable du devis remis.</p>
            <p><b>Mes données sont-elles protégées ?</b> Oui — voir <Link to="/securite" style={{ color: 'var(--blue)' }}>Sécurité &amp; HDS</Link>.</p>
          </div>

          <p className="sub" style={{ marginTop: 22 }}>
            <Link to="/securite" style={{ color: 'var(--blue)' }}>Sécurité &amp; HDS</Link>
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
