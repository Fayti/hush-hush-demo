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

  /* ── Programmation ──
     Chaque <li> porte sa date en data-date. On grise ce qui est passé et on
     remonte la prochaine soirée en tête. Pour ajouter une date : copier un
     bloc .event dans index.html, il n'y a rien à toucher ici.         */
  const agenda = document.getElementById('agenda');
  const noteAgenda = document.getElementById('agenda-note');

  if (agenda) {
    const aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);

    const soirees = [...agenda.querySelectorAll('.event')]
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
  }

  /* ── Apparition des blocs au scroll ── */
  const items = document.querySelectorAll('.reveal');

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        // léger décalage entre voisins pour un effet en cascade
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
        entry.target.style.transitionDelay = `${Math.min(siblings.indexOf(entry.target), 4) * 90}ms`;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach(el => {
      // ce qui est déjà à l'écran au chargement s'affiche sans attendre
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
      else io.observe(el);
    });
  } else {
    items.forEach(el => el.classList.add('is-in'));
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
