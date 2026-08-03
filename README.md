# Hush Hush — site vitrine

Démo du site pour [Hush Hush Toulouse](https://www.instagram.com/hush_hush_toulouse/),
rooftop éphémère sur le toit de la Médiathèque José Cabanis.

Site statique, sans dépendance : `index.html`, `styles.css`, `script.js` et `assets/`.
Rien à installer, rien à compiler.

## Mise en ligne

Déployé par GitHub Actions sur GitHub Pages à chaque `push` sur `main`
(même fonctionnement que le prototype Cotéa).

Dans **Settings → Pages**, la source doit être réglée sur **GitHub Actions**.

## Ajouter une soirée

Copier un bloc `<li class="event">` dans `index.html` et renseigner `data-date`
au format `AAAA-MM-JJ`. Le reste est automatique : la prochaine date remonte en
tête de grille avec un badge, les dates passées se grisent dès qu'il y a une
date à venir pour les contraster.

## Avant la vraie mise en ligne

- retirer le `<meta name="robots" content="noindex, nofollow">` dans `index.html`
  (présent pour garder la démo hors de Google)
- remplacer `EMAIL_RESERVATION` en haut de `script.js` par la vraie adresse
- vérifier le téléphone : celui affiché vient d'un article de presse et pourrait
  être celui de la médiathèque
- confirmer les horaires (les sources consultées se contredisent légèrement)

## Crédits visuels

Logo, monogramme et affiches fournis par Hush Hush. Le monogramme et le
mot-symbole ont été détourés depuis les visuels d'origine (`assets/*-cream.png`,
`assets/*-maroon.png`).
