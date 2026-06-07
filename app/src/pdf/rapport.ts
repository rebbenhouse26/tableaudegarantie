import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { GarantiesParPoste, LigneCalculee, LigneDevis, TotauxDevis } from '../domain/types'
import type { OptimResult } from '../domain/optimisation'
import { getActe } from '../domain/actes'
import { computeDevis, eur } from '../domain/calcul'

interface RapportData {
  /** Libellé de la source des garanties (nom de mutuelle ou document importé). */
  sourceLabel: string
  patientName?: string
  devis: LigneDevis[]
  res: LigneCalculee[]
  totaux: TotauxDevis
  /** Garanties du patient (pour recalculer le détail du devis optimisé). */
  garanties: GarantiesParPoste
  /** Devis optimisé « remboursement maximal » (imprimé en page intermédiaire si présent). */
  optimisationMax?: OptimResult
  /** Devis optimisé « reste à charge 0 », imprimé en dernière page si présent. */
  optimisation?: OptimResult
}

const DARK: [number, number, number] = [33, 37, 41]
const BLUE: [number, number, number] = [31, 111, 178]
const GREEN: [number, number, number] = [31, 157, 107]
const LINE: [number, number, number] = [200, 208, 214]
const MUTED: [number, number, number] = [90, 100, 110]
const FONT = 'helvetica'

/** Panier lisible pour la colonne « matériau / panier ». */
function panierLabel(panier?: string): string {
  if (panier === 'rac0') return '100 % Santé'
  if (panier === 'maitrise') return 'Panier maîtrisé'
  if (panier === 'libre') return 'Tarif libre'
  return '—'
}

interface DevisRow {
  designation: string
  code: string
  dent: string
  panier: string
  br: number
  honoraires: number
  secu: number
  mut: number
  rac: number
}

/** Construit les lignes d'affichage d'un devis à partir des lignes + résultats calculés. */
function buildRows(lines: LigneDevis[], res: LigneCalculee[], labels?: string[]): DevisRow[] {
  return lines.map((L, i) => {
    const v = getActe(L.acteId)!.variants[L.varianteIdx]
    const r = res[i]
    const br = (L.brssOverride ?? v.brss) * L.qty
    return {
      designation: (labels?.[i] ?? L.labelOverride ?? v.nom) + (L.qty > 1 ? ` ×${L.qty}` : ''),
      code: v.code ?? '—',
      dent: L.dent?.trim() || '—',
      panier: panierLabel(v.panier),
      br,
      honoraires: r.prix,
      secu: r.secu,
      mut: r.mut,
      rac: r.rac,
    }
  })
}

/**
 * Rend un devis dentaire normalisé sur la page courante : en-tête praticien/patient,
 * tableau des actes (libellé, code CCAM, dent, matériau, base SS, honoraires, remboursements,
 * reste à charge), récapitulatif et zone de signatures. Renvoie le Y final.
 */
