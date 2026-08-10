/* Hush Hush — console guestlist (page privée) */
(() => {
  'use strict';

  /* Réglages Supabase : voir config.js, seul fichier à modifier. */
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.HUSH_HUSH || {};

  const CLE_SESSION = 'hushhush.session';

  const $ = id => document.getElementById(id);

  /* Écoute défensive : si un élément manque (page HTML servie depuis un
     cache plus ancien que ce script, par exemple), on l'ignore au lieu
     de faire planter tout le fichier — un plantage ici laisserait
     l'utilisateur devant une page blanche. */
  const ecouter = (id, evenement, fn) => {
    const el = $(id);
    if (el) el.addEventListener(evenement, fn);
    else console.warn(`[console] élément « ${id} » absent de la page`);
  };

  const vueConnexion = $('connexion');
  const vueConsole = $('console');
  const formConnexion = $('form-connexion');
  const statutConnexion = $('connexion-status');

  let session = null;      // { access_token, refresh_token, email, expire_le }
  let demandes = [];       // toutes les demandes chargées
  let evenements = [];     // soirées (hush_hush_events)
  let annonces = [];       // annonces (hush_hush_notices)
  let enDemo = false;      // admin.html?demo=1 : tout reste local, rien n'est envoyé

  /* ── Session ──
     Le jeton Supabase ne vit qu'une heure. On garde le refresh_token
     pour le renouveler en silence : sans ça, la console se ferait
     éjecter en pleine soirée.                                        */

  const lireSession = () => {
    try { return JSON.parse(localStorage.getItem(CLE_SESSION)); }
    catch { return null; }
  };
  const ecrireSession = s => localStorage.setItem(CLE_SESSION, JSON.stringify(s));
  const effacerSession = () => localStorage.removeItem(CLE_SESSION);

  const memoriser = (data, emailReplique) => {
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      email: data.user?.email || emailReplique,
      // 60 s de marge pour ne jamais présenter un jeton tout juste périmé
      expire_le: Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000,
    };
    ecrireSession(session);
  };

  const afficherConnexion = message => {
    session = null;
    effacerSession();
    if (vueConsole) vueConsole.hidden = true;
    if (vueConnexion) vueConnexion.hidden = false;
    if (statutConnexion) {
      statutConnexion.classList.toggle('is-error', Boolean(message));
      statutConnexion.textContent = message || '';
    }
  };

  const afficherConsole = () => {
    if (vueConnexion) vueConnexion.hidden = true;
    if (vueConsole) vueConsole.hidden = false;
    const moi = $('console-moi');
    if (moi) moi.textContent = session.email;
  };

  /* Message d'état de la console : jamais d'écran vide sans explication. */
  const etat = texte => {
    const zone = $('console-etat');
    if (!zone) return;
    zone.textContent = texte || '';
    zone.hidden = !texte;
  };

  /* Renouvelle le jeton. Renvoie true si on repart avec une session valable. */
  const renouveler = async () => {
    if (!session?.refresh_token) return false;
    try {
      const reponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!reponse.ok) return false;
      memoriser(await reponse.json(), session.email);
      return true;
    } catch {
      return false;
    }
  };

  /* ── Appels API ──
     Renouvelle avant de partir si le jeton est expiré, et retente une
     fois si le serveur répond quand même 401.                        */

  const api = async (chemin, options = {}) => {
    if (session && Date.now() >= session.expire_le && !(await renouveler())) {
      afficherConnexion('Session expirée, reconnectez-vous.');
      return null;
    }

    const envoyer = () => fetch(`${SUPABASE_URL}${chemin}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    let reponse = await envoyer();

    if (reponse.status === 401) {
      if (!(await renouveler())) {
        afficherConnexion('Session expirée, reconnectez-vous.');
        return null;
      }
      reponse = await envoyer();
    }

    return reponse;
  };

  /* ── Connexion ── */

  formConnexion?.addEventListener('submit', async e => {
    e.preventDefault();

    if (!formConnexion.checkValidity()) {
      statutConnexion.classList.add('is-error');
      statutConnexion.textContent = 'Email et mot de passe sont nécessaires.';
      return;
    }

    const bouton = formConnexion.querySelector('button[type="submit"]');
    bouton.disabled = true;
    statutConnexion.classList.remove('is-error');
    statutConnexion.textContent = 'Connexion…';

    try {
      const email = $('email').value.trim();
      const reponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: $('motdepasse').value }),
      });

      const data = await reponse.json();
      if (!reponse.ok) throw new Error(enFrancais(data.error_description || data.msg || data.error));

      memoriser(data, email);
      formConnexion.reset();
      statutConnexion.textContent = '';
      afficherConsole();
      await charger();
    } catch (err) {
      statutConnexion.classList.add('is-error');
      statutConnexion.textContent = err.message;
    } finally {
      bouton.disabled = false;
    }
  });

  ecouter('deconnexion', 'click', () => afficherConnexion());

  /* ── Chargement des demandes ── */

  const charger = async () => {
    etat('Chargement…');

    const reponse = await api('/rest/v1/hush_hush_guestlist?select=*&order=created_at.desc');
    if (!reponse) return;                       // session perdue, déjà géré

    if (reponse.status === 403) {
      return afficherConnexion(
        'Ce compte n’est pas autorisé. Ajoutez son email dans la table hush_hush_admins.'
      );
    }
    if (!reponse.ok) return afficherConnexion('Impossible de charger les demandes.');

    demandes = await reponse.json();

    /* Piège : quand la RLS filtre tout, PostgREST renvoie 200 avec une
       liste vide — pas une erreur. Sans ce contrôle, un compte non
       autorisé verrait une console vide sans comprendre pourquoi.     */
    if (!demandes.length) {
      const verif = await api(
        `/rest/v1/hush_hush_admins?select=email&email=eq.${encodeURIComponent(session.email)}`
      );
      const autorise = verif && verif.ok && (await verif.json()).length > 0;

      if (!autorise) {
        return afficherConnexion(
          `Le compte ${session.email} n’est pas autorisé à lire la guestlist. ` +
          'Exécutez dans le SQL Editor : ' +
          `insert into public.hush_hush_admins (email) values ('${session.email}');`
        );
      }
      etat('Aucune inscription pour le moment.');
    } else {
      etat('');
    }

    remplirFiltre();
    dessiner();
    await chargerEvenementsEtAnnonces();
  };

  ecouter('rafraichir', 'click', charger);

  /* ── Soirées & annonces ──
     Contenu public (lu par n'importe quel visiteur, RLS ouverte en
     lecture) mais écrit uniquement par un admin connecté — d'où l'appel
     via api() pour porter le jeton, même si un GET marcherait aussi
     avec la simple clé anon.                                        */

  const chargerEvenementsEtAnnonces = async () => {
    const [repEv, repAv] = await Promise.all([
      api('/rest/v1/hush_hush_events?select=*&order=event_date.asc'),
      api('/rest/v1/hush_hush_notices?select=*&order=created_at.desc'),
    ]);
    evenements = (repEv && repEv.ok) ? await repEv.json() : [];
    annonces = (repAv && repAv.ok) ? await repAv.json() : [];
    remplirSelectSoirees();
    dessinerSoirees();
    dessinerAnnonces();
  };

  const remplirSelectSoirees = () => {
    const select = $('av-soiree');
    if (!select) return;
    const actuel = select.value;
    select.innerHTML = '<option value="">Tout le site</option>' +
      evenements.map(ev => `<option value="${echapper(ev.slug)}">${echapper(ev.titre)} — ${dateCourteJJMM(ev.event_date)}</option>`).join('');
    select.value = actuel;
  };

  /* ── Soirées : formulaire ── */

  const formSoiree = $('form-soiree');
  const statutSoiree = $('soiree-status');

  ecouter('toggle-form-soiree', 'click', () => {
    if (!formSoiree) return;
    formSoiree.hidden = !formSoiree.hidden;
    if (!formSoiree.hidden) $('ev-titre')?.focus();
  });
  ecouter('annuler-soiree', 'click', () => { if (formSoiree) formSoiree.hidden = true; });

  // "Ekiz & Fasol" + "2026-08-01" → "ekiz-fasol-a1b2" (unique à coup sûr,
  // pas besoin de vérifier une collision avant d'enregistrer)
  const glisser = titre => titre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const televerserAffiche = async (fichier, slug) => {
    const extension = (fichier.name.split('.').pop() || 'jpg').toLowerCase();
    const chemin = `event-posters/${slug}-${Date.now()}.${extension}`;

    const reponse = await fetch(`${SUPABASE_URL}/storage/v1/object/hush-hush/${chemin}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': fichier.type || 'application/octet-stream',
      },
      body: fichier,
    });
    if (!reponse.ok) throw new Error('Le téléversement de l’affiche a échoué.');
    return `${SUPABASE_URL}/storage/v1/object/public/hush-hush/${chemin}`;
  };

  formSoiree?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!formSoiree.checkValidity()) {
      statutSoiree.classList.add('is-error');
      statutSoiree.textContent = 'Titre, date et heure de début sont nécessaires.';
      return;
    }

    const d = Object.fromEntries(new FormData(formSoiree));
    const bouton = formSoiree.querySelector('button[type="submit"]');
    bouton.disabled = true;
    statutSoiree.classList.remove('is-error');
    statutSoiree.textContent = 'Publication…';

    try {
      const slug = `${glisser(d.titre)}-${Math.random().toString(16).slice(2, 6)}`;

      const nouvelleSoiree = {
        id: enDemo ? `demo-ev-${Date.now()}` : undefined,
        slug,
        titre: d.titre.trim(),
        genre: (d.genre || 'Club').trim() || 'Club',
        event_date: d.date,
        heure_debut: d.debut + ':00',
        heure_fin: d.fin ? d.fin + ':00' : null,
        description: d.description?.trim() || null,
        affiche_url: null,
      };

      const fichier = $('ev-affiche')?.files?.[0];
      if (fichier && !enDemo) {
        statutSoiree.textContent = 'Envoi de l’affiche…';
        nouvelleSoiree.affiche_url = await televerserAffiche(fichier, slug);
      } else if (fichier && enDemo) {
        // pas d'envoi réseau en démo : on prévisualise depuis le fichier local
        nouvelleSoiree.affiche_url = URL.createObjectURL(fichier);
      }

      if (enDemo) {
        evenements.push(nouvelleSoiree);
        evenements.sort((a, b) => a.event_date.localeCompare(b.event_date));
      } else {
        const reponse = await api('/rest/v1/hush_hush_events', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ ...nouvelleSoiree, id: undefined }),
        });
        if (!reponse || !reponse.ok) throw new Error(`HTTP ${reponse?.status}`);
      }

      formSoiree.reset();
      formSoiree.hidden = true;
      statutSoiree.textContent = '';

      if (enDemo) { remplirSelectSoirees(); dessinerSoirees(); }
      else await chargerEvenementsEtAnnonces();
    } catch (err) {
      statutSoiree.classList.add('is-error');
      statutSoiree.textContent = 'La publication a échoué. ' + err.message;
    } finally {
      bouton.disabled = false;
    }
  });

  const dessinerSoirees = () => {
    const zone = $('liste-soirees');
    if (!zone) return;
    zone.innerHTML = evenements.length
      ? evenements.map(ev => `
          <div class="soiree-item">
            <span class="soiree-item__vignette" style="${ev.affiche_url ? `background-image:url('${echapper(ev.affiche_url)}')` : ''}"></span>
            <span class="soiree-item__texte">
              <b>${echapper(ev.titre)}</b>
              <span>${dateCourteJJMM(ev.event_date)} · ${echapper(ev.heure_debut?.slice(0, 5) || '')}${ev.heure_fin ? ` → ${echapper(ev.heure_fin.slice(0, 5))}` : ''} · ${echapper(ev.genre)}</span>
            </span>
            <button class="supprimer" type="button" data-supprimer-soiree="${ev.id}"
                    aria-label="Supprimer ${echapper(ev.titre)}">&times;</button>
          </div>`).join('')
      : '<p class="vide">Aucune soirée pour l’instant.</p>';
  };

  $('liste-soirees')?.addEventListener('click', async e => {
    const bouton = e.target.closest('[data-supprimer-soiree]');
    if (!bouton) return;
    const id = bouton.dataset.supprimerSoiree;
    const ev = evenements.find(x => x.id === id);
    if (!confirm(`Retirer « ${ev?.titre ?? 'cette soirée'} » du site ? C'est définitif.`)) return;

    if (enDemo) {
      evenements = evenements.filter(x => x.id !== id);
      remplirSelectSoirees();
      dessinerSoirees();
      return;
    }

    bouton.disabled = true;
    const reponse = await api(`/rest/v1/hush_hush_events?id=eq.${id}`, { method: 'DELETE' });
    if (reponse && reponse.ok) {
      await chargerEvenementsEtAnnonces();
    } else {
      bouton.disabled = false;
      alert('La suppression a échoué.');
    }
  });

  /* ── Annonces : formulaire ── */

  const formAnnonce = $('form-annonce');
  const statutAnnonce = $('annonce-status');

  ecouter('toggle-form-annonce', 'click', () => {
    if (!formAnnonce) return;
    formAnnonce.hidden = !formAnnonce.hidden;
    if (!formAnnonce.hidden) $('av-message')?.focus();
  });
  ecouter('annuler-annonce', 'click', () => { if (formAnnonce) formAnnonce.hidden = true; });

  formAnnonce?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!formAnnonce.checkValidity()) {
      statutAnnonce.classList.add('is-error');
      statutAnnonce.textContent = 'Il manque le message.';
      return;
    }

    const d = Object.fromEntries(new FormData(formAnnonce));
    const bouton = formAnnonce.querySelector('button[type="submit"]');
    bouton.disabled = true;
    statutAnnonce.classList.remove('is-error');
    statutAnnonce.textContent = 'Publication…';

    try {
      const nouvelleAnnonce = {
        type: d.type,
        message: d.message.trim(),
        event_slug: d.soiree || null,
      };

      if (enDemo) {
        annonces.unshift({ id: `demo-av-${Date.now()}`, ...nouvelleAnnonce });
      } else {
        const reponse = await api('/rest/v1/hush_hush_notices', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(nouvelleAnnonce),
        });
        if (!reponse || !reponse.ok) throw new Error(`HTTP ${reponse?.status}`);
      }

      formAnnonce.reset();
      formAnnonce.hidden = true;
      statutAnnonce.textContent = '';

      if (enDemo) dessinerAnnonces();
      else await chargerEvenementsEtAnnonces();
    } catch (err) {
      statutAnnonce.classList.add('is-error');
      statutAnnonce.textContent = 'La publication a échoué.';
    } finally {
      bouton.disabled = false;
    }
  });

  const LIBELLE_TYPE = { info: 'Info', changement: 'Changement', annulation: 'Annulation' };

  const dessinerAnnonces = () => {
    const zone = $('liste-annonces');
    if (!zone) return;
    zone.innerHTML = annonces.length
      ? annonces.map(av => {
          const soiree = evenements.find(ev => ev.slug === av.event_slug);
          return `
          <div class="annonce-item annonce-item--${echapper(av.type)}">
            <span class="annonce-item__badge">${LIBELLE_TYPE[av.type] || av.type}</span>
            <span class="annonce-item__texte">
              <b>${echapper(av.message)}</b>
              <span>${soiree ? echapper(soiree.titre) : 'Tout le site'}</span>
            </span>
            <button class="supprimer" type="button" data-supprimer-annonce="${av.id}"
                    aria-label="Retirer cette annonce">&times;</button>
          </div>`;
        }).join('')
      : '<p class="vide">Aucune annonce publiée.</p>';
  };

  $('liste-annonces')?.addEventListener('click', async e => {
    const bouton = e.target.closest('[data-supprimer-annonce]');
    if (!bouton) return;
    if (!confirm('Retirer cette annonce du site ?')) return;
    const id = bouton.dataset.supprimerAnnonce;

    if (enDemo) {
      annonces = annonces.filter(x => x.id !== id);
      dessinerAnnonces();
      return;
    }

    bouton.disabled = true;
    const reponse = await api(`/rest/v1/hush_hush_notices?id=eq.${id}`, { method: 'DELETE' });
    if (reponse && reponse.ok) {
      await chargerEvenementsEtAnnonces();
    } else {
      bouton.disabled = false;
      alert('La suppression a échoué.');
    }
  });

  /* ── Rendu ── */

  const parSoiree = liste => {
    const carte = new Map();
    liste.forEach(d => {
      const cle = d.event_label || d.event_slug;
      const e = carte.get(cle) || { label: cle, inscrits: 0, personnes: 0 };
      e.inscrits += 1;
      e.personnes += d.personnes || 0;
      carte.set(cle, e);
    });
    return [...carte.values()].sort((a, b) => b.personnes - a.personnes);
  };

  /* Le chiffre que la soirée regarde en premier — un seul par écran. */
  const dessinerTete = () => {
    const zone = $('tete');
    if (!zone) return;

    const personnes = demandes.reduce((n, d) => n + (d.personnes || 0), 0);
    const soirees = parSoiree(demandes).length;

    zone.innerHTML = `
      <p class="tete__label">Sur la liste</p>
      <p class="tete__chiffre">${personnes}</p>
      <p class="tete__detail">personne${personnes > 1 ? 's' : ''} attendue${personnes > 1 ? 's' : ''}${
        soirees ? ` sur ${soirees} soirée${soirees > 1 ? 's' : ''}` : ''
      }</p>`;
  };

  /* Chiffres d'appui : ce qu'on veut savoir en plus du total. */
  const dessinerStats = () => {
    const personnes = demandes.reduce((n, d) => n + (d.personnes || 0), 0);
    const moyenne = demandes.length ? personnes / demandes.length : 0;
    const plusGros = demandes.reduce((m, d) => Math.max(m, d.personnes || 0), 0);

    $('stats').innerHTML = [
      { n: demandes.length, libelle: demandes.length > 1 ? 'inscriptions' : 'inscription' },
      { n: moyenne ? moyenne.toFixed(1).replace('.', ',') : '—', libelle: 'personnes par groupe' },
      { n: plusGros || '—', libelle: 'plus gros groupe' },
    ].map(({ n, libelle }) =>
      `<div class="stat"><b>${n}</b><span>${libelle}</span></div>`
    ).join('');
  };

  /* Comparaison entre soirées : laquelle attire le plus.
     Une seule teinte, barres classées, valeur au bout de chaque barre. */
  const dessinerParSoiree = () => {
    const groupes = parSoiree(demandes);
    const max = Math.max(1, ...groupes.map(g => g.personnes));

    $('parsoiree').innerHTML = groupes.length
      ? groupes.map(g => `
          <div class="barre">
            <span class="barre__nom">${echapper(g.label)}</span>
            <span class="barre__meta">${g.inscrits} inscription${g.inscrits > 1 ? 's' : ''}</span>
            <span class="barre__piste"><i style="width:${(g.personnes / max) * 100}%"></i></span>
            <span class="barre__valeur">${g.personnes}</span>
          </div>`).join('')
      : '<p class="vide">Rien à afficher pour l’instant.</p>';
  };

  const listeFiltree = () => {
    const soiree = $('filtre-soiree')?.value || '';
    const q = ($('recherche')?.value || '').trim().toLowerCase();

    return demandes.filter(d => {
      if (soiree && d.event_slug !== soiree) return false;
      if (q && !(`${d.nom} ${d.contact}`.toLowerCase().includes(q))) return false;
      return true;
    });
  };

  const dessinerTableau = () => {
    const liste = listeFiltree();
    $('vide').hidden = liste.length > 0;

    $('tableau-corps').innerHTML = liste.map(d => `
      <tr data-id="${d.id}">
        <td class="col-nom">${echapper(d.nom)}</td>
        <td class="col-contact">${lienContact(d.contact)}</td>
        <td class="col-pers">${d.personnes}</td>
        <td class="col-soiree">${echapper(d.event_label || d.event_slug)}</td>
        <td class="col-date">${dateCourte(d.created_at)}</td>
        <td><button class="supprimer" type="button" data-supprimer="${d.id}"
              aria-label="Retirer ${echapper(d.nom)} de la liste">&times;</button></td>
      </tr>`).join('');
  };

  const dessiner = () => {
    dessinerTete();
    dessinerStats();
    dessinerParSoiree();
    dessinerTableau();
  };

  const remplirFiltre = () => {
    const select = $('filtre-soiree');
    const actuel = select.value;
    const vues = new Map();
    demandes.forEach(d => vues.set(d.event_slug, d.event_label || d.event_slug));

    select.innerHTML = '<option value="">Toutes les soirées</option>' +
      [...vues].map(([slug, label]) =>
        `<option value="${echapper(slug)}">${echapper(label)}</option>`).join('');
    select.value = actuel;
  };

  ecouter('filtre-soiree', 'change', dessinerTableau);
  ecouter('recherche', 'input', dessinerTableau);

  /* ── Suppression ── */

  ecouter('tableau-corps', 'click', async e => {
    const bouton = e.target.closest('[data-supprimer]');
    if (!bouton) return;

    const id = bouton.dataset.supprimer;
    const demande = demandes.find(d => d.id === id);
    if (!confirm(`Retirer ${demande?.nom ?? 'cette personne'} de la liste ? \n\n` +
    `À n'utiliser qu'en cas d'erreur ou de doublon : les inscrits sont validés d'office. C'est définitif.`)) return;

    bouton.disabled = true;
    const reponse = await api(`/rest/v1/hush_hush_guestlist?id=eq.${id}`, { method: 'DELETE' });

    if (reponse && reponse.ok) {
      demandes = demandes.filter(d => d.id !== id);
      dessiner();
    } else {
      bouton.disabled = false;
      alert('La suppression a échoué.');
    }
  });

  /* ── Export CSV ── */

  ecouter('export', 'click', () => {
    const liste = listeFiltree();
    if (!liste.length) return;

    const cellule = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [
      ['Nom', 'Contact', 'Personnes', 'Soirée', 'Message', 'Inscrit le'],
      ...liste.map(d => [
        d.nom, d.contact, d.personnes,
        d.event_label || d.event_slug,
        d.message || '',
        new Date(d.created_at).toLocaleString('fr-FR'),
      ]),
    ].map(l => l.map(cellule).join(';')).join('\n');

    // le BOM force Excel à lire l'UTF-8 (sinon les accents cassent)
    const blob = new Blob(['﻿' + lignes], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guestlist-hush-hush-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ── Utilitaires ── */

  // Supabase renvoie ses erreurs en anglais.
  // Piège classique : le compte supabase.com du gérant n'est PAS un
  // utilisateur du projet. Tant qu'on ne l'a pas créé dans
  // Authentication → Users, la connexion échouera toujours ici.
  function enFrancais(message) {
    const m = String(message || '');
    if (/invalid login credentials/i.test(m)) {
      return 'Identifiants refusés. Attention : votre compte supabase.com ne ' +
             'marche pas ici — il faut créer l’utilisateur dans le projet, ' +
             'via Authentication → Users → Add user.';
    }
    if (/email not confirmed/i.test(m)) {
      return 'Cet email n’est pas confirmé. Recréez l’utilisateur en cochant « Auto Confirm User ».';
    }
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives, réessayez dans un instant.';
    return m || 'Connexion impossible.';
  }

  function echapper(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function lienContact(contact) {
    const sur = echapper(contact);
    const compact = String(contact).replace(/\s/g, '');
    if (compact.includes('@')) return `<a href="mailto:${sur}">${sur}</a>`;
    if (/^[+0-9]{6,}$/.test(compact)) return `<a href="tel:${compact}">${sur}</a>`;
    return sur;
  }

  function dateCourte(iso) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  // une date de soirée (colonne `date`, sans heure) : "2026-08-01" → "01/08"
  function dateCourteJJMM(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit',
    });
  }

  /* ── Mode démonstration ──
     admin.html?demo=1 affiche la console remplie de données fictives,
     sans connexion. Sert à montrer l'outil (au client, sur un téléphone,
     n'importe où) sans distribuer d'identifiants. Aucune écriture n'est
     possible : rien n'est branché sur Supabase dans ce mode.          */

  const DEMO = [
    ['ekiz-fasol',     'Ekiz & Fasol — sam. 1ᵉʳ août',    'Camille Ferrand', '06 51 22 44 98',       4],
    ['ekiz-fasol',     'Ekiz & Fasol — sam. 1ᵉʳ août',    'Yanis Belkacem',  'yanis.b@gmail.com',    2],
    ['ekiz-fasol',     'Ekiz & Fasol — sam. 1ᵉʳ août',    'Léa Marchetti',   '07 83 01 55 62',       6],
    ['ahla-leila',     'Ahla Leila — dim. 2 août',        'Sofia Haddad',    'sofia.haddad@me.com',  3],
    ['ahla-leila',     'Ahla Leila — dim. 2 août',        'Thomas Vidal',    '06 29 88 74 10',       2],
    ['pascal-kleiman', 'Pascal Kleiman — ven. 31 juillet','Nour Benali',     '07 44 12 03 96',       5],
    ['pascal-kleiman', 'Pascal Kleiman — ven. 31 juillet','Mathis Roussel',  'mathis.roussel@pm.me', 2],
  ];

  const DEMO_EVENEMENTS = [
    { id: 'demo-ev-1', slug: 'pascal-kleiman', titre: 'Pascal Kleiman', genre: 'Music',
      event_date: '2026-07-31', heure_debut: '22:00:00', heure_fin: '02:00:00',
      description: 'DJ set sur le rooftop', affiche_url: 'assets/affiche-pascal-kleiman.jpg' },
    { id: 'demo-ev-2', slug: 'ekiz-fasol', titre: 'Ekiz & Fasol', genre: 'Club',
      event_date: '2026-08-01', heure_debut: '22:00:00', heure_fin: '03:00:00',
      description: 'DJ set sur la terrasse — guestlist only à partir de 22h',
      affiche_url: 'assets/affiche-ekiz-fasol.jpg' },
    { id: 'demo-ev-3', slug: 'ahla-leila', titre: 'Ahla Leila', genre: 'Club',
      event_date: '2026-08-02', heure_debut: '17:00:00', heure_fin: '23:00:00',
      description: 'DJ Eez & darbouka par Rodolphe', affiche_url: 'assets/affiche-ahla-leila.jpg' },
  ];

  const DEMO_ANNONCES = [
    { id: 'demo-av-1', type: 'changement', message: 'Horaire avancé à 21h', event_slug: 'ekiz-fasol' },
  ];

  const lancerDemo = () => {
    enDemo = true;
    session = { email: 'démonstration' };
    demandes = DEMO.map(([slug, label, nom, contact, personnes], i) => ({
      id: `demo-${i}`,
      event_slug: slug, event_label: label,
      nom, contact, personnes, message: null,
      created_at: new Date(Date.now() - (i + 1) * 8 * 3600 * 1000).toISOString(),
    }));
    evenements = DEMO_EVENEMENTS.map(ev => ({ ...ev }));
    annonces = DEMO_ANNONCES.map(av => ({ ...av }));

    afficherConsole();
    etat('Mode démonstration — données fictives, rien n’est enregistré.');
    remplirFiltre();
    dessiner();
    remplirSelectSoirees();
    dessinerSoirees();
    dessinerAnnonces();

    /* Le bandeau du haut suffisait à peu — une fois le formulaire ouvert,
       personne ne le regarde plus. On le redit sur le geste décisif : le
       bouton qu'on presse pour « publier ». Cause identifiée : quelqu'un
       a testé « Publier une annonce » ici en la croyant réelle — elle
       n'a jamais atteint la base, donc jamais atteint le site. */
    ['form-soiree', 'form-annonce'].forEach(id => {
      const bouton = document.querySelector(`#${id} button[type="submit"]`);
      if (bouton) bouton.textContent += ' (démonstration)';
    });
  };

  /* ── Démarrage : on reprend la session si elle est encore valable ── */

  /* Drapeau lu par le garde-fou d'admin.html : tant qu'il est absent,
     c'est que ce fichier n'a pas tourné (cache, 404, erreur de syntaxe). */
  window.__HH_ADMIN_OK = true;
  console.info('[console Hush Hush] admin.js chargé — version 2026-08-08b');

  (async () => {
    // le mode démo court-circuite tout : ni config, ni connexion
    if (new URLSearchParams(location.search).has('demo')) return lancerDemo();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return afficherConnexion('config.js est introuvable ou incomplet.');
    }

    session = lireSession();
    if (!session?.access_token) return afficherConnexion();

    // session restaurée d'une visite précédente : elle peut être périmée
    if (Date.now() >= (session.expire_le || 0) && !(await renouveler())) {
      return afficherConnexion();
    }

    afficherConsole();
    await charger();
  })();
})();
