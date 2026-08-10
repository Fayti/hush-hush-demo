-- ══════════════════════════════════════════════════════════════
-- Hush Hush — schéma complet du site (soirées, annonces, guestlist)
--
-- À exécuter tel quel dans un NOUVEAU projet Supabase :
--   SQL Editor → New query → coller ce fichier → Run
-- (le bucket Storage est créé par le script lui-même, plus bas)
--
-- Idempotent : on peut le relancer sans casser l'existant.
-- ══════════════════════════════════════════════════════════════


-- ── Qui a le droit de consulter la guestlist ──────────────────
-- On liste des emails plutôt que des UUID : ça reste lisible, et
-- ça marche même si le compte Auth est créé après coup.
create table if not exists public.hush_hush_admins (
  email     text primary key,
  ajoute_le timestamptz not null default now()
);

comment on table public.hush_hush_admins is
  'Emails autorisés à ouvrir la console guestlist (admin.html).';

alter table public.hush_hush_admins enable row level security;

drop policy if exists "admin voit sa propre ligne" on public.hush_hush_admins;
create policy "admin voit sa propre ligne"
  on public.hush_hush_admins
  for select
  to authenticated
  using (email = auth.jwt() ->> 'email');


-- ── Les demandes de guestlist ─────────────────────────────────
create table if not exists public.hush_hush_guestlist (
  id          uuid primary key default gen_random_uuid(),
  event_slug  text not null,
  event_label text not null,
  nom         text not null,
  contact     text not null,
  personnes   smallint not null default 2,
  message     text,
  arrive      boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint hush_hush_guestlist_nom_len       check (char_length(nom) between 1 and 120),
  constraint hush_hush_guestlist_contact_len   check (char_length(contact) between 3 and 120),
  constraint hush_hush_guestlist_event_len     check (char_length(event_slug) between 1 and 60),
  constraint hush_hush_guestlist_message_len   check (message is null or char_length(message) <= 600),
  constraint hush_hush_guestlist_personnes_range check (personnes between 1 and 20)
);

comment on table public.hush_hush_guestlist is
  'Demandes envoyées depuis le site. Écriture ouverte à tous, lecture réservée aux admins.';
comment on column public.hush_hush_guestlist.arrive is
  'Coché depuis la console quand la personne se présente à l''entrée.';

create index if not exists hush_hush_guestlist_created_idx
  on public.hush_hush_guestlist (created_at desc);

alter table public.hush_hush_guestlist enable row level security;


-- ── Les règles d'accès ────────────────────────────────────────
-- Le site est statique : il n'a que la clé anon, publique. Toute la
-- protection tient donc dans ces quatre policies.
--
-- Attention si le projet héberge aussi une app à connexion anonyme
-- (c'était le cas en cohabitation avec Cotéa) : un visiteur anonyme
-- porte quand même le rôle `authenticated`. Ce qui le bloque ici, ce
-- n'est donc pas le rôle mais la comparaison d'email — son jeton n'a
-- pas de claim `email`, la condition vaut NULL, donc faux.
-- Vérifié en conditions réelles : lecture vide, UPDATE et DELETE sans
-- effet. L'analyseur Supabase signalera malgré tout ces tables sous
-- « Anonymous Access Policies » : c'est attendu, pas une faille.

-- 1. N'importe quel visiteur peut déposer une demande…
drop policy if exists "public insert guestlist request" on public.hush_hush_guestlist;
create policy "public insert guestlist request"
  on public.hush_hush_guestlist
  for insert
  to anon
  with check (true);

-- 2. …mais aucun visiteur ne peut relire quoi que ce soit.
--    (Pas de policy SELECT pour anon = tout est refusé par défaut.)

-- 3. Un admin connecté lit toute la liste.
drop policy if exists "admin lit la guestlist" on public.hush_hush_guestlist;
create policy "admin lit la guestlist"
  on public.hush_hush_guestlist
  for select
  to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

-- 4. Un admin pointe les arrivées et supprime les demandes.
drop policy if exists "admin pointe une arrivee" on public.hush_hush_guestlist;
create policy "admin pointe une arrivee"
  on public.hush_hush_guestlist
  for update
  to authenticated
  using      (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin supprime une demande" on public.hush_hush_guestlist;
create policy "admin supprime une demande"
  on public.hush_hush_guestlist
  for delete
  to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));


-- ── Les soirées ────────────────────────────────────────────────
-- Contrairement à la guestlist (noms/téléphones, privés), celle-ci
-- est faite pour être lue par n'importe quel visiteur : c'est le
-- contenu même du site public. Gérée depuis la console (bloc
-- « Soirées ») — plus besoin de toucher au code pour ajouter une date.
create table if not exists public.hush_hush_events (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  titre        text not null,
  genre        text not null default 'Club',
  event_date   date not null,
  heure_debut  time not null,
  heure_fin    time,
  description  text,
  affiche_url  text,
  actif        boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint hush_hush_events_slug_len  check (char_length(slug) between 1 and 80),
  constraint hush_hush_events_titre_len check (char_length(titre) between 1 and 120)
);

