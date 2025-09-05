# Visual Diff — Zéro‑installation

Outil simple et 100% navigateur pour comparer un PNG (depuis Figma) au rendu d’une page web via un bookmarklet, ou comparer deux images avec un diff pixel. Aucune installation requise.

## Démarrage rapide

1) Ouvrez `index.html` dans votre navigateur.
2) Dans l’en‑tête, glissez le lien « Superposition en direct » dans votre barre de favoris, ou cliquez « Copier le bookmarklet » pour créer manuellement un favori.
3) Allez sur la page à vérifier, cliquez le favori « Superposition en direct », importez votre PNG Figma et alignez‑le.
4) Optionnel : dans l’onglet « Image ↔ Image », déposez deux images (design + capture) et lancez le diff.

## Superposition (bookmarklet)
- Importer une image : choisissez votre PNG (Figma) à superposer.
- Opacité : transparence de l’image.
- Échelle : agrandit/réduit pour s’aligner au rendu.
- X / Y : position (px) sur la page.
- Fusion : mode de fusion (normal, difference, multiply, etc.).
- Grille : aide à l’alignement.
	- Pas (px), Opacité, Couleur.
	(La “Couleur” concerne uniquement le quadrillage d’alignement.)
- Loupe : loupe circulaire pixelisée.
	- Taille, Zoom.
- Curseur (avant/après) : split vertical entre overlay et page.
	- Position (% largeur).
- Exporter l’overlay : télécharge un PNG de l’overlay visible dans le viewport (respecte le split).
- Capture (invite) : ouvre l’API de capture d’écran du navigateur et enregistre un PNG (fenêtre/écran choisis).
- Masquer : cache/affiche l’image superposée.
- UI on/off : affiche/masque le panneau (si masqué, utilisez le bouton « Afficher le panneau » en haut‑droite ou la touche H pour le réafficher).
- Auto‑masquer le panneau : cache automatiquement le panneau quand la souris le quitte; un bouton « Afficher le panneau » permet de le rouvrir.
- Réinitialiser : valeurs par défaut.
- Fermer : quitte l’overlay.

### Raccourcis (overlay)
- Flèches : déplacer (Maj = 10 px)
- + / − : échelle fine (Maj = plus rapide)
- D : mode difference
- G : grille on/off
- L : loupe on/off
- S : curseur on/off
- X : exporter l’overlay
- P : capture (invite)
- H : panneau on/off
- U : auto‑masquer panneau on/off
- Échap : fermer

## Image ↔ Image (diff pixel ou perceptuel)
- Zones A & B : déposez ou sélectionnez deux images (A = design Figma, B = capture d’écran).
- Mode : Pixel (rapide) ou SSIM (perceptuel, plus proche de l’œil humain).
- Seuil : affiché en pourcentage (0–100%). En mode Pixel, plus le pourcentage est bas, plus c’est sensible; en mode SSIM, c’est le niveau de similarité minimale.
- Options anti “faux positifs” :
	- Luminance seule : ignore les différences de teinte mineures (utile pour le texte).
	- Lisser (1 px) : petit flou avant comparaison pour atténuer l’anticrénelage.
	- Tolérance bords (AA) : moins strict près des contours forts.
- Masques (Ignorer une zone) : dessinez un ou plusieurs rectangles à exclure de la comparaison; déplacez-les, supprimez-en un via Cmd/Ctrl+clic. Les masques sont mémorisés et ré‑adaptés si la taille du canvas change.
- Réinitialiser préférences : remet le seuil, la couleur et les options par défaut.
- Lancer le diff : calcule et affiche la carte des différences.
- Inverser : échange A et B (y compris les noms affichés).
- Effacer : vide images, masques et rendu.
- Télécharger le diff : exporte le canvas en PNG.

## Confidentialité
- Tout se passe localement, dans votre navigateur. Aucune donnée n’est envoyée.
- Les réglages (position, échelle, grille, loupe, curseur…) ainsi que les préférences du diff et les masques sont mémorisés localement (par site pour le bookmarklet, globalement pour le diff).

## Limitations
- Par sécurité, on ne peut pas automatiser la capture d’un site sans extension/serveur. L’overlay permet une comparaison précise en direct.
- Rarement, certaines politiques de sécurité (CSP) peuvent bloquer les bookmarklets. Dans ce cas, utilisez l’onglet « Image ↔ Image ».

## Publication (facultatif)
- Hébergez ce dossier en statique (GitHub Pages, Netlify, Vercel…).
- Partagez l’URL ; les utilisateurs peuvent glisser le lien « Superposition en direct » directement depuis la page.

	## Guide utilisateur (FR)

	Superposition (bookmarklet)
	- Importer une image: sélectionnez votre PNG (Figma) à superposer sur la page.
	- Opacité: rend l’image plus/moins transparente pour voir le site derrière.
	- Échelle: agrandit/réduit l’image pour l’aligner au rendu réel.
	- X / Y: positionne précisément l’image (en pixels) sur l’axe horizontal/vertical.
	- Fusion: mode de fusion CSS (normal, difference, multiply…) pour révéler les écarts.
	- Grille: active/désactive l’aide à l’alignement.
		- Pas: distance entre les lignes (px).
		- Opacité: transparence de la grille.
		- Couleur: couleur des lignes.
	- Loupe: active une loupe circulaire près du pointeur.
		- Taille: diamètre de la loupe.
		- Zoom: niveau d’agrandissement pour inspecter les pixels.
	- Curseur (avant/après): split vertical pour comparer overlay vs page.
		- Position: place la séparation (en % de la largeur).
	- Exporter l’overlay: exporte un PNG du viewport avec l’overlay (respecte le split si actif).
	- Capture (invite): ouvre l’invite de capture d’écran du navigateur et enregistre une image PNG de l’écran/fenêtre choisie.
	- Masquer: cache/affiche l’image superposée (le panneau reste visible).
	- UI on/off: affiche/masque le panneau de contrôle (quand il est masqué, cliquez sur « Afficher le panneau » en haut‑droite ou pressez H pour le rouvrir).
	- Auto‑masquer le panneau: masque automatiquement le panneau quand la souris le quitte; un petit bouton « Afficher le panneau » ré‑ouvre le panneau.
	- Réinitialiser: remet tous les réglages par défaut.
	- Fermer: ferme complètement l’overlay et le panneau.

	Raccourcis clavier (overlay)
	- Flèches: déplacer (Maj = 10 px).
	- + / −: changer l’échelle finement (Maj = plus rapide).
	- D: basculer le mode “difference”.
	- G: activer/désactiver la grille.
	- L: activer/désactiver la loupe.
	- S: activer/désactiver le curseur (avant/après).
	- X: exporter l’overlay en PNG.
	- P: ouvrir l’invite de capture d’écran.
	- H: afficher/masquer le panneau.
	- U: activer/désactiver l’auto‑masquage du panneau.
	- Échap: fermer l’overlay.

	Image ↔ Image (diff pixel)
	- Zones A/B: déposez ou choisissez deux images (A = design Figma, B = capture d’écran).
	- Seuil: sensibilité du diff (0 = très sensible, 255 = peu sensible).
	- Couleur de surbrillance: couleur utilisée pour marquer les pixels différents.
	- Lancer le diff: calcule et affiche la carte des différences.
	- Inverser: échange les images A et B.
	- Effacer: vide les images et réinitialise la zone de rendu.

	Notes
	- Tout se passe localement dans le navigateur (aucun envoi de données).
	- Les paramètres (position, échelle, grille, loupe, curseur…) sont mémorisés automatiquement par site.