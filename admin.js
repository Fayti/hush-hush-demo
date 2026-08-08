/* Hush Hush — console guestlist (page privée) */
(() => {
  'use strict';

  /* Réglages Supabase : voir config.js, seul fichier à modifier. */
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.HUSH_HUSH || {};

  const CLE_SESSION = 'hushhush.session';

  const $ = id => document.getElementById(id);

  const vueConnexion = $('connexion');
  const vueConsole = $('console');
  const formConnexion = $('form-connexion');
  const statutConnexion = $('connexion-status');

  let session = null;      // { access_token, refresh_token, email, expire_le }
  let demandes = [];       // toutes les demandes chargées

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
    vueConsole.hidden = true;
    vueConnexion.hidden = false;
    statutConnexion.classList.toggle('is-error', Boolean(message));
    statutConnexion.textContent = message || '';
  };

  const afficherConsole = () => {
    vueConnexion.hidden = true;
    vueConsole.hidden = false;
    $('console-moi').textContent = session.email;
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

  formConnexion.addEventListener('submit', async e => {
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

  $('deconnexion').addEventListener('click', () => afficherConnexion());

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
      etat('Aucune demande pour le moment.');
    } else {
      etat('');
    }

    remplirFiltre();
    dessiner();
  };

  $('rafraichir').addEventListener('click', charger);

  /* ── Rendu ── */

  const parSoiree = liste => {
    const carte = new Map();
    liste.forEach(d => {
      const cle = d.event_label || d.event_slug;
      const e = carte.get(cle) || { label: cle, inscrits: 0, personnes: 0, arrivees: 0 };
      e.inscrits += 1;
      e.personnes += d.personnes || 0;
      if (d.arrive) e.arrivees += d.personnes || 0;
      carte.set(cle, e);
    });
    return [...carte.values()].sort((a, b) => b.personnes - a.personnes);
  };

  const dessinerStats = () => {
    const total = demandes.length;
    const personnes = demandes.reduce((n, d) => n + (d.personnes || 0), 0);
    const entrees = demandes.filter(d => d.arrive).reduce((n, d) => n + (d.personnes || 0), 0);
    const soirees = parSoiree(demandes).length;

    $('stats').innerHTML = [
      [total, total > 1 ? 'demandes' : 'demande'],
      [personnes, 'personnes attendues'],
      [entrees, 'déjà entrées'],
      [soirees, soirees > 1 ? 'soirées concernées' : 'soirée concernée'],
    ].map(([n, libelle]) =>
      `<div class="stat"><b>${n}</b><span>${libelle}</span></div>`
    ).join('');
  };

  const dessinerParSoiree = () => {
    const groupes = parSoiree(demandes);
    const max = Math.max(1, ...groupes.map(g => g.personnes));

    $('parsoiree').innerHTML = groupes.length
      ? groupes.map(g => `
          <div class="ligne-soiree">
            <span class="ligne-soiree__nom">${echapper(g.label)}</span>
            <span class="ligne-soiree__chiffres">
              <b>${g.personnes}</b> pers. · ${g.inscrits} demande${g.inscrits > 1 ? 's' : ''}${
                g.arrivees ? ` · ${g.arrivees} entrée${g.arrivees > 1 ? 's' : ''}` : ''
              }
            </span>
            <span class="ligne-soiree__barre"><i style="width:${(g.personnes / max) * 100}%"></i></span>
          </div>`).join('')
      : '<p class="vide">Rien à afficher pour l’instant.</p>';
  };

  const listeFiltree = () => {
    const soiree = $('filtre-soiree').value;
    const q = $('recherche').value.trim().toLowerCase();
    const restants = $('filtre-restants').checked;

    return demandes.filter(d => {
      if (soiree && d.event_slug !== soiree) return false;
      if (restants && d.arrive) return false;
      if (q && !(`${d.nom} ${d.contact}`.toLowerCase().includes(q))) return false;
      return true;
    });
  };

  const dessinerTableau = () => {
    const liste = listeFiltree();
    $('vide').hidden = liste.length > 0;

    $('tableau-corps').innerHTML = liste.map(d => `
      <tr data-id="${d.id}" class="${d.arrive ? 'est-arrive' : ''}">
        <td class="col-arrive">
          <label class="pointage">
            <input type="checkbox" data-arrive="${d.id}" ${d.arrive ? 'checked' : ''}
                   aria-label="Marquer ${echapper(d.nom)} comme arrivé">
            <span aria-hidden="true"></span>
          </label>
        </td>
        <td class="col-nom">${echapper(d.nom)}</td>
        <td class="col-contact">${lienContact(d.contact)}</td>
        <td class="col-pers">${d.personnes}</td>
        <td class="col-soiree">${echapper(d.event_label || d.event_slug)}</td>
        <td class="col-date">${dateCourte(d.created_at)}</td>
        <td><button class="supprimer" type="button" data-supprimer="${d.id}"
              aria-label="Supprimer la demande de ${echapper(d.nom)}">&times;</button></td>
      </tr>`).join('');
  };

  const dessiner = () => {
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

  $('filtre-soiree').addEventListener('change', dessinerTableau);
  $('recherche').addEventListener('input', dessinerTableau);
  $('filtre-restants').addEventListener('change', dessinerTableau);

  /* ── Pointage à l'entrée ──
     On coche tout de suite à l'écran, on écrit ensuite : à la porte,
     l'affichage doit répondre au doigt, pas au réseau. En cas d'échec
     on revient en arrière et on le dit.                              */

  $('tableau-corps').addEventListener('change', async e => {
    const case_ = e.target.closest('[data-arrive]');
    if (!case_) return;

    const id = case_.dataset.arrive;
    const demande = demandes.find(d => d.id === id);
    if (!demande) return;

    const avant = demande.arrive;
    demande.arrive = case_.checked;
    case_.closest('tr')?.classList.toggle('est-arrive', case_.checked);
    dessinerStats();
    dessinerParSoiree();

    const reponse = await api(`/rest/v1/hush_hush_guestlist?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ arrive: demande.arrive }),
    });

    if (!reponse || !reponse.ok) {
      demande.arrive = avant;
      case_.checked = avant;
      case_.closest('tr')?.classList.toggle('est-arrive', avant);
      dessinerStats();
      dessinerParSoiree();
      alert('Le pointage n’a pas été enregistré. Vérifiez la connexion.');
    }
  });

  /* ── Suppression ── */

  $('tableau-corps').addEventListener('click', async e => {
    const bouton = e.target.closest('[data-supprimer]');
    if (!bouton) return;

    const id = bouton.dataset.supprimer;
    const demande = demandes.find(d => d.id === id);
    if (!confirm(`Supprimer la demande de ${demande?.nom ?? 'cette personne'} ? C'est définitif.`)) return;

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

  $('export').addEventListener('click', () => {
    const liste = listeFiltree();
    if (!liste.length) return;

    const cellule = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [
      ['Nom', 'Contact', 'Personnes', 'Soirée', 'Entré', 'Message', 'Reçue le'],
      ...liste.map(d => [
        d.nom, d.contact, d.personnes,
        d.event_label || d.event_slug,
        d.arrive ? 'oui' : 'non',
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

  /* ── Démarrage : on reprend la session si elle est encore valable ── */

  (async () => {
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
