# Hush Hush — Club

Deux pages, un seul dépôt.

| Page | Pour qui | Adresse |
|---|---|---|
| `index.html` | le public — lien à mettre en bio / story | `/` |
| `admin.html` | l'équipe Hush Hush — suivi des inscrits | `/admin.html` |

Site statique, sans dépendance ni build. Le stockage des demandes passe par
Supabase (projet `ileicboyfrmhxhqbywzw`).

## Le site public

Uniquement le **club** : les soirées et la guestlist. Rien sur le restaurant.
Les tables VIP ne passent pas par un formulaire — un seul numéro, le
**06 60 17 28 83**, présent dès le premier écran et dans sa propre section.

Le bouton d'une soirée ouvre une fenêtre où la date est déjà verrouillée :
il ne reste que le nom et un contact.

## La console

`/admin.html` — connexion par email et mot de passe, puis :

- les chiffres (demandes, personnes attendues, soirées, 7 derniers jours)
- la répartition par soirée
- la liste complète, filtrable et cherchable
- l'export CSV (lisible dans Excel)
- la suppression d'une demande

### Créer le compte d'accès

Le compte doit être créé **par vous**, dans le dashboard Supabase :

1. **Authentication → Users → Add user**
2. cocher *Auto Confirm User*, choisir email et mot de passe
3. autoriser cet email à lire la guestlist :

```sql
insert into public.hush_hush_admins (email) values ('email@duclient.com');
```

`antoine.vrgs31@gmail.com` est déjà autorisé.

### Pourquoi une table d'admins

Le projet Supabase héberge aussi Cotéa et ses 41 comptes. Une règle du type
« tout compte connecté peut lire » exposerait la guestlist à ces comptes.
La lecture est donc réservée aux emails listés dans `hush_hush_admins`.

Côté public, la table `hush_hush_guestlist` est en **écriture seule** :
n'importe qui peut envoyer une demande, personne ne peut lire celles des autres.

## Mise en ligne

GitHub Actions publie sur GitHub Pages à chaque `push` sur `main`.
Dans **Settings → Pages**, la source doit être **GitHub Actions**.

## Ajouter une soirée

Copier un bloc `<li class="event">` dans `index.html` et renseigner :

- `data-date` au format `AAAA-MM-JJ`
- `data-slug` (identifiant court, sans espace)
- `data-label` (ce qui apparaîtra dans la console)

La prochaine date remonte en tête avec un badge, les passées se grisent dès
qu'il y a une date à venir pour les contraster.

## Avant la vraie mise en ligne

- retirer le `<meta name="robots" content="noindex, nofollow">` de `index.html`
  (le garder sur `admin.html`)
- confirmer les horaires — les sources de presse se contredisent légèrement

## Crédits visuels

Logo, monogramme et affiches fournis par Hush Hush. Le monogramme et le
mot-symbole ont été détourés depuis les visuels d'origine.
