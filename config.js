/* ══════════════════════════════════════════════════════════════
   Hush Hush — configuration Supabase

   C'EST LE SEUL FICHIER À MODIFIER si le site change de projet
   Supabase (nouvelle organisation, nouveau projet…).

   Où trouver ces deux valeurs :
   Dashboard Supabase → votre projet → Project Settings → API
     • URL              → « Project URL »
     • ANON_KEY         → « anon / public », la clé publiable

   La clé anon est PUBLIQUE par nature : elle part dans le navigateur
   de chaque visiteur. Ce qui protège les données, ce n'est pas elle,
   c'est la RLS (Row Level Security) posée sur les tables :
     • n'importe qui peut INSÉRER une demande de guestlist
     • personne ne peut la RELIRE sans être un admin déclaré
   Voir supabase/schema.sql pour le détail.
   ══════════════════════════════════════════════════════════════ */

window.HUSH_HUSH = {
  SUPABASE_URL: 'https://ileicboyfrmhxhqbywzw.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsZWljYm95ZnJtaHhocWJ5d3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzkxOTMsImV4cCI6MjEwMDQ1NTE5M30.vVtuVPCf3VpnWLYf7LtY4hK1o7EKS31P9mlEWicjYOQ',
};
