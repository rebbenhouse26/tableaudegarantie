/**
 * Paiement en plusieurs fois via Klarna (Hosted Payment Page).
 * Désactivé tant que KLARNA_USERNAME / KLARNA_PASSWORD ne sont pas définis.
 * Variables d'environnement :
 *   KLARNA_USERNAME / KLARNA_PASSWORD : identifiants API marchand (portal.klarna.com)
 *   KLARNA_REGION : "eu" (défaut) | "na" | "oc"
 *   KLARNA_MODE   : "playground" (test, défaut) | "live"
 * NB : Klarna affiche lui-même les échéances éligibles (pay in 3, etc.) selon le montant et le pays ;
 * on ne lui passe pas de "nombre d'échéances" (contrairement à Alma).
 */
const KLARNA_USERNAME = process.env.KLARNA_USERNAME ?? ''
const KLARNA_PASSWORD = process.env.KLARNA_PASSWORD ?? ''
const KLARNA_REGION = (process.env.KLARNA_REGION ?? 'eu').toLowerCase()
const KLARNA_MODE = (process.env.KLARNA_MODE ?? 'playground').toLowerCase()

function baseUrl(): string {
  const sub = KLARNA_REGION === 'na' ? 'api-na' : KLARNA_REGION === 'oc' ? 'api-oc' : 'api'
  return KLARNA_MODE === 'live' ? `https://${sub}.klarna.com` : `https://${sub}.playground.klarna.com`
}

export function klarnaAvailable(): boolean {
  return !!KLARNA_USERNAME && !!KLARNA_PASSWORD
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${KLARNA_USERNAME}:${KLARNA_PASSWORD}`).toString('base64')
}

/**
 * Crée une page de paiement Klarna et renvoie l'URL de redirection.
 * Montant en EUROS. Ne jette jamais (best-effort).
 */
export async function createKlarnaPayment(opts: {
  amountEuros: number
  customerName?: string
  returnUrl?: string
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!klarnaAvailable()) return { ok: false, error: 'Paiement Klarna non configuré (identifiants absents).' }
  const minor = Math.round(opts.amountEuros * 100)
  if (!(minor > 0)) return { ok: false, error: 'Montant invalide.' }
  const headers = { Authorization: authHeader(), 'Content-Type': 'application/json' }
  const ret = opts.returnUrl || ''
  try {
    // 1) Session de paiement.
    const sessionRes = await fetch(`${baseUrl()}/payments/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        purchase_country: 'FR',
        purchase_currency: 'EUR',
        locale: 'fr-FR',
        order_amount: minor,
        order_lines: [
          {
            name: 'Soins dentaires — reste à charge',
            quantity: 1,
            unit_price: minor,
            total_amount: minor,
          },
        ],
      }),
    })
    if (!sessionRes.ok) {
      const b = await sessionRes.text().catch(() => '')
      console.error('Klarna session error', sessionRes.status, b.slice(0, 300))
      return { ok: false, error: `Création de la session Klarna refusée (HTTP ${sessionRes.status}).` }
    }
    const session = (await sessionRes.json()) as { session_id?: string }
    if (!session.session_id) return { ok: false, error: 'Session Klarna invalide.' }

    // 2) Hosted Payment Page → URL de redirection client.
    const hppRes = await fetch(`${baseUrl()}/hpp/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        payment_session_url: `${baseUrl()}/payments/v1/sessions/${session.session_id}`,
        merchant_urls: {
          success: ret || 'https://example.com/success',
          cancel: ret || 'https://example.com/cancel',
          back: ret || 'https://example.com/back',
          failure: ret || 'https://example.com/failure',
          error: ret || 'https://example.com/error',
        },
        options: { payment_method_categories: ['pay_later', 'pay_over_time'] },
      }),
    })
    if (!hppRes.ok) {
      const b = await hppRes.text().catch(() => '')
      console.error('Klarna HPP error', hppRes.status, b.slice(0, 300))
      return { ok: false, error: `Création de la page Klarna refusée (HTTP ${hppRes.status}).` }
    }
    const hpp = (await hppRes.json()) as { redirect_url?: string; distribution_url?: string }
    const url = hpp.redirect_url || hpp.distribution_url
    if (!url) return { ok: false, error: 'Réponse Klarna sans URL de paiement.' }
    return { ok: true, url }
  } catch (e) {
    console.error('Klarna exception', e)
    return { ok: false, error: 'Service de paiement Klarna indisponible.' }
  }
}
