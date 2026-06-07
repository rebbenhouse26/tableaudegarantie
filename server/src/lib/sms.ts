/**
 * Envoi de SMS transactionnels via Brevo (ex-Sendinblue).
 * Désactivé tant que BREVO_API_KEY n'est pas défini → l'app fonctionne normalement sans SMS.
 * Variables d'environnement :
 *   BREVO_API_KEY  : clé API Brevo (obligatoire pour activer l'envoi)
 *   SMS_SENDER     : nom de l'expéditeur (≤ 11 caractères alphanumériques), défaut « Cabinet »
 */
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? ''
const SMS_SENDER = (process.env.SMS_SENDER ?? 'Cabinet').replace(/[^A-Za-z0-9]/g, '').slice(0, 11) || 'Cabinet'

export function smsAvailable(): boolean {
  return !!BREVO_API_KEY
}

/** Normalise un numéro FR en format international sans « + » (ex. 0612345678 → 33612345678). */
export function normalizePhoneFR(raw: string): string | null {
  const d = (raw || '').replace(/[^\d+]/g, '')
  if (/^\+?33\d{9}$/.test(d)) return d.replace(/^\+/, '')
  if (/^0\d{9}$/.test(d)) return '33' + d.slice(1)
  if (/^\+?\d{10,15}$/.test(d)) return d.replace(/^\+/, '') // autre pays : on laisse passer
  return null
}

/** Envoie un SMS. Retourne {ok} ; ne jette jamais (best-effort). */
export async function sendSms(
  phone: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BREVO_API_KEY) return { ok: false, error: 'SMS non configuré (BREVO_API_KEY absent).' }
  const recipient = normalizePhoneFR(phone)
  if (!recipient) return { ok: false, error: 'Numéro de téléphone invalide.' }
  try {
    const r = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ sender: SMS_SENDER, recipient, content, type: 'transactional' }),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      console.error('Brevo SMS error', r.status, body.slice(0, 300))
      return { ok: false, error: `Envoi SMS refusé (HTTP ${r.status}).` }
    }
    return { ok: true }
  } catch (e) {
    console.error('Brevo SMS exception', e)
    return { ok: false, error: 'Service SMS indisponible.' }
  }
}
