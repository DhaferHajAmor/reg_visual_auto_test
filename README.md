# Visual Diff — Zéro‑installation

Outil 100% navigateur pour :
1. Superposer rapidement un PNG (Figma / design) sur n’importe quelle page via un bookmarklet.
2. Comparer deux images (design ↔ capture) avec diff pixel ou perceptuel (SSIM).

Pas d’installation. Pas de build côté serveur. Aucune donnée envoyée.

## Fonctionnalités principales
- Superposition temps réel (opacité, position, échelle, modes de fusion CSS, grille, loupe, curseur avant/après, export, capture).
- Grille paramétrable (pas, opacité, couleur).
- Loupe haute fidélité (zoom jusqu’à 8×, image-rendering pixelated).
- Curseur « avant / après » (split dynamique ajustable).
- Export du viewport avec overlay, capture ponctuelle ou zone sélectionnée, capture plein‑page (scroll & stitch best‑effort).
- Mode difference avec auto‑max de l’opacité (retour à la valeur précédente en quittant difference).
- Thèmes intégrés overlay : Auto (système), Sombre, Desjardins (avec palette personnalisée).
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
- Auto‑masquer : cache le panneau après sortie souris (réafficher via bouton rond). 
- Export overlay : PNG du viewport (tient compte du split).
- Ajuster au viewport, Centrer, Masquer image, Réinitialiser, Fermer.
- Thème : Auto / Sombre / Desjardins (en haut‑droite du panneau).

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
| U | Auto‑masque panneau on/off |
| Échap | Fermer overlay |

##  Mode Image ↔ Image
- A (design) + B (capture) : déposer / choisir.
- Mode : Pixel (rapide) ou SSIM (structure perceptuelle).
- Seuil : sensibilité (affiché %).
- Options : Luminance seule, Lisser (1 px), Tolérance bords (AA).
- Masques exclus : dessiner rectangles à ignorer (multi‑zones). 
- Inverser / Effacer / Télécharger diff / Réinitialiser préférences.

##  Persistance
- Overlay : paramètres stockés par hôte (`localStorage` clé par domaine).
- Thème : `VD::theme` (valeurs `dark`, `desjardins`, `auto`). 
- Diff images : préférences globales (seuil, options, couleur, masques en relatif si applicable).

##  Confidentialité
Tout reste local. Aucune requête réseau générée par les fonctionnalités (hors APIs navigateur standard comme capture d’écran si autorisée par l’utilisateur).

## Limitations / Notes
- Politiques CSP strictes peuvent empêcher un bookmarklet (rare). Solution : mode Image ↔ Image.
- Capture plein‑page dépend des limites d’API (peut être incomplète sur pages complexes ou animations fortes).
- Les grandes images ou zooms extrêmes peuvent impacter les performances (limiter > 8k de large).

## Développement
Structure clé :
- `index.html` : page de démonstration + code plain‑text du bookmarklet (source lisible).
- `scripts/injector.js` : version script autonome (même logique).
- (Option) `scripts/injector.min.js` : peut être régénéré (non automatisé ici).

Éditer la logique overlay : modifier à la fois le bloc bookmarklet dans `index.html` et `scripts/injector.js` pour rester aligné.

### Minification (suggestion)
Outils possibles : esbuild, terser. Exemple (à adapter) :
```
esbuild scripts/injector.js --minify --outfile=scripts/injector.min.js
```

### Roadmap potentielle
- Option d’opacité adaptative sur difference.
- Mode de comparaison « par couches » (pile de versions).
- Export diff « overlay + page » combiné.
- Génération automatique du bookmarklet depuis un build.

##  Tests manuels rapides
- Charger overlay deux fois sur la même page : pas de doublon (réutilise état).
- Importer deux fois le même fichier : rechargé immédiatement (input recréé à chaque clic).
- Basculer difference : opacité passe à 100%, revenir restaure ancienne opacité.
- Thème Auto puis changer thème système : réinjection reflète le changement.

## 📄 Licence
DPSNI
---
Retour / idées bienvenus : ouvrez une issue ou proposez une PR.