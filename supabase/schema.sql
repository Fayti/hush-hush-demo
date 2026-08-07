-- ══════════════════════════════════════════════════════════════
-- Hush Hush — schéma complet de la guestlist
--
-- À exécuter tel quel dans un NOUVEAU projet Supabase :
--   Dashboard → SQL Editor → New query → coller → Run
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


-- ── Dernière étape : s'autoriser soi-même ─────────────────────
-- Remplacer par l'email du compte créé dans Authentication → Users.
insert into public.hush_hush_admins (email)
values ('antoine.vrgs31@gmail.com')
on conflict (email) do nothing;
