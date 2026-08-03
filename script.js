/* Hush Hush — interactions */
(() => {
  'use strict';

  /* ── Adresse qui reçoit les demandes de réservation ──
     Remplacer par la vraie adresse mail du lieu.            */
  const EMAIL_RESERVATION = 'contact@hushhush-toulouse.fr';

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
     bloc .event dans index.html, il n'y a rien à toucher ici.          */
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

  /* ── Date minimale du formulaire : aujourd'hui ── */
  const dateInput = document.getElementById('date');
  if (dateInput) {
    const today = new Date();
    const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    dateInput.min = iso;
  }

  /* ── Formulaire de réservation ──
     Site statique : la demande est ouverte dans le client mail.
     Pour un envoi automatique, brancher ici un service type
     Formspree / Netlify Forms / une API maison.               */
  const form = document.getElementById('form-reservation');
  const status = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      if (!form.checkValidity()) {
        status.textContent = 'Merci de compléter le nom, l’email et la date.';
        status.classList.add('is-error');
        form.querySelector(':invalid')?.focus();
        return;
      }

      const d = Object.fromEntries(new FormData(form));
      const jolieDate = d.date
        ? new Date(d.date + 'T12:00:00').toLocaleDateString('fr-FR',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const sujet = `Réservation Hush Hush — ${d.type} — ${jolieDate}`;
      const corps = [
        `Nom : ${d.nom}`,
        `Email : ${d.email}`,
        `Date : ${jolieDate}`,
        `Personnes : ${d.personnes}`,
        `Motif : ${d.type}`,
        '',
        d.message ? `Message :\n${d.message}` : '',
        '',
        '— Envoyé depuis le site hushhush-toulouse',
      ].filter(Boolean).join('\n');

      status.classList.remove('is-error');
      status.textContent = 'Votre logiciel de mail s’ouvre avec la demande pré-remplie…';

      location.href = `mailto:${EMAIL_RESERVATION}`
        + `?subject=${encodeURIComponent(sujet)}`
        + `&body=${encodeURIComponent(corps)}`;
    });
  }
})();
