# Visual Diff — Zéro‑installation

Outil 100% navigateur pour :
1. Superposer rapidement un PNG (Figma / design) sur n’importe quelle page via un bookmarklet.
2. Comparer deux images (design ↔ capture) avec diff pixel ou perceptuel (SSIM).
3. Ajuster automatiquement l'overlay (bouton « Adapter dimensions overlay », Alt+clic = diagnostic verbeux).

Pas d’installation. Pas de build côté serveur. Aucune donnée envoyée.

## Fonctionnalités principales
- Superposition temps réel (opacité, position, échelle, modes de fusion CSS, grille, loupe, curseur avant/après, export, capture).
- Grille paramétrable (pas, opacité, couleur).
- Loupe haute fidélité (zoom jusqu’à 8×, image-rendering pixelated).
- Curseur « avant / après » (split dynamique ajustable).
- Export du viewport avec overlay, capture ponctuelle ou zone sélectionnée, capture plein‑page (scroll & stitch best‑effort).
- Mode difference avec auto‑max de l’opacité (retour à la valeur précédente en quittant difference).
- Palette fixe Desjardins pour l’overlay (simplifiée, plus de bascule de thème).
- Diagnostic d’ajustement (échelle / recentrage / compensation scrollbars) avec toast de résultat (intégré au bouton d'adaptation).
- Mode split optimisé (wrapper + transform) pour meilleures performances.
- Recalage fluide pendant le scroll (évite le glissement de l’overlay).
- Persistance par domaine (overlay) + persistance globale des préférences diff.
- Mode Image ↔ Image : Pixel diff rapide ou SSIM (approx. perceptuel), masques exclusifs multi‑zones, réglages anti faux positifs.

## Mise en route
1. Ouvrir `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari récents).
2. Glisser le lien « Superposition en direct » vers la barre de favoris. (Sinon « Copier le bookmarklet » puis créer un favori avec l’URL copiée.)
3. Aller sur la page à auditer et cliquer le favori.
4. Importer un PNG, ajuster avec les contrôles.
5. (Optionnel) Onglet « Image ↔ Image » pour diff hors page.

## Exemples / Jeux d’essai
- Page d’exemples générés : ouvrir `examples/examples.html` pour télécharger des paires A/B.
- Inclut maintenant une section « style Desjardins » synthétique (couleurs vertes, cartes, boutons) avec micro‑variations (teinte, radius, espacement, alignement, graisse, tracking) afin de produire des différences visibles.
- Aucune ressource réelle ni capture du site desjardins.com n’est incluse : tout est généré en canvas local.
- Utilisation : télécharger A et B puis charger dans l’onglet « Image ↔ Image » ou utiliser A comme overlay sur une page neutre.

## Panneau de superposition (contrôles)
- Importer : choisir l’image overlay (PNG / JPEG / WebP).
- Opacité / Échelle / X / Y.
- Fusion : normal, multiply, screen, overlay, difference, etc.
- Grille : activer + Pas / Opacité / Couleur.
- Loupe : activer + Taille + Zoom.
- Curseur (split) : activer + Position.
- Export overlay : PNG du viewport (tient compte du split).
- Adapter dimensions overlay (fit + diagnostic), Centrer, Masquer image, Réinitialiser, Fermer.

## ⌨️ Raccourcis (overlay)
| Touche | Action |
| ------ | ------ |
| Flèches | Déplacer (Maj = 10 px) |
| + / − | Zoom (Maj = plus rapide) |
| D | Difference on/off |
| G | Grille on/off |
| L | Loupe on/off |
| S | Curseur split on/off |
| X | Export overlay |
| P | Capture (invite / zone / plein‑page selon séquence) |
| H | Panneau on/off |
| (U retiré) | Fonction auto‑masque supprimée |
| Échap | Fermer overlay |

##  Mode Image ↔ Image
- A (design) + B (capture) : déposer / choisir.
- Mode : Pixel (rapide) ou SSIM (structure perceptuelle).
- Seuil : sensibilité (affiché %).
- Options : Luminance seule, Lisser (1 px), Tolérance bords (AA), Tolérance verticale (px).
	- Tolérance verticale : avant de compter une différence, si le pixel diffère on recherche une correspondance acceptable jusqu'à ±N lignes (même colonne). Si trouvée, le pixel est considéré identique (réduit les faux positifs dus à un léger glissement vertical).
	- 0 = désactivé (strict). 1–10 = absorption de petits décalages (limite volontaire pour ne pas masquer de vrais changements ni ralentir la comparaison).
	- N'affecte que le mode Pixel (SSIM gère déjà des fenêtres locales).
 	- Auto-désactivation : si un décalage global (translation) est détecté et appliqué, la tolérance verticale est désactivée pour éviter une double compensation.
- Masques exclus : dessiner rectangles à ignorer (multi‑zones). 
 La comparaison ignore toujours les zones hors chevauchement. Si les tailles diffèrent, un badge « Tailles des images différentes (A WxH / B WxH) » apparaît (avec dimensions brutes) et une mention dans le statut indique que seule la zone commune est évaluée.
 - Zones de focus (mode composant étendu) : bouton « Zones focus » pour entrer en mode ajout ; tracer une ou plusieurs zones d’intérêt (chaque relâche de souris ajoute une zone). Le diff est limité à l’union de ces zones, le reste est estompé. Meta/Ctrl+clic sur une zone pour la retirer. « Effacer focus » supprime toutes les zones et revient au mode global.
- Inverser / Effacer / Télécharger diff / Réinitialiser préférences.
 - Détecter décalage : analyse brute (±20 px) pour estimer un décalage (translation) global B→A et recadrer la zone de comparaison sur le chevauchement réel. Affiche le vecteur (dx,dy). « Réinit. décalage » annule. N'altère pas les images sources, uniquement la fenêtre comparée.
 - Inverser / Effacer / Télécharger diff / Réinitialiser préférences.

##  Persistance
- Overlay : paramètres stockés par hôte (`localStorage` clé par domaine).
- Diff images : préférences globales (seuil, options, couleur, masques en relatif si applicable).
- Thème : (supprimé, palette fixe). 

## Limitations / Notes
- Politiques CSP strictes peuvent empêcher un bookmarklet (rare). Solution : mode Image ↔ Image.
- Capture plein‑page dépend des limites d’API (peut être incomplète sur pages complexes ou animations fortes).
- Les grandes images ou zooms extrêmes peuvent impacter les performances (limiter > 8k de large).

## Développement
Structure clé :
- `index.html` : page de démonstration + code plain‑text du bookmarklet (source lisible).
- `scripts/injector.js` : version script autonome (même logique).
- (Option) `scripts/injector.min.js` : peut être régénéré (non automatisé ici).

Éditer la logique overlay : modifier le bloc bookmarklet dans `index.html`. (La variante multi‑thèmes a été retirée; scripts/injector.js à synchroniser si réintroduit.)

### Roadmap potentielle
- Option d’opacité adaptative sur difference.
- Mode de comparaison « par couches » (pile de versions).
- Export diff « overlay + page » combiné.
- Génération automatique du bookmarklet depuis un build.
- Ajustement automatique multi-stratégies plus précis (bounding client rect vs viewport partiel).
- Paramètres configurables pour la détection des nouveaux éléments (seuils surface / pourcentage partiel / liste d’exclusion sélecteurs).

##  Tests manuels rapides
- Charger overlay deux fois sur la même page : pas de doublon (réutilise état).
- Importer deux fois le même fichier : rechargé immédiatement (input recréé à chaque clic).
- Basculer difference : opacité passe à 100%, revenir restaure ancienne opacité.
- Thème Auto puis changer thème système : réinjection reflète le changement.

## Licence
DPSNI
---
Retour / idées bienvenus : ouvrez une issue ou proposez une PR.