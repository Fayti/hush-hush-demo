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

Depuis la console, plus besoin de toucher au code :

**Soirées → Ajouter une soirée** → titre, date, heure de début (et de fin,
facultative), genre (Club / Music...), une ligne de description, une affiche
si vous en avez une. **Publier** — la soirée apparaît sur le site dans la
minute, avec sa propre page de guestlist.

Sans affiche, la carte s'affiche quand même — un fond de marque à la place de
l'image, jamais un vide. L'affiche peut être ajoutée plus tard : supprimer la
soirée et la recréer avec le fichier.

La prochaine date remonte automatiquement en tête avec le badge « Prochaine
soirée », les dates passées se grisent — rien à faire de plus.

Pour corriger une erreur (mauvaise date, doublon...) : la croix en bout de
ligne retire la soirée. C'est définitif, pas de modification en place — on
la recrée si besoin.

---

## Publier une annonce (annulation, changement d'horaire...)

**Annonces → Publier une annonce** → un type (Info / Changement / Annulation),
un message, et à qui ça s'adresse :

- **une soirée précise** → le message s'affiche sur sa carte, sous la
  description
- **« Tout le site »** → un bandeau en haut de toutes les pages (fermeture
  exceptionnelle, par exemple)

La croix retire l'annonce du site immédiatement.

---

## Ce que fait la console

- **Soirées** — ajouter, voir la liste, supprimer
- **Annonces** — publier, voir la liste, retirer
- les chiffres du soir : inscriptions, personnes sur la liste, plus gros groupe
- la répartition par soirée (qui remplit le plus)
- recherche par nom ou contact, filtre par soirée
- export CSV (lisible dans Excel, accents compris)
- suppression d'une inscription (erreur, doublon)

Tout le monde qui s'inscrit à la guestlist est **admis d'office** — il n'y a
rien à valider ni à pointer à l'entrée ; c'est un choix assumé, pas une
fonctionnalité qui manque.

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
Ce qui protège les données, c'est la RLS de Supabase — trois niveaux, pas un
seul :

- **guestlist** (noms, téléphones) — n'importe qui peut déposer une
  inscription ; **personne** ne peut en relire une sans être admin déclaré
- **soirées & annonces** — lecture publique assumée (c'est le contenu du
  site), mais écrire, modifier ou supprimer demande d'être admin
- **affiches** (Storage) — lues par tous, mais seul un admin peut en
  téléverser une, et uniquement dans `event-posters/` — jamais le reste du
  bucket, qui ne passe que par le déploiement du site

Vérifié à chaque fois en conditions réelles : lecture anonyme vide sur la
guestlist, écriture refusée sur les trois tables pour un visiteur non-admin
(y compris un compte anonyme authentifié, comme en crée Cotéa sur ce même
projet), écriture confirmée pour un admin déclaré.

---

## À vérifier avant de montrer au client

- **les horaires** en section Infos viennent d'articles de presse qui se
  contredisent légèrement
- les trois affiches en ligne sont des dates **passées** (31 juillet → 2 août) ;
  les remplacer par les prochaines depuis **Soirées → Ajouter une soirée**