function renderDevisForm(
  doc: jsPDF,
  opts: {
    title: string
    subtitle: string
    accent: [number, number, number]
    rows: DevisRow[]
    totals: TotauxDevis
    patientName?: string
    sourceLabel: string
    dateStr: string
    validiteStr: string
  },
) {
  const { title, subtitle, accent, rows, totals, patientName, sourceLabel, dateStr, validiteStr } = opts
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2

  // --- Bandeau titre ---
  doc.setFillColor(...accent)
  doc.rect(0, 0, pageW, 58, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(15)
  doc.text(title, margin, 27)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.text(subtitle, margin, 44)

  let y = 78

  // --- Blocs Praticien / Patient ---
  const boxH = 78
  const boxW = (contentW - 14) / 2
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.6)
  doc.roundedRect(margin, y, boxW, boxH, 3, 3)
  doc.roundedRect(margin + boxW + 14, y, boxW, boxH, 3, 3)

  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.setFont(FONT, 'bold')
  doc.text('PRATICIEN', margin + 10, y + 14)
  doc.text('PATIENT', margin + boxW + 24, y + 14)

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  const pracLines = [
    'Cabinet dentaire : ______________________',
    'Praticien : Dr ___________________________',
    'N° RPPS : ____________  N° AM : __________',
    'Adresse : ________________________________',
  ]
  pracLines.forEach((l, i) => doc.text(l, margin + 10, y + 30 + i * 12))
  const patLines = [
    `Nom et prénom : ${patientName || '________________________'}`,
    'Date de naissance : ____ / ____ / ________',
    'N° de Sécurité sociale : _________________',
    `Mutuelle : ${(sourceLabel || '').slice(0, 28)}`,
  ]
  patLines.forEach((l, i) => doc.text(l, margin + boxW + 24, y + 30 + i * 12))

  y += boxH + 14

  // --- Ligne date / validité ---
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.setFont(FONT, 'normal')
  doc.text(`Date du devis : ${dateStr}`, margin, y)
  doc.text(validiteStr, pageW - margin, y, { align: 'right' })
  y += 10

  // --- Tableau des actes ---
  autoTable(doc, {
    startY: y,
    head: [
      [
        "Désignation de l'acte",
        'Code\nCCAM',
        'Dent',
        'Matériau / panier',
        'Base SS',
        'Honoraires',
        'Rb. Sécu',
        'Rb. mutuelle',
        'Reste à\ncharge',
      ],
    ],
    body: rows.map((r) => [
      r.designation,
      r.code,
      r.dent,
      r.panier,
      eur(r.br),
      eur(r.honoraires),
      eur(r.secu),
      eur(r.mut),
      eur(r.rac),
    ]),
    foot: [
      [
        'TOTAUX',
        '',
        '',
        '',
        eur(rows.reduce((s, r) => s + r.br, 0)),
        eur(totals.prix),
        eur(totals.secu),
        eur(totals.mut),
        eur(totals.rac),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { font: FONT, fontSize: 8, cellPadding: 4, lineColor: LINE, lineWidth: 0.4, textColor: DARK },
    headStyles: { fillColor: accent, textColor: 255, halign: 'center', fontSize: 7.5, valign: 'middle' },
    footStyles: { fillColor: [240, 244, 248], textColor: DARK, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 131 },
      1: { halign: 'center', cellWidth: 46 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'left', cellWidth: 74 },
      4: { halign: 'right', cellWidth: 42 },
      5: { halign: 'right', cellWidth: 50 },
      6: { halign: 'right', cellWidth: 42 },
      7: { halign: 'right', cellWidth: 50, textColor: GREEN },
      8: { halign: 'right', cellWidth: 51, fontStyle: 'bold' },
    },
  })

  // @ts-expect-error lastAutoTable ajouté par le plugin
  y = doc.lastAutoTable.finalY + 18

  // --- Récapitulatif remboursement ---
  if (y > pageH - 150) {
    doc.addPage()
    y = 50
  }
  const recapH = 64
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(...LINE)
  doc.roundedRect(margin, y, contentW, recapH, 3, 3, 'FD')
  doc.setFont(FONT, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text('RÉCAPITULATIF', margin + 12, y + 16)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9.5)
  const col1 = margin + 12
  const col2 = margin + contentW / 2 + 12
  doc.text(`Total des honoraires : ${eur(totals.prix)}`, col1, y + 34)
  doc.text(`Remboursement Sécurité sociale : ${eur(totals.secu)}`, col1, y + 50)
  doc.text(`Remboursement mutuelle estimé : ${eur(totals.mut)}`, col2, y + 34)
  doc.setFont(FONT, 'bold')
  doc.setTextColor(...(totals.rac < 0.5 ? GREEN : DARK))
  doc.text(`Reste à charge estimé : ${eur(totals.rac)}`, col2, y + 50)
  y += recapH + 16

  // --- Mentions légales ---
  doc.setFont(FONT, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  const mentions =
    "Devis valable 6 mois, reçu avant l'exécution des soins. Les montants de remboursement sont des estimations établies " +
    "à partir des garanties transmises ; le remboursement définitif relève de l'Assurance Maladie et de la complémentaire santé. " +
    'Panier 100 % Santé : reste à charge nul · Panier maîtrisé : honoraires plafonnés · Tarif libre : honoraires libres.'
  const ml = doc.splitTextToSize(mentions, contentW)
  doc.text(ml, margin, y)
  y += ml.length * 9 + 14

  // --- Signatures ---
  if (y > pageH - 70) {
    doc.addPage()
    y = 50
  }
  const sigW = (contentW - 30) / 2
  doc.setDrawColor(...LINE)
  doc.roundedRect(margin, y, sigW, 56, 3, 3)
  doc.roundedRect(margin + sigW + 30, y, sigW, 56, 3, 3)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text('Date et signature du praticien', margin + 10, y + 14)
  doc.text('Date et signature du patient', margin + sigW + 40, y + 14)
  doc.setFontSize(6.5)
  doc.text(
    doc.splitTextToSize('« Devis reçu avant l’exécution des soins »', sigW - 20),
    margin + sigW + 40,
    y + 26,
  )

  return y + 56
}

/** Génère et télécharge le devis dentaire normalisé (proposé + optimisé) au format PDF. */
export function exportRapportPdf({
  sourceLabel,
  patientName,
  devis,
  res,
  totaux,
  garanties,
  optimisationMax,
  optimisation,
}: RapportData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const dateStr = new Date().toLocaleDateString('fr-FR')

  // --- Page 1 : devis proposé (initial) ---
  renderDevisForm(doc, {
    title: 'DEVIS DE SOINS DENTAIRES',
    subtitle: 'Devis initial — plan de traitement proposé',
    accent: BLUE,
    rows: buildRows(devis, res),
    totals: totaux,
    patientName,
    sourceLabel,
    dateStr,
    validiteStr: 'Validité : 6 mois',
  })

  // --- Page 2 : devis optimisé — remboursement maximal ---
  if (optimisationMax) {
    const r = computeDevis(optimisationMax.optimizedLines, garanties)
    const labels = optimisationMax.perLine.map((p) => p.optimNom)
    doc.addPage()
    renderDevisForm(doc, {
      title: 'DEVIS DE SOINS DENTAIRES',
      subtitle: 'Devis optimisé — remboursement maximal (reste à charge payable en plusieurs fois)',
      accent: GREEN,
      rows: buildRows(optimisationMax.optimizedLines, r, labels),
      totals: optimisationMax.totalsOptim,
      patientName,
      sourceLabel,
      dateStr,
      validiteStr: 'Validité : 6 mois',
    })
  }

  // --- Page 3 : devis optimisé — reste à charge 0 ---
  if (optimisation) {
    const optimRes = computeDevis(optimisation.optimizedLines, garanties)
    const labels = optimisation.perLine.map((p) => p.optimNom)
    doc.addPage()
    renderDevisForm(doc, {
      title: 'DEVIS DE SOINS DENTAIRES',
      subtitle: 'Devis optimisé — reste à charge 0',
      accent: GREEN,
      rows: buildRows(optimisation.optimizedLines, optimRes, labels),
      totals: optimisation.totalsOptim,
      patientName,
      sourceLabel,
      dateStr,
      validiteStr: 'Validité : 6 mois',
    })
  }

  const safeName = (patientName ?? 'patient').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  doc.save(`devis_dentaire_${safeName}.pdf`)
}
