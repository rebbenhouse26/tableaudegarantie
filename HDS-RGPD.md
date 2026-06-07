# Conformité — Hébergement de Données de Santé (HDS) & RGPD

> Ce guide est une aide à la mise en conformité, **pas un avis juridique**. Pour un usage réel,
> faites valider par un DPO / juriste santé.

## 1. Pourquoi c'est obligatoire

L'app traite des **données de santé** (tableaux de garanties, devis dentaires, identité patient).
En France :
- Tout traitement de données de santé relève du **RGPD** (catégorie « particulière », art. 9).
- Leur **hébergement** doit être confié à un **Hébergeur de Données de Santé certifié HDS**
  (article L.1111-8 du Code de la santé publique).

**Conséquence directe :** le **backend + la base de données** (qui stockent ces données) doivent
être sur un hébergeur **HDS**. Render, Fly.io, Vercel, Heroku **ne sont pas HDS**.

## 2. Choisir un hébergeur HDS

Hébergeurs certifiés HDS courants (back + base) :
- **OVHcloud** — offres « HDS » (Hosted Private Cloud, Managed Kubernetes, Public Cloud HDS).
- **Scaleway** — périmètre HDS.
- **AWS / Microsoft Azure / Google Cloud** — régions UE + attestation HDS (plus complexe/cher).
- Acteurs santé : Claranet, Cegedim, OVH Healthcare…

À vérifier : **certificat HDS en cours de validité**, **données en UE**, **contrat (DPA)** signé,
chiffrement au repos, sauvegardes, journalisation des accès.

> Le front (React) peut rester sur un CDN (Vercel) **car il ne stocke rien** : il transmet au back HDS.
> Par prudence, beaucoup mettent **tout** sur l'HDS (option A du `DEPLOY.md`).

## 3. Mesures techniques (déjà en place ou à activer)

- [x] Mots de passe **hashés** (bcrypt) — cabinets et patients.
- [x] Sessions par **JWT** signé (`JWT_SECRET` fort en prod).
- [x] Cloisonnement : un cabinet n'accède qu'à ses patients (vérifié par tests).
- [x] Estimations marquées **non contractuelles**.
- [ ] **HTTPS/TLS** partout (à activer à l'hébergement).
- [ ] **Chiffrement au repos** du volume de base + **sauvegardes** chiffrées régulières.
- [ ] **Journalisation** des accès aux données (qui consulte quoi).
- [ ] **Rate-limiting** + limite de taille d'upload + monitoring (Sentry).
- [ ] Régénérer la **clé API Gemini** (l'ancienne a été exposée).

## 4. Mesures RGPD (organisationnelles)

- **Base légale** : consentement du patient (case à cocher au dépôt — implémentée) et/ou exécution
  du contrat de soins.
- **Information** : politique de confidentialité, CGU, mentions légales (pages `/confidentialite`,
  `/cgu`, `/mentions-legales` dans l'app).
- **Minimisation** : ne collecter que le nécessaire (garanties, devis, identité).
- **Durée de conservation** : définir et documenter (ex. suppression X mois après le devis, ou à la
  demande). Prévoir une purge automatique.
- **Droits des personnes** : accès, rectification, **effacement**, portabilité → procédure + contact.
- **Sous-traitants** : Gemini (Google), Brevo, Alma/Klarna, hébergeur → lister dans le registre,
  signer les **DPA**, vérifier les transferts hors UE (Gemini = à encadrer / ou alternative UE).
- **Registre des traitements** (art. 30) + **AIPD/DPIA** (analyse d'impact, recommandée pour données
  de santé) + désignation éventuelle d'un **DPO**.
- **Notification CNIL** en cas de violation (< 72 h).

## 5. Point de vigilance : Gemini (Google)

L'extraction envoie les images à l'API Google Gemini (potentiellement hors UE). Options :
1. Encadrer le transfert (clauses contractuelles, mention dans la politique de confidentialité, consentement).
2. Utiliser une offre **Vertex AI région UE** avec engagement de non-réutilisation des données.
3. Basculer sur l'**OCR local** (déjà prévu en repli) pour ne rien envoyer à un tiers.

## 6. Durées de conservation — proposition de départ

| Donnée | Conservation proposée |
|---|---|
| Tableau de garanties / devis patient | jusqu'à 12 mois après le dernier devis, puis purge |
| Compte cabinet | tant que le compte est actif |
| Document original déposé (image/PDF) | supprimable à tout moment par le cabinet |

À adapter et inscrire dans la politique de confidentialité.
