/**
 * Envoi d'e-mails transactionnels via Brevo (ex-Sendinblue).
 * Désactivé tant que BREVO_API_KEY n'est pas défini → l'app fonctionne sans e-mail
 * (le lien est alors renvoyé à l'écran pour rester testable).
 * Variables d'environnement :
 *   BREVO_API_KEY     : clé API Brevo (obligatoire pour activer l'envoi)
 *   EMAIL_SENDER      : adresse expéditeur vérifiée chez Brevo (ex. noreply@mondomaine.fr)
 *   EMAIL_SENDER_NAME : nom affiché de l'expéditeur (défaut « Tableau de Garanti »)
 */
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? ''
const EMAIL_SENDER = process.env.EMAIL_SENDER ?? ''
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME ?? 'Tableau de Garanti'

export function emailAvailable(): boolean {
  return !!BREVO_API_KEY && !!EMAIL_SENDER
}

/** Envoie un e-mail HTML. Retourne {ok} ; ne jette jamais (best-effort). */
export async function sendEmail(opts: {
  to: string
  toName?: string
  subject: string
  html: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!emailAvailable()) {
    return { ok: false, error: 'E-mail non configuré (BREVO_API_KEY / EMAIL_SENDER absent).' }
  }
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: EMAIL_SENDER, name: EMAIL_SENDER_NAME },
        to: [{ email: opts.to, name: opts.toName || opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
      }),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      console.error('Brevo email error', r.status, body.slice(0, 300))
      return { ok: false, error: `Envoi e-mail refusé (HTTP ${r.status}).` }
    }
    return { ok: true }
  } catch (e) {
    console.error('Brevo email exception', e)
    return { ok: false, error: 'Service e-mail indisponible.' }
  }
}

/** Gabarit HTML de l'e-mail de bienvenue patient (lien vers son espace de dépôt). */
export function welcomeEmailHtml(name: string, link: string): string {
  const hello = name ? `Bonjour ${name},` : 'Bonjour,'
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;color:#21252b">
  <h2 style="color:#1f6fb2">Votre espace Tableau de Garanti</h2>
  <p>${hello}</p>
  <p>Votre compte a bien été créé. Pour transmettre votre tableau de garanties mutuelle
  (photo ou PDF), cliquez sur le bouton ci-dessous :</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${link}" style="background:#1f6fb2;color:#fff;text-decoration:none;
       padding:13px 26px;border-radius:8px;font-weight:600;display:inline-block">
      Déposer mon tableau de garanties
    </a>
  </p>
  <p style="font-size:13px;color:#5a646e">Ou copiez ce lien : <br><a href="${link}">${link}</a></p>
  <p style="font-size:12px;color:#8a949e;margin-top:24px">L'analyse est automatique et reste vérifiée
  par votre cabinet dentaire. Aucune donnée n'est partagée avec des tiers.</p>
</div>`
}
