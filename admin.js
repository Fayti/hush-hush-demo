/* Hush Hush — console guestlist (page privée) */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://ileicboyfrmhxhqbywzw.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsZWljYm95ZnJtaHhocWJ5d3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzkxOTMsImV4cCI6MjEwMDQ1NTE5M30.vVtuVPCf3VpnWLYf7LtY4hK1o7EKS31P9mlEWicjYOQ';

  const CLE_SESSION = 'hushhush.session';

  const $ = id => document.getElementById(id);

  const vueConnexion = $('connexion');
  const vueConsole = $('console');
  const formConnexion = $('form-connexion');
  const statutConnexion = $('connexion-status');

  let session = null;      // { access_token, refresh_token, email }
  let demandes = [];       // toutes les demandes chargées

  /* ── Session ── */

  const lireSession = () => {
    try { return JSON.parse(localStorage.getItem(CLE_SESSION)); }
    catch { return null; }
  };
  const ecrireSession = s => localStorage.setItem(CLE_SESSION, JSON.stringify(s));
  const effacerSession = () => localStorage.removeItem(CLE_SESSION);

  const afficherConnexion = message => {
    session = null;
    effacerSession();
    vueConsole.hidden = true;
    vueConnexion.hidden = false;
    if (message) {
      statutConnexion.classList.add('is-error');
      statutConnexion.textContent = message;
    }
  };

  const afficherConsole = () => {
    vueConnexion.hidden = true;
    vueConsole.hidden = false;
    $('console-moi').textContent = session.email;
  };

  /* ── Appels API ── */

  const api = (chemin, options = {}) =>
    fetch(`${SUPABASE_URL}${chemin}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

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
      const reponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: $('email').value.trim(),
          password: $('motdepasse').value,
        }),
      });

      const data = await reponse.json();
      if (!reponse.ok) throw new Error(enFrancais(data.error_description || data.msg || data.error));

      session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        email: data.user?.email || $('email').value.trim(),
      };
      ecrireSession(session);

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

  $('deconnexion').addEventListener('click', () => {
    afficherConnexion();
    statutConnexion.classList.remove('is-error');
    statutConnexion.textContent = '';
  });

  /* ── Chargement des demandes ── */

  const charger = async () => {
    const reponse = await api('/rest/v1/hush_hush_guestlist?select=*&order=created_at.desc');

    if (reponse.status === 401 || reponse.status === 403) {
      return afficherConnexion('Session expirée, reconnectez-vous.');
    }
    if (!reponse.ok) {
      return afficherConnexion('Impossible de charger les demandes.');
    }

    demandes = await reponse.json();
    remplirFiltre();
    dessiner();
  };

  $('rafraichir').addEventListener('click', charger);

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

  const dessinerStats = () => {
    const total = demandes.length;
    const personnes = demandes.reduce((n, d) => n + (d.personnes || 0), 0);
    const soirees = parSoiree(demandes).length;

    const debutSemaine = new Date();
    debutSemaine.setDate(debutSemaine.getDate() - 7);
    const recentes = demandes.filter(d => new Date(d.created_at) >= debutSemaine).length;

    $('stats').innerHTML = [
      [total, 'demandes'],
      [personnes, 'personnes attendues'],
      [soirees, soirees > 1 ? 'soirées concernées' : 'soirée concernée'],
      [recentes, 'sur 7 jours'],
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
              <b>${g.personnes}</b> pers. · ${g.inscrits} demande${g.inscrits > 1 ? 's' : ''}
            </span>
            <span class="ligne-soiree__barre"><i style="width:${(g.personnes / max) * 100}%"></i></span>
          </div>`).join('')
      : '<p class="vide">Rien à afficher pour l’instant.</p>';
  };

  const listeFiltree = () => {
    const soiree = $('filtre-soiree').value;
    const q = $('recherche').value.trim().toLowerCase();

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

  /* ── Suppression ── */

  $('tableau-corps').addEventListener('click', async e => {
    const bouton = e.target.closest('[data-supprimer]');
    if (!bouton) return;

    const id = bouton.dataset.supprimer;
    const demande = demandes.find(d => d.id === id);
    if (!confirm(`Supprimer la demande de ${demande?.nom ?? 'cette personne'} ? C'est définitif.`)) return;

    bouton.disabled = true;
    const reponse = await api(`/rest/v1/hush_hush_guestlist?id=eq.${id}`, { method: 'DELETE' });

    if (reponse.ok) {
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
      ['Nom', 'Contact', 'Personnes', 'Soirée', 'Message', 'Reçue le'],
      ...liste.map(d => [
        d.nom, d.contact, d.personnes,
        d.event_label || d.event_slug, d.message || '',
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

  // Supabase renvoie ses erreurs en anglais
  function enFrancais(message) {
    const m = String(message || '');
    if (/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/email not confirmed/i.test(m)) return 'Cet email n’a pas encore été confirmé.';
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives, réessayez dans un instant.';
    return m || 'Connexion impossible.';
  }

  function echapper(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function lienContact(contact) {
    const sûr = echapper(contact);
    const compact = String(contact).replace(/\s/g, '');
    if (compact.includes('@')) return `<a href="mailto:${sûr}">${sûr}</a>`;
    if (/^[+0-9]{6,}$/.test(compact)) return `<a href="tel:${compact}">${sûr}</a>`;
    return sûr;
  }

  function dateCourte(iso) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  /* ── Démarrage : on reprend la session si elle est encore valable ── */

  (async () => {
    session = lireSession();
    if (!session?.access_token) return afficherConnexion();

    afficherConsole();
    await charger();
  })();
})();
