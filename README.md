# Hush Hush — Club

Site du **club** uniquement : les soirées, la guestlist pour entrer, les tables
VIP par téléphone. Volontairement séparé du restaurant, pour qu'il n'y ait
aucune confusion possible.

- Page publique — `index.html` (lien à mettre en story)
- Console de gestion — `admin.html` (privée, connexion obligatoire)

Site statique, sans dépendance ni build. Déployé sur GitHub Pages à chaque
`push` sur `main`.

---

## Les deux liens

| | |
|---|---|
| Public | https://fayti.github.io/hush-hush-demo/ |
| Console | https://fayti.github.io/hush-hush-demo/admin.html |

Les deux pages portent `noindex, nofollow` : introuvables sur Google, elles
n'existent que pour qui a le lien. À retirer d'`index.html` seulement le jour
d'une vraie mise en ligne publique.

---

## Ouvrir la console la première fois

**Le piège :** votre compte supabase.com ne fonctionne pas ici. C'est un compte
pour administrer Supabase, pas un utilisateur *du projet*. Il faut créer
l'utilisateur dans le projet lui-même :

1. https://supabase.com/dashboard/project/ileicboyfrmhxhqbywzw/auth/users
   (menu de gauche → **Authentication** → onglet **Users**)
2. Bouton vert **Add user** → *Create new user*
3. **Cocher « Auto Confirm User »**, sinon la connexion sera refusée
4. Utiliser `antoine.vrgs31@gmail.com` — cet email est déjà autorisé en lecture

Pour donner l'accès à quelqu'un d'autre ensuite, deux choses : créer son
utilisateur comme ci-dessus, puis l'autoriser :

```sql
insert into public.hush_hush_admins (email) values ('email@duclient.com');
```

---

## Faut-il le plan Pro ?

**Non.** Le plan gratuit suffit très largement : la guestlist pèse quelques
kilo-octets, et le gratuit couvre 500 Mo de base, 50 000 connexions par mois et
2 projets actifs par organisation.

Deux réserves, à connaître :

- Un projet gratuit **se met en pause après 7 jours sans aucune activité**. En
  pleine saison le site est visité, donc aucun risque ; c'est entre deux saisons
  qu'il faut y penser (une visite suffit à le réveiller, mais la remise en route
  prend une minute).
- Le gratuit n'a pas de sauvegardes automatiques quotidiennes. Pour une
  guestlist, l'export CSV depuis la console fait office de filet.

Le Pro (~25 $/mois) n'apporte ici que ces deux points. À prendre le jour où le
club en dépend vraiment, pas avant.

---

## Changer de projet Supabase

Le jour où le site basculera sur l'organisation « Hush Hush » :

1. Créer le nouveau projet
2. **SQL Editor** → coller tout `supabase/schema.sql` → *Run*
   (crée les tables, la sécurité et les autorisations d'un coup)
3. Créer l'utilisateur admin — voir plus haut
4. Reporter l'URL et la clé anon dans **`config.js`**, seul fichier à toucher
   (Project Settings → API)
5. `git push` — le site se redéploie tout seul

---

## Ajouter une soirée

Copier un bloc `<li class="event">` dans `index.html` et renseigner :

- `data-date` au format `AAAA-MM-JJ`
- `data-slug` — identifiant court, sans espace ni accent
- `data-label` — ce qui apparaîtra dans la console et l'export

Le reste est automatique : la prochaine date remonte en tête avec le badge
« Prochaine soirée », les dates passées se grisent, et le bouton Guestlist de la
carte ouvre la fenêtre avec la bonne soirée déjà chargée.

---

## Ce que fait la console

- les chiffres du soir : demandes, personnes attendues, déjà entrées
- la répartition par soirée
- **le pointage à l'entrée** : on coche au fur et à mesure, la ligne s'estompe ;
  le filtre « Reste à faire entrer » ne garde que ceux qu'on attend encore
- recherche par nom ou contact, filtre par soirée
- export CSV (lisible dans Excel, accents compris)
- suppression d'une demande

La session se renouvelle toute seule : pas de déconnexion en pleine soirée.

---

## Données de démonstration

La base contient 7 inscriptions fictives pour que la console ne soit pas vide
lors de la présentation. Elles portent toutes `message = 'DEMO'`. Pour les
effacer d'un coup, avant la vraie exploitation :

```sql
delete from public.hush_hush_guestlist where message = 'DEMO';
```

---

## Sécurité

Le site est statique : il n'embarque que la clé **anon**, publique par nature.
Ce qui protège les données, c'est la RLS de Supabase :

- n'importe qui peut **déposer** une demande de guestlist
- **personne** ne peut en relire une sans être un admin déclaré
- pointer une arrivée ou supprimer demande aussi d'être admin

Vérifié : une lecture anonyme de la table renvoie une liste vide, même juste
après avoir inséré une ligne.

---

## À vérifier avant de montrer au client

- **les horaires** en section Infos viennent d'articles de presse qui se
  contredisent légèrement
- les trois affiches en ligne sont des dates **passées** (31 juillet → 2 août) ;
  les remplacer par les dates à venir