comment on table public.hush_hush_events is
  'Soirées affichées sur le site. Lecture publique (actif=true) ; écriture réservée aux admins.';

create index if not exists hush_hush_events_date_idx on public.hush_hush_events (event_date);

alter table public.hush_hush_events enable row level security;

drop policy if exists "public read active events" on public.hush_hush_events;
create policy "public read active events"
  on public.hush_hush_events for select
  using (actif = true);

drop policy if exists "admin read all events" on public.hush_hush_events;
create policy "admin read all events"
  on public.hush_hush_events for select to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin insert events" on public.hush_hush_events;
create policy "admin insert events"
  on public.hush_hush_events for insert to authenticated
  with check (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin update events" on public.hush_hush_events;
create policy "admin update events"
  on public.hush_hush_events for update to authenticated
  using      (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin delete events" on public.hush_hush_events;
create policy "admin delete events"
  on public.hush_hush_events for delete to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));


-- ── Les annonces (annulation, changement d'horaire...) ──────────
-- event_slug NULL = concerne tout le site (bandeau en haut de page) ;
-- sinon affichée uniquement sur la carte de la soirée visée.
create table if not exists public.hush_hush_notices (
  id         uuid primary key default gen_random_uuid(),
  type       text not null default 'info',
  message    text not null,
  event_slug text references public.hush_hush_events(slug) on delete cascade,
  actif      boolean not null default true,
  created_at timestamptz not null default now(),
  constraint hush_hush_notices_type_valide check (type in ('info', 'changement', 'annulation')),
  constraint hush_hush_notices_message_len check (char_length(message) between 1 and 300)
);

comment on table public.hush_hush_notices is
  'Annonces (annulation, changement...) affichées sur le site.';

alter table public.hush_hush_notices enable row level security;

drop policy if exists "public read active notices" on public.hush_hush_notices;
create policy "public read active notices"
  on public.hush_hush_notices for select
  using (actif = true);

drop policy if exists "admin read all notices" on public.hush_hush_notices;
create policy "admin read all notices"
  on public.hush_hush_notices for select to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin insert notices" on public.hush_hush_notices;
create policy "admin insert notices"
  on public.hush_hush_notices for insert to authenticated
  with check (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "admin delete notices" on public.hush_hush_notices;
create policy "admin delete notices"
  on public.hush_hush_notices for delete to authenticated
  using (exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email'));


-- ── Le bucket qui sert le site et les affiches ─────────────────
-- Public en lecture : c'est lui qui sert aussi styles.css, script.js
-- et les fichiers de assets/ une fois le site déployé dedans (ou,
-- comme ici, référencés en relatif depuis GitHub Pages — le bucket
-- ne sert alors que les affiches ajoutées depuis la console).
insert into storage.buckets (id, name, public)
values ('hush-hush', 'hush-hush', true)
on conflict (id) do update set public = true;

drop policy if exists "public read hush hush" on storage.objects;
create policy "public read hush hush"
  on storage.objects for select
  using (bucket_id = 'hush-hush');

-- ── Téléversement des affiches ───────────────────────────────────
-- Le droit d'écrire, réservé aux admins et cantonné au dossier
-- event-posters/ — jamais le reste du bucket.
drop policy if exists "admin upload event poster" on storage.objects;
create policy "admin upload event poster"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hush-hush'
    and name like 'event-posters/%'
    and exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email')
  );

drop policy if exists "admin replace event poster" on storage.objects;
create policy "admin replace event poster"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hush-hush'
    and name like 'event-posters/%'
    and exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email')
  )
  with check (
    bucket_id = 'hush-hush'
    and name like 'event-posters/%'
    and exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email')
  );

drop policy if exists "admin delete event poster" on storage.objects;
create policy "admin delete event poster"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'hush-hush'
    and name like 'event-posters/%'
    and exists (select 1 from public.hush_hush_admins a where a.email = auth.jwt() ->> 'email')
  );

-- ── Dernière étape : s'autoriser soi-même ─────────────────────
-- Remplacer par l'email du compte créé dans Authentication → Users.
insert into public.hush_hush_admins (email)
values ('antoine.vrgs31@gmail.com')
on conflict (email) do nothing;


-- ── Deux soirées d'exemple, à retirer une fois les vraies dates
--    ajoutées depuis la console ────────────────────────────────
insert into public.hush_hush_events (slug, titre, genre, event_date, heure_debut, heure_fin, description) values
  ('exemple-soiree-1', 'Nom de l’artiste', 'Club', current_date + 7,  '22:00', '03:00', 'DJ set sur la terrasse'),
  ('exemple-soiree-2', 'Nom de l’artiste', 'Music', current_date + 14, '22:00', '02:00', 'DJ set sur le rooftop')
on conflict (slug) do nothing;
