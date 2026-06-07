/**
 * Paiement en plusieurs fois via Alma (https://alma.eu).
 * Désactivé tant que ALMA_API_KEY n'est pas défini → le devis fonctionne, la simulation s'affiche,
 * mais le bouton « Payer » renvoie un message clair.
 * Variables d'environnement :
 *   ALMA_API_KEY : clé marchand Alma (sk_test_… en sandbox, sk_live_… en prod)
 *   ALMA_MODE    : "sandbox" (défaut) ou "live"
 */
const ALMA_API_KEY = process.env.ALMA_API_KEY ?? ''
const ALMA_MODE = (process.env.ALMA_MODE ?? 'sandbox').toLowerCase()
const ALMA_BASE = ALMA_MODE === 'live' ? 'https://api.getalma.eu' : 'https://api.sandbox.getalma.eu'

/** Échéances proposées (Alma : 2x/3x/4x sans frais, 10x = paiement échelonné avec frais). */
export const ALMA_INSTALLMENTS = [2, 3, 4, 10] as const

export function almaAvailable(): boolean {
  return !!ALMA_API_KEY
}

/**
 * Crée un paiement Alma et renvoie l'URL de la page de paiement (à ouvrir pour le patient).
 * Montant en EUROS (converti en centimes pour Alma). Ne jette jamais (best-effort).
 */
export async function createAlmaPayment(opts: {
  amountEuros: number
  installments: number
  customerName?: string
  returnUrl?: string
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!ALMA_API_KEY) return { ok: false, error: 'Paiement Alma non configuré (ALMA_API_KEY absent).' }
  const cents = Math.round(opts.amountEuros * 100)
  if (!(cents > 0)) return { ok: false, error: 'Montant invalide.' }
  if (!ALMA_INSTALLMENTS.includes(opts.installments as (typeof ALMA_INSTALLMENTS)[number])) {
    return { ok: false, error: 'Nombre d’échéances non supporté.' }
  }
  const [firstName, ...rest] = (opts.customerName ?? '').trim().split(/\s+/)
  try {
    const r = await fetch(`${ALMA_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Alma-Api-Token ${ALMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment: {
          purchase_amount: cents,
          installments_count: opts.installments,
          return_url: opts.returnUrl || undefined,
          customer_cancel_url: opts.returnUrl || undefined,
        },
        customer: firstName
          ? { first_name: firstName, last_name: rest.join(' ') || firstName }
          : undefined,
      }),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      console.error('Alma error', r.status, body.slice(0, 300))
      return { ok: false, error: `Création du paiement Alma refusée (HTTP ${r.status}).` }
    }
    const data = (await r.json()) as { url?: string; id?: string }
    if (!data.url) return { ok: false, error: 'Réponse Alma sans URL de paiement.' }
    return { ok: true, url: data.url }
  } catch (e) {
    console.error('Alma exception', e)
    return { ok: false, error: 'Service de paiement indisponible.' }
  }
}
