/* Hush Hush — interactions */
(() => {
  'use strict';

  /* ── Où vont les demandes de guestlist ──
     Réglages dans config.js — un seul endroit à changer si le projet
     Supabase change. Les demandes partent dans une table dédiée dont
     la lecture publique est fermée (RLS) : seule l'équipe Hush Hush
     les consulte, depuis admin.html.                                 */
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.HUSH_HUSH || {};

  /* ── Barre de navigation : fond au scroll ── */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 40);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  /* ── Menu mobile ── */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');

  const closeMenu = () => {
    menu.classList.remove('is-open');
    nav.classList.remove('is-open');
    document.body.classList.remove('menu-ouvert');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  };

  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    if (open) return closeMenu();
    menu.classList.add('is-open');
    nav.classList.add('is-open');
    document.body.classList.add('menu-ouvert');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fermer le menu');
  });

  menu.addEventListener('click', e => {
    if (e.target.closest('a')) closeMenu();
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  /* ── Petits utilitaires texte ── */
  const echapper = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // "2026-08-01" → "Sam. 1<sup>er</sup> août"
  const dateLisible = iso => {
    const d = new Date(iso + 'T00:00:00');
    const jour = JOURS[d.getDay()];
    const num = d.getDate();
    return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ` +
      `${num === 1 ? '1<sup>er</sup>' : num} ${MOIS[d.getMonth()]}`;
  };

  // "22:00:00" → "22h" · "02:30:00" → "02h30"
  // (le zéro initial de l'heure vient déjà formaté par Postgres, on le garde :
  // « 02h » se lit mieux que « 2h » sur une affiche de soirée)
  const heureLisible = t => {
    if (!t) return '';
    const [h, m] = t.split(':');
    return m === '00' ? `${h}h` : `${h}h${m}`;
  };

  /* ── Apparition des blocs au scroll ──
     Fonction réutilisable : les cartes de soirée arrivent après coup
     (fetch réseau), donc on la rappelle sur ce nouveau lot une fois
     injecté — sinon elles resteraient invisibles pour toujours,
     l'observateur initial étant passé avant leur existence.        */
  const activerReveal = elements => {
    if (!elements.length) return;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const fratrie = [...entry.target.parentElement.querySelectorAll('.reveal')];
        entry.target.style.transitionDelay = `${Math.min(fratrie.indexOf(entry.target), 4) * 90}ms`;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    elements.forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
  };

  activerReveal([...document.querySelectorAll('.reveal')]);

  /* ── Programmation ──
     Les soirées et les annonces viennent de Supabase (tables
     hush_hush_events / hush_hush_notices, lecture publique). Ajouter
     une date ou publier une annonce se fait depuis la console
     (admin.html) — ce fichier n'a plus rien de codé en dur.        */
  const agenda = document.getElementById('agenda');
  const noteAgenda = document.getElementById('agenda-note');
  const avisSite = document.getElementById('avis-site');

  const carteEvenement = (ev, avis) => {
    const titreHtml = echapper(ev.titre).replace(/ &amp; /g, ' <span class="amp">&amp;</span> ');
    const quand = `${dateLisible(ev.event_date)} · ${heureLisible(ev.heure_debut)}` +
      (ev.heure_fin ? ` → ${heureLisible(ev.heure_fin)}` : '');

    const li = document.createElement('li');
    li.className = 'event reveal';
    li.dataset.date = ev.event_date;
    li.dataset.slug = ev.slug;
    // le libellé sert de repère lisible dans la console et l'export CSV
    li.dataset.label = `${ev.titre} — ${dateLisible(ev.event_date).replace(/<[^>]+>/g, '')}`;

    li.innerHTML = `
      ${ev.affiche_url ? `
        <figure class="event__poster">
          <img src="${echapper(ev.affiche_url)}" alt="Affiche : ${echapper(ev.titre)} au Hush Hush, ${quand.replace(/<[^>]+>/g, '')}" loading="lazy">
        </figure>` : `
        <div class="event__poster event__poster--vide" aria-hidden="true"></div>`}
      <div class="event__body">
        <p class="event__meta"><span class="event__kind">${echapper(ev.genre)}</span><span class="event__when">${quand}</span></p>
        <h3>${titreHtml}</h3>
        ${ev.description ? `<p class="event__line">${echapper(ev.description)}</p>` : ''}
        ${avis ? `<p class="event__avis event__avis--${echapper(avis.type)}">${echapper(avis.message)}</p>` : ''}
        <button class="event__cta" type="button" data-guestlist>Guestlist</button>
      </div>`;
    return li;
  };

  const appliquerLogiqueDates = elements => {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const soirees = elements
      .map(el => ({ el, date: new Date(el.dataset.date + 'T00:00:00') }))
      .sort((a, b) => a.date - b.date);

    const aVenir = soirees.filter(s => s.date >= aujourdhui);

    if (aVenir.length) {
      // on ne grise les dates passées que s'il reste quelque chose à venir :
      // sinon toute la grille serait délavée sans rien pour la contraster
      soirees.forEach(s => {
        if (s.date < aujourdhui) s.el.classList.add('is-passe');
      });

      const prochain = aVenir[0];
      prochain.el.classList.add('is-prochain');
      prochain.el.querySelector('.event__kind').textContent = 'Prochaine soirée';
      if (noteAgenda && aVenir.length > 1) {
        noteAgenda.textContent =
          `${aVenir.length} dates à venir. Les suivantes sont annoncées en premier sur Instagram.`;
      }
    }
    // S'il n'y a aucune date à venir, on ne dit rien : la grille reste une
    // vitrine et garde sa note par défaut, plutôt que d'afficher « périmé ».
  };

  const dessinerAvisSite = notices => {
    if (!avisSite) return;
    // seules les annonces sans soirée précise s'affichent ici ; les
    // autres se posent sur la carte de la soirée concernée
    const globales = notices.filter(n => !n.event_slug);
    avisSite.innerHTML = globales.map(n => `
      <div class="avis avis--${echapper(n.type)}">
        <p>${echapper(n.message)}</p>
      </div>`).join('');
  };

  if (agenda) {
    (async () => {
      const chargement = document.getElementById('agenda-chargement');

      try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('config manquante');

        const entetes = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
        const [reponseEvenements, reponseAvis] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/hush_hush_events?select=*&actif=eq.true&order=event_date.asc`, { headers: entetes }),
          fetch(`${SUPABASE_URL}/rest/v1/hush_hush_notices?select=*&actif=eq.true`, { headers: entetes }),
        ]);

        if (!reponseEvenements.ok) throw new Error(`événements : HTTP ${reponseEvenements.status}`);
        const evenements = await reponseEvenements.json();
        const notices = reponseAvis.ok ? await reponseAvis.json() : [];

        // une soirée = au plus une annonce affichée (la plus récente)
        const avisParSoiree = new Map();
        notices
          .filter(n => n.event_slug)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .forEach(n => avisParSoiree.set(n.event_slug, n));

        chargement?.remove();

        if (!evenements.length) {
          agenda.innerHTML = '<li class="agenda__vide">Aucune date annoncée pour le moment — suivez Instagram.</li>';
          return;
        }

        const cartes = evenements.map(ev => carteEvenement(ev, avisParSoiree.get(ev.slug)));
        cartes.forEach(c => agenda.appendChild(c));

        appliquerLogiqueDates(cartes);
        activerReveal(cartes);
        dessinerAvisSite(notices);
      } catch (err) {
        chargement?.remove();
        agenda.innerHTML = '<li class="agenda__vide">Impossible de charger la programmation. Réessayez, ou consultez Instagram.</li>';
      }
    })();
  }

  /* ── Fenêtre d'inscription ──
     Ouverte depuis le bouton d'une carte : on y recopie le titre et la date
     de la soirée, et on retient son slug pour l'envoi. La personne n'a donc
     que deux champs à remplir.                                          */
  const modale = document.getElementById('modale-guestlist');
  const form = document.getElementById('form-guestlist');
  const status = document.getElementById('form-status');
  const titreModale = document.getElementById('modale-titre');
  const quandModale = document.getElementById('modale-quand');

  let soireeChoisie = null;

  /* ── Stepper « combien de personnes » ──
     Les boutons +/− remplacent les flèches natives de <input type=number>,
     trop petites pour un pouce sur mobile. Désactivés aux bornes (1 et 20)
     pour qu'on ne puisse pas taper dans le vide en croyant que ça marche. */
  const champPersonnes = form?.querySelector('#personnes');
  const boutonsStepper = form?.querySelectorAll('.stepper__btn') || [];

  const rafraichirStepper = () => {
    if (!champPersonnes) return;
    const val = Number(champPersonnes.value);
    const min = Number(champPersonnes.min);
    const max = Number(champPersonnes.max);
    boutonsStepper.forEach(b => {
      const pas = Number(b.dataset.pas);
      b.disabled = pas < 0 ? val <= min : val >= max;
    });
  };

  boutonsStepper.forEach(bouton => {
    bouton.addEventListener('click', () => {
      const pas = Number(bouton.dataset.pas);
      const min = Number(champPersonnes.min);
      const max = Number(champPersonnes.max);
      const actuel = Number(champPersonnes.value) || min;
      champPersonnes.value = Math.min(max, Math.max(min, actuel + pas));
      // pour que tout listener externe (validation, etc.) voie le changement
      champPersonnes.dispatchEvent(new Event('input', { bubbles: true }));
      rafraichirStepper();
    });
  });

  champPersonnes?.addEventListener('input', rafraichirStepper);

  const ouvrirModale = carte => {
    soireeChoisie = {
      slug: carte.dataset.slug,
      label: carte.dataset.label,
    };

    titreModale.textContent = carte.querySelector('h3').textContent.trim();
    quandModale.textContent = carte.querySelector('.event__when').textContent.trim();

    status.textContent = '';
    status.classList.remove('is-error');
    form.reset();
    rafraichirStepper(); // form.reset() remet 2, il faut réévaluer les bornes
    modale.showModal();
    // laisse le temps au navigateur d'afficher avant de donner le focus
    requestAnimationFrame(() => form.querySelector('#nom').focus());
  };

  if (agenda && modale) {
    agenda.addEventListener('click', e => {
      const bouton = e.target.closest('[data-guestlist]');
      if (!bouton) return;
      const carte = bouton.closest('.event');
      if (carte) ouvrirModale(carte);
    });

    modale.addEventListener('click', e => {
      // clic sur le fond (hors du panneau) ou sur la croix
      if (e.target === modale || e.target.closest('[data-fermer]')) modale.close();
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault(); // sinon method="dialog" fermerait la fenêtre

      if (!form.checkValidity()) {
        status.classList.add('is-error');
        status.textContent = 'Il nous faut un nom et un moyen de vous joindre.';
        form.querySelector(':invalid')?.focus();
        return;
      }

      const d = Object.fromEntries(new FormData(form));
      const bouton = form.querySelector('button[type="submit"]');

      bouton.disabled = true;
      status.classList.remove('is-error');
      status.textContent = 'Envoi…';

      try {
        const reponse = await fetch(`${SUPABASE_URL}/rest/v1/hush_hush_guestlist`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            event_slug: soireeChoisie?.slug || 'inconnu',
            event_label: soireeChoisie?.label || 'Soirée non précisée',
            nom: d.nom,
            contact: d.contact,
            // borné à ce qu'accepte la base (1 à 20)
            personnes: Math.min(20, Math.max(1, Number(d.personnes) || 2)),
            message: null,
          }),
        });

        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

        modale.classList.add('is-ok');
        // on redit la règle ici : c'est le dernier écran que la personne voit
        status.innerHTML =
          'Vous êtes sur la liste.<br>' +
          '<span class="form__rappel">Le physio décide à la porte. Tenue soignée.</span>';
        setTimeout(() => {
          modale.close();
          modale.classList.remove('is-ok');
        }, 2200);
      } catch (err) {
        status.classList.add('is-error');
        status.textContent =
          'L’envoi a échoué. Réessayez, ou écrivez-nous sur Instagram.';
      } finally {
        bouton.disabled = false;
      }
    });
  }
})();
