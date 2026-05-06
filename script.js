/* =========================================================
   AM ARCHITECTS — script.js
   Vanilla JS · no frameworks · modular functions
   ========================================================= */

/* ---------- 0. CLIENT CONFIG ----------
   With backend, we no longer need secrets in the browser.
   Only the WhatsApp number stays here (it's public anyway — it's on the contact page).
*/
const CONFIG = Object.assign({
  CLIENT_WHATSAPP: '918072027840',
  // API endpoints — relative paths, work in dev and production
  API_LEAD: '/api/lead',
  API_ADMIN_AUTH: '/api/admin-auth',
  // Admin route — change to something only you know
  ADMIN_ROUTE: '#admin'
}, (typeof window !== 'undefined' && window.AM_CONFIG) || {});

/* ---------- 1. STATE / MOCK BACKEND ---------- */

const Store = {
  KEY_USER: 'am_user',
  KEY_USERS: 'am_users_db',
  KEY_RATINGS: 'am_ratings',
  KEY_LEADS: 'am_leads',

  getUser() { try { return JSON.parse(localStorage.getItem(this.KEY_USER) || 'null'); } catch { return null; } },
  setUser(u) { localStorage.setItem(this.KEY_USER, JSON.stringify(u)); },
  clearUser() { localStorage.removeItem(this.KEY_USER); },

  getUsers() { try { return JSON.parse(localStorage.getItem(this.KEY_USERS) || '[]'); } catch { return []; } },
  saveUser(u) {
    const users = this.getUsers();
    const i = users.findIndex(x => x.phone === u.phone);
    if (i >= 0) users[i] = { ...users[i], ...u }; else users.push(u);
    localStorage.setItem(this.KEY_USERS, JSON.stringify(users));
  },

  getRatings() { try { return JSON.parse(localStorage.getItem(this.KEY_RATINGS) || '[]'); } catch { return []; } },
  saveRating(r) {
    const list = this.getRatings();
    const i = list.findIndex(x => x.phone === r.phone);
    if (i >= 0) list[i] = r; else list.push(r);
    localStorage.setItem(this.KEY_RATINGS, JSON.stringify(list));
  },

  saveLead(l) {
    const leads = JSON.parse(localStorage.getItem(this.KEY_LEADS) || '[]');
    leads.push({ ...l, at: new Date().toISOString() });
    // keep only the most recent 500 leads to prevent unbounded localStorage growth
    while (leads.length > 500) leads.shift();
    try {
      localStorage.setItem(this.KEY_LEADS, JSON.stringify(leads));
    } catch (err) {
      // localStorage full — drop oldest 100 and retry
      leads.splice(0, 100);
      try { localStorage.setItem(this.KEY_LEADS, JSON.stringify(leads)); } catch {}
    }
  },
};

/* ---------- 2. SIMULATED FIREBASE / EMAILJS ---------- */

const MockFirebase = {
  // simulate sending an OTP
  sendOTP(phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem('am_otp', code);
    sessionStorage.setItem('am_otp_phone', phone);
    return Promise.resolve({ ok: true, code });
  },
  verifyOTP(input) {
    const expected = sessionStorage.getItem('am_otp');
    return Promise.resolve({ ok: input === expected });
  },
};

const MockEmail = {
  // Real lead delivery — POSTs to /api/lead. Backend forwards to Web3Forms with the secret key.
  async send({ to, subject, body, leadData }) {
    try {
      const r = await fetch(CONFIG.API_LEAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          ...leadData
        })
      });
      if (!r.ok) {
        // Even if backend fails, the lead is still saved in localStorage
        // and the WhatsApp forward is offered as fallback
        return { ok: false };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false };
    }
  },

  // Open WhatsApp with pre-filled lead details — for instant forward to client
  whatsappForward({ subject, body }) {
    if (!CONFIG.CLIENT_WHATSAPP || CONFIG.CLIENT_WHATSAPP === '919876543210') return null;
    const msg = encodeURIComponent(`*${subject}*\n\n${body}\n\n— from AM Architects website`);
    return `https://wa.me/${CONFIG.CLIENT_WHATSAPP}?text=${msg}`;
  }
};

/* ---------- 3. UTIL ---------- */

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

// Escape HTML to prevent XSS when injecting user-editable content
const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function toast(msg, ms = 3200) {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-visible'), ms);
}

function lockBodyScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

/* ---------- 4. LOADER ---------- */

function runLoader() {
  const bar = $('#loaderProgress');
  const loader = $('#loader');
  if (!loader) return;

  // Hard safety timeout — loader ALWAYS closes within 4s no matter what
  const safetyTimer = setTimeout(() => {
    if (loader && !loader.classList.contains('is-done')) {
      loader.classList.add('is-done');
      setTimeout(() => loader.remove(), 800);
    }
  }, 4000);

  let p = 0;
  const tick = () => {
    p += Math.random() * 14 + 6;
    if (p >= 100) {
      if (bar) bar.style.width = '100%';
      clearTimeout(safetyTimer);
      setTimeout(() => loader.classList.add('is-done'), 400);
      setTimeout(() => loader.remove(), 1300);
      return;
    }
    if (bar) bar.style.width = p + '%';
    setTimeout(tick, 120 + Math.random() * 140);
  };
  tick();
}

/* ---------- 5. NAV ---------- */

function initNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  $('#navBurger').addEventListener('click', () => nav.classList.toggle('is-menu-open'));
  $$('.nav__links a').forEach(a => a.addEventListener('click', () => nav.classList.remove('is-menu-open')));

  // smooth-scroll
  $$('[data-scroll]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const tgt = document.querySelector(href);
      if (!tgt) return;
      e.preventDefault();
      window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    });
  });

  // user button → modal or sign-out menu
  $('#navUserBtn').addEventListener('click', () => {
    if (Store.getUser()) {
      if (confirm('Sign out of AM Architects?')) {
        Store.clearUser();
        refreshUserUI();
        toast('You have been signed out.');
      }
    } else {
      openAuthModal();
    }
  });
}

function refreshUserUI() {
  const u = Store.getUser();
  $('#navUserLabel').textContent = u ? `+91 ${u.phone.slice(-4).padStart(u.phone.length, '•')}` : 'Sign in';

  // contact form auto-fill if user is signed in (lock element no longer exists)
  if (u) {
    const cp = $('#contactPhone');
    const ce = $('#contactEmail');
    if (cp && !cp.value) cp.value = '+91 ' + u.phone;
    if (ce && u.email && !ce.value) ce.value = u.email;
  }

  // ratings unlock
  const stars = $('#rateStars');
  const note = $('#rateNote');
  if (!stars) return;
  if (u) {
    stars.classList.remove('is-locked');
    const mine = Store.getRatings().find(r => r.phone === u.phone);
    if (mine) {
      paintStars(mine.value);
      note.textContent = `You rated us ${mine.value} of 5. Thank you.`;
    } else {
      note.textContent = 'Click a star to leave your rating.';
    }
  } else {
    stars.classList.add('is-locked');
    note.textContent = 'Sign in with your phone to leave a rating.';
  }
}

/* ---------- 6. SCROLL REVEAL ---------- */

function initReveal() {
  // Split per-word — only operate on the heading text node, never inner elements
  $$('.split-reveal').forEach(el => {
    if (el.dataset.split) return;
    el.dataset.split = '1';
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w, i) =>
      `<span class="word" style="transition-delay:${i * 70}ms">${w}</span>`
    ).join(' ');
  });

  const countUp = (el) => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = +el.dataset.count;
    const dur = 1600;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = (p === 1 && target >= 100) ? val + '+' : val;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  $$('.reveal, .split-reveal, .project, .article, .eyebrow').forEach(el => io.observe(el));

  // Dedicated observer for count-up — fires per <b data-count> directly
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      countUp(e.target);
      cio.unobserve(e.target);
    });
  }, { threshold: 0.3 });
  $$('[data-count]').forEach(el => cio.observe(el));

  // Touch pulse on stat tiles
  $$('.abs').forEach(el => {
    el.addEventListener('touchstart', () => {
      el.style.transform = 'translateY(-3px) scale(1.02)';
      setTimeout(() => el.style.transform = '', 250);
    }, { passive: true });
  });
}

/* ---------- 7. PROJECTS ---------- */

let PROJECTS = [
  {
    id: 'p1', cat: 'residential',
    title: 'Anantara House',
    location: 'Coorg, Karnataka',
    year: '2024',
    size: 'project--lg',
    img: 'images/p17-vengat-villa-night.jpeg',
    tags: ['Residential', 'Hill Country', 'Stone'],
    desc: 'A long, low residence on a tea-clad slope, organised around three courtyards that step gently down the hill. Loadbearing laterite walls, deep verandahs, and a roof of locally fired tile.',
    body: [
      'Anantara House sits on a south-facing slope in the Coorg hills, threaded between century-old silver oaks. The brief was spare: a home for a family of four, an extended kitchen for shared meals, and rooms for occasional guests. Everything else, the clients told us, could be removed.',
      'The plan responds with three courts — entry, dining, and a smaller private court for the principal bedroom — strung along a single corridor that follows the slope. Each court is a different mood: gravel and stone for the entry, water for the dining court, and a tight stand of cardamom for the bedroom.',
      'Walls are loadbearing, in laterite from a quarry forty kilometres from the site. The roof is locally fired Mangalore tile on a slender steel frame. There is no air-conditioning anywhere in the house; the verandahs and the courts do the work, as they have done in the region for two centuries.',
    ],
    facts: { area: '4,200 sq ft', completion: '2024', team: 'AM Architects + Coorg Masons' },
  },
  {
    id: 'p2', cat: 'commercial',
    title: 'The Lantern Atelier',
    location: 'Bengaluru',
    year: '2023',
    size: 'project--md',
    img: 'images/c01-royaloak-commercial.jpeg',
    tags: ['Workspace', 'Adaptive Reuse'],
    desc: 'A creative agency inside a 1940s warehouse — restored timber trusses, polished concrete, and a light-well that turns the building inward.',
    body: [
      'The Lantern Atelier is the new home of a small, well-known Bengaluru creative agency. The site is a 1940s grain warehouse on the edge of Cubbon Park, and the client\'s ambition was simple: keep what is good, remove what is not, and build very little.',
      'We restored the original timber trusses, opened a long light-well along the spine, and inserted a single new mezzanine in steel. The floor is polished, slightly imperfect concrete; the walls are the original brick, lime-washed.',
      'The building has been in continuous use for eighteen months and the client reports, with quiet pleasure, that nobody arrives late.',
    ],
    facts: { area: '6,800 sq ft', completion: '2023', team: 'AM Architects + Studio Joshi' },
  },
  {
    id: 'p3', cat: 'community',
    title: 'Kallur School',
    location: 'Kallur, Tamil Nadu',
    year: '2022',
    size: 'project--md',
    img: 'images/c02-aasi-hospital.jpeg',
    tags: ['Education', 'Earth Construction'],
    desc: 'A primary school of 48 classrooms wrapped around a monsoon court. Built with the village masons in compressed earth and lime.',
    body: [
      'Kallur School replaces an older two-room school that had become impossibly small for the village it served. The new building has forty-eight classrooms, a small library, a kitchen, and a single covered hall for assemblies — all wrapped around a generous monsoon court.',
      'The walls are compressed-earth blocks made on site, from soil dug for the foundations. Roofs are of country tile on bamboo scissor trusses. The total cost was just under ₹2,800 per square foot.',
      'The masons who built it were drawn entirely from Kallur and the two villages adjacent. Many of the older men had not built in earth in twenty years; by the end of the project, they were teaching the younger ones.',
    ],
    facts: { area: '24,000 sq ft', completion: '2022', team: 'AM Architects + Kallur Masons' },
  },
  {
    id: 'p4', cat: 'residential',
    title: 'House at the Tea Estate',
    location: 'Munnar, Kerala',
    year: '2023',
    size: 'project--sm',
    img: 'images/p02-modern-villa.jpeg',
    tags: ['Residential', 'Hill Country'],
    desc: 'A weekend house woven between mature tea bushes — a single long pavilion, open on both sides.',
    body: [
      'The clients had owned this twelve-acre estate for three generations. Their brief was for a small, quiet weekend house — somewhere to read, somewhere to receive friends, somewhere to listen to the rain.',
      'The plan is a single long pavilion, eighteen metres by six, opening fully along both long sides. There is one bedroom, one kitchen, one room that is everything else.',
      'The roof is steeply pitched in two directions — to shed monsoon water, and because the eye in the hills wants a steep roof.',
    ],
    facts: { area: '1,400 sq ft', completion: '2023', team: 'AM Architects' },
  },
  {
    id: 'p5', cat: 'commercial',
    title: 'Madurai Library',
    location: 'Madurai, Tamil Nadu',
    year: '2024',
    size: 'project--sm',
    img: 'images/p09-salam-residency.jpeg',
    tags: ['Civic', 'Jaali'],
    desc: 'A reading hall wrapped in a perforated stone screen — light becomes a material, and the room reads as a forest interior.',
    body: [
      'Madurai Library is a modest but ambitious civic building: a 4,500 sq ft reading hall on a tight inner-city site, commissioned by a private trust and gifted to the municipality.',
      'The defining gesture is a wrapping jaali wall — eighteen feet high, in honey-coloured limestone — that screens the reading hall from the noise of the street while filtering daylight into something dappled and forest-like.',
      'The librarian reports that readers stay later than they used to.',
    ],
    facts: { area: '4,500 sq ft', completion: '2024', team: 'AM Architects + Stoneworks Madurai' },
  },
  {
    id: 'p6', cat: 'community',
    title: 'Weavers\' Hall',
    location: 'Tiruvannamalai',
    year: '2024',
    size: 'project--lg',
    img: 'images/i06-workspace.jpeg',
    tags: ['Workshop', 'Community'],
    desc: 'A new home for a cooperative of 82 weavers, after the floods of 2023. Raised plinth, deep eaves, north-light along the workshop floor.',
    body: [
      'The cooperative\'s previous hall, more than a hundred years old, was lost in the floods of October 2023. Eighty-two weavers were left without a workplace, and we were asked, three weeks later, if we could help.',
      'The new hall sits on a plinth raised two metres above ground level, on the same footprint as the old building. The structural frame is in steel — it could be raised quickly, by a small crew, with the monsoons returning.',
      'A long band of north-facing clerestories runs the full length of the building, washing the workshop floor with steady, even light all day. The eaves are deep enough to allow looms to be set up outside in the dry months.',
    ],
    facts: { area: '8,200 sq ft', completion: '2024', team: 'AM Architects + Local Crew' },
  },
];

function renderProjects(filter = 'all') {
  // pull latest from store (admin may have edited)
  if (typeof ContentStore !== 'undefined') {
    const stored = ContentStore.loadProjects();
    PROJECTS.splice(0, PROJECTS.length, ...stored);
  }
  const grid = $('#projectsGrid');
  grid.innerHTML = PROJECTS.map(p => `
    <article class="project ${p.size}" data-cat="${p.cat}" data-id="${p.id}" ${filter !== 'all' && p.cat !== filter ? 'hidden' : ''}>
      <div class="project__view">View →</div>
      <div class="project__media">
        <img loading="lazy" src="${p.img}" alt="${p.title}">
      </div>
      <div class="project__body">
        <div>
          <h3 class="project__title">${p.title}</h3>
          <div class="project__meta">${p.location}</div>
          <div class="project__tags">${p.tags.map(t => `<span>${t}</span>`).join('')}</div>
        </div>
        <div class="project__year">${p.year}</div>
      </div>
    </article>
  `).join('');

  $$('#projectsGrid .project').forEach(el => {
    el.addEventListener('click', () => openProject(el.dataset.id));
  });
}

function initProjectFilters() {
  $$('#projectFilters .filter').forEach(b => {
    b.addEventListener('click', () => {
      $$('#projectFilters .filter').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      renderProjects(b.dataset.filter);
    });
  });
}

function openProject(id) {
  const p = PROJECTS.find(x => x.id === id);
  if (!p) return;
  $('#projDetail').innerHTML = `
    <div class="proj-detail__hero"><img src="${p.img}" alt="${p.title}"></div>
    <div class="proj-detail__body">
      <div class="proj-detail__cat">${p.cat} · ${p.location}</div>
      <h2 class="proj-detail__title">${p.title}</h2>
      <div class="proj-detail__meta">
        <div>Area<b>${p.facts.area}</b></div>
        <div>Completion<b>${p.facts.completion}</b></div>
        <div>Team<b>${p.facts.team}</b></div>
      </div>
      ${p.body.map(t => `<p>${t}</p>`).join('')}
    </div>
  `;
  openModal('#projectModal');
}

/* ---------- 8. CMS ARTICLES ---------- */

async function fetchArticles() {
  // simulate fetch() to a CMS — using an inline JSON tag as the source
  return new Promise(resolve => {
    setTimeout(() => {
      const data = JSON.parse($('#cmsArticles').textContent);
      resolve(data);
    }, 200);
  });
}

let ARTICLES = [];

async function renderArticles(filter = 'all') {
  // pull from store if admin has edited, otherwise fetch from JSON island
  if (typeof ContentStore !== 'undefined') {
    const stored = ContentStore.loadArticles();
    if (stored) ARTICLES = stored;
  }
  if (!ARTICLES.length) ARTICLES = await fetchArticles();
  const grid = $('#articlesGrid');
  grid.innerHTML = ARTICLES.map(a => `
    <article class="article" data-cat="${a.category}" data-id="${a.id}" ${filter !== 'all' && a.category !== filter ? 'hidden' : ''}>
      <div class="article__media"><img loading="lazy" src="${a.image}" alt=""></div>
      <div class="article__cat">${a.categoryLabel}</div>
      <h3 class="article__title">${a.title}</h3>
      <p class="article__excerpt">${a.excerpt}</p>
      <div class="article__meta"><span>${a.date}</span><span>${a.readTime}</span></div>
    </article>
  `).join('');

  $$('#articlesGrid .article').forEach(el => {
    el.addEventListener('click', () => openArticle(el.dataset.id));
  });
}

function initArticleFilters() {
  $$('#articleFilters .filter').forEach(b => {
    b.addEventListener('click', () => {
      $$('#articleFilters .filter').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      renderArticles(b.dataset.filter);
    });
  });
}

function openArticle(id) {
  const a = ARTICLES.find(x => x.id === id);
  if (!a) return;
  $('#articleDetail').innerHTML = `
    <div class="article-detail__hero"><img src="${a.image}" alt=""></div>
    <div class="article-detail__body">
      <div class="article-detail__cat">${a.categoryLabel}</div>
      <h2 class="article-detail__title">${a.title}</h2>
      <div class="article-detail__meta"><span>${a.date}</span><span>${a.readTime}</span></div>
      ${a.body.split('\n\n').map(p => `<p>${p}</p>`).join('')}
    </div>
  `;
  openModal('#articleModal');
}

/* ---------- 9. TESTIMONIALS CAROUSEL ---------- */

const TESTIMONIALS = [
  {
    name: 'Anjali &amp; Rohan Mehta',
    role: 'Anantara House, 2024',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=85',
    quote: 'They listened more than they spoke. The house we live in now is the house we always wanted, even when we did not yet have the words for it.',
  },
  {
    name: 'Suresh Krishnamurthy',
    role: 'Director, Kallur Trust',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=85',
    quote: 'Our village built its school. The architects gave us the drawings, the dignity, and the patience. The children call it the cool building, because it is.',
  },
  {
    name: 'Maya Iyer',
    role: 'Founder, The Lantern Atelier',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=85',
    quote: 'Eighteen months in and the office still does the small thing every day that I asked them to design for: it makes us want to come back tomorrow.',
  },
  {
    name: 'Vikram Sundar',
    role: 'Chairman, Tea Estate',
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&q=85',
    quote: 'Three generations have walked these slopes. They built us a house that already feels like it has been here a long time.',
  },
];

let testiIdx = 0;
let testiTimer;

function renderTestimonials() {
  const track = $('#testimonialTrack');
  const dots = $('#testimonialDots');
  track.innerHTML = TESTIMONIALS.map((t, i) => `
    <article class="testi ${i === 0 ? 'is-active' : ''}" data-i="${i}">
      <div class="testi__media">
        <img loading="lazy" src="${t.photo}" alt="${t.name}">
        <div class="testi__media-play">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div>
        <p class="testi__quote">${t.quote}</p>
        <div class="testi__name">${t.name}</div>
        <div class="testi__role">${t.role}</div>
      </div>
    </article>
  `).join('');
  dots.innerHTML = TESTIMONIALS.map((_, i) => `<button data-i="${i}" class="${i === 0 ? 'is-active' : ''}"></button>`).join('');
}

function showTesti(i) {
  testiIdx = (i + TESTIMONIALS.length) % TESTIMONIALS.length;
  $$('#testimonialTrack .testi').forEach((el, j) => el.classList.toggle('is-active', j === testiIdx));
  $$('#testimonialDots button').forEach((el, j) => el.classList.toggle('is-active', j === testiIdx));
}

function initCarousel() {
  renderTestimonials();
  $('.carousel__nav--prev').addEventListener('click', () => { showTesti(testiIdx - 1); resetTimer(); });
  $('.carousel__nav--next').addEventListener('click', () => { showTesti(testiIdx + 1); resetTimer(); });
  $$('#testimonialDots button').forEach(b => b.addEventListener('click', () => { showTesti(+b.dataset.i); resetTimer(); }));
  resetTimer();
}
function resetTimer() {
  clearInterval(testiTimer);
  testiTimer = setInterval(() => showTesti(testiIdx + 1), 6500);
}

/* ---------- 10. RATINGS ---------- */

function paintStars(value) {
  $$('#rateStars span').forEach(s => s.classList.toggle('is-on', +s.dataset.v <= value));
}

function refreshAvgRating() {
  const list = Store.getRatings();
  const seed = [5, 5, 4, 5, 5, 4, 5, 5, 5, 4, 5]; // baseline so it doesn't start empty
  const all = [...seed, ...list.map(r => r.value)];
  const avg = all.reduce((a, b) => a + b, 0) / all.length;
  $('#avgRating').textContent = avg.toFixed(1);
  $('#ratingCount').textContent = `based on ${all.length} ratings`;
  const rounded = Math.round(avg);
  $('#avgStars').innerHTML = '★★★★★'.split('').map((s, i) => `<span style="opacity:${i < rounded ? 1 : .25}">${s}</span>`).join('');
}

function initRatings() {
  refreshAvgRating();
  const stars = $('#rateStars');
  let hover = 0;

  $$('#rateStars span').forEach(s => {
    s.addEventListener('mouseenter', () => {
      if (stars.classList.contains('is-locked')) return;
      hover = +s.dataset.v;
      paintStars(hover);
    });
    s.addEventListener('mouseleave', () => {
      const u = Store.getUser();
      const mine = u && Store.getRatings().find(r => r.phone === u.phone);
      paintStars(mine ? mine.value : 0);
    });
    s.addEventListener('click', () => {
      const u = Store.getUser();
      if (!u) { toast('Please sign in to leave a rating.'); openAuthModal(); return; }
      const value = +s.dataset.v;
      Store.saveRating({ phone: u.phone, value, at: new Date().toISOString() });
      paintStars(value);
      $('#rateNote').textContent = `Thank you. You rated us ${value} of 5.`;
      refreshAvgRating();
      MockEmail.send({
        to: 'studio@am-architects.in',
        subject: `New rating · ${value}/5`,
        body: `Phone: +91 ${u.phone}\nRating: ${value}/5`,
      });
      toast('Thank you for your rating.');
    });
  });
}

/* ---------- 11. AUTH MODAL ---------- */

let authPhone = '';

function openAuthModal() { openModal('#authModal'); setStep('phone'); $('#phoneInput').focus(); }
function openModal(sel) { $(sel).classList.add('is-open'); lockBodyScroll(true); }
function closeModal(sel) { $(sel).classList.remove('is-open'); lockBodyScroll(false); }

function setStep(step) {
  $$('#authModal .auth-step').forEach(s => s.classList.toggle('is-active', s.dataset.step === step));
}

function initModalDismiss() {
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target.matches('[data-close]')) closeModal('#' + m.id);
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal.is-open').forEach(m => closeModal('#' + m.id));
  });
}

function initAuthFlow() {
  $('#sendOtpBtn').addEventListener('click', async () => {
    const raw = $('#phoneInput').value.replace(/\D/g, '');
    if (raw.length < 10) { toast('Please enter a valid 10-digit number.'); return; }
    authPhone = raw.slice(-10);
    const { code } = await MockFirebase.sendOTP(authPhone);
    $('#otpPhoneEcho').textContent = '+91 ' + authPhone;
    $('#otpHint').textContent = code;
    setStep('otp');
    $$('#otpRow input')[0].focus();
  });

  $('#resendOtp').addEventListener('click', async () => {
    const { code } = await MockFirebase.sendOTP(authPhone);
    $('#otpHint').textContent = code;
    toast('Passcode sent again.');
  });

  // OTP input handling
  const inputs = $$('#otpRow input');
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      // auto-verify when full
      if (inputs.every(x => x.value)) $('#verifyOtpBtn').click();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', e => {
      const txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if (txt.length === 6) {
        e.preventDefault();
        inputs.forEach((x, j) => x.value = txt[j] || '');
        $('#verifyOtpBtn').click();
      }
    });
  });

  $('#verifyOtpBtn').addEventListener('click', async () => {
    const code = inputs.map(i => i.value).join('');
    if (code.length < 6) { toast('Enter the 6-digit code.'); return; }
    const { ok } = await MockFirebase.verifyOTP(code);
    if (!ok) {
      toast('Incorrect passcode. Try again.');
      inputs.forEach(i => i.value = '');
      inputs[0].focus();
      return;
    }
    setStep('email');
    $('#emailInput').focus();
  });

  $('#saveEmailBtn').addEventListener('click', () => {
    const email = $('#emailInput').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Please enter a valid email.');
      return;
    }
    finishAuth(email);
  });

  $('#skipEmail').addEventListener('click', () => finishAuth(''));

  $('#doneCloseBtn').addEventListener('click', () => closeModal('#authModal'));
}

function finishAuth(email) {
  const user = { phone: authPhone, email, joined: new Date().toISOString() };
  Store.setUser(user);
  Store.saveUser(user);
  refreshUserUI();

  MockEmail.send({
    to: 'studio@am-architects.in',
    subject: 'New verified visitor',
    body: `Phone: +91 ${authPhone}\nEmail: ${email || '(not provided)'}`,
  });

  $('#doneSub').textContent = email
    ? `Welcome. We'll be in touch at ${email} when relevant. Our team will contact you shortly if you have an open enquiry.`
    : 'Welcome. Our team will contact you shortly if you have an open enquiry.';
  setStep('done');
}

/* ---------- 12. CONTACT FORM ---------- */

function initContactForm() {
  $('#contactForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Honeypot — bots fill this hidden field. Pretend success but drop the lead.
    if (fd.get('botcheck')) { toast('Thank you. Our team will contact you shortly.'); e.target.reset(); return; }

    const lead = {
      type: 'enquiry',
      name: fd.get('name') || '',
      phone: fd.get('phone') || '',
      email: fd.get('email') || '',
      projectType: fd.get('type') || '',
      message: fd.get('message') || '',
    };
    if (!lead.phone || lead.phone.replace(/\D/g, '').length < 10) {
      toast('Please enter a valid phone number.');
      return;
    }
    if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
      toast('Please enter a valid email or leave it blank.');
      return;
    }
    Store.saveLead(lead);

    const subject = `New enquiry · ${lead.projectType}`;
    const body =
      `Name: ${lead.name || '(not provided)'}\n` +
      `Phone: ${lead.phone}\n` +
      `Email: ${lead.email || '(not provided)'}\n` +
      `Type: ${lead.projectType}\n\n` +
      `Message: ${lead.message || '(no message)'}`;

    // Send via Web3Forms email
    await MockEmail.send({ to: 'studio', subject, body, leadData: lead });

    // Offer one-tap WhatsApp forward
    const wa = MockEmail.whatsappForward({ subject, body });
    if (wa) {
      const open = confirm('Lead saved. Open WhatsApp to forward this enquiry to the studio now?');
      if (open) window.open(wa, '_blank');
    }

    toast('Thank you. Our team will contact you shortly.');
    e.target.reset();
  });
}

/* ---------- 13. CAREERS FORM ---------- */

function initCareersForm() {
  $('#resumeFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast('File exceeds 8 MB.'); e.target.value = ''; return; }
    $('#fileLabel').textContent = f.name;
  });

  $('#careerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Honeypot
    if (fd.get('botcheck')) { toast('Application received. We\'ll be in touch.'); e.target.reset(); return; }

    const app = {
      type: 'application',
      name: fd.get('name'),
      phone: fd.get('phone'),
      email: fd.get('email'),
      role: fd.get('role'),
      resume: $('#resumeFile').files[0]?.name || '(none)',
    };
    if (!app.name || !app.phone || !app.email) { toast('Please complete all fields.'); return; }
    Store.saveLead(app);

    const subject = `Application · ${app.role}`;
    const body =
      `Name: ${app.name}\nPhone: ${app.phone}\nEmail: ${app.email}\nRole: ${app.role}\nResume file: ${app.resume}`;

    await MockEmail.send({ to: 'careers', subject, body, leadData: app });

    toast('Application received. We\'ll be in touch.');
    e.target.reset();
    $('#fileLabel').textContent = 'Upload a PDF (max 8 MB)';
  });
}

/* ---------- 14. FAB ---------- */

function initFab() {
  const fab = $('#fab');
  $('#fabMain').addEventListener('click', () => fab.classList.toggle('is-open'));
  document.addEventListener('click', e => {
    if (!fab.contains(e.target)) fab.classList.remove('is-open');
  });
}

/* ---------- 15. PARALLAX (light) ---------- */

function initParallax() {
  const bg = $('.hero__bg-image');
  if (!bg || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      bg.style.transform = `translateY(${y * 0.2}px) scale(${1 + y * 0.0002})`;
    }
  }, { passive: true });
}

/* ---------- 17. PREMIUM UPGRADES ---------- */

function initLiveTime() {
  const el = $('#heroTime');
  if (!el) return;
  const tick = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    el.textContent = `Tamil Nadu · ${hh}:${mm}`;
  };
  tick();
  setInterval(tick, 30000);
}

function initCustomCursor() {
  if (matchMedia('(hover: none)').matches || window.innerWidth < 900) return;
  const dot = document.createElement('div'); dot.className = 'cursor';
  const ring = document.createElement('div'); ring.className = 'cursor-ring';
  document.body.append(dot, ring);

  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  });
  const loop = () => {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  };
  loop();

  $$('a, button, .project, .article, .filter, .rate-stars span, .int, .testi__media, .abs, .rec').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.classList.add('is-hover'); ring.classList.add('is-hover'); });
    el.addEventListener('mouseleave', () => { dot.classList.remove('is-hover'); ring.classList.remove('is-hover'); });
  });
}

function initMagnetic() {
  if (matchMedia('(hover: none)').matches) return;
  $$('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

function initKineticScroll() {
  const row = $('[data-kinetic]');
  if (!row) return;
  let pos = 0;
  let velocity = 0;
  let lastY = window.scrollY;

  const loop = () => {
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    velocity += dy * 0.7;
    velocity *= 0.92; // friction
    pos -= 0.5 + velocity; // base drift + scroll velocity
    // wrap
    const w = row.scrollWidth / 2;
    if (-pos > w) pos += w;
    if (pos > 0) pos -= w;
    row.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(loop);
  };
  loop();
}

function wrapNavLinks() {
  $$('.nav__links a').forEach(a => {
    const text = a.textContent;
    a.innerHTML = `<span data-text="${text}">${text}</span>`;
  });
}

function injectProjectIndices() {
  $$('#projectsGrid .project').forEach((el, i) => {
    const idx = String(i + 1).padStart(2, '0');
    if (!$('.project__index', el)) {
      const tag = document.createElement('div');
      tag.className = 'project__index';
      tag.textContent = `№ ${idx}`;
      el.appendChild(tag);
    }
  });
}

function initSectionFollowup() {
  // re-index when projects re-render
  const grid = $('#projectsGrid');
  if (!grid) return;
  const obs = new MutationObserver(injectProjectIndices);
  obs.observe(grid, { childList: true });
  injectProjectIndices();
}

/* ---------- 18. STATS COUNTER ---------- */
function initStatsCounter() {
  const counters = $$('[data-counter]');
  if (!counters.length) return;
  const animate = el => {
    const target = +el.dataset.counter;
    const dur = 1800;
    const t0 = performance.now();
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const cio = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { animate(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.4 });
  counters.forEach(c => cio.observe(c));
}

/* ---------- 19. SERVICES — preview follows cursor ---------- */
function initServices() {
  const items = $$('.svc');
  if (!items.length) return;
  // click → scroll to projects
  items.forEach(item => {
    item.addEventListener('click', () => {
      const tgt = document.querySelector('#projects');
      if (tgt) window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    });
  });
  // hover preview follow (desktop only)
  if (matchMedia('(hover: none)').matches) return;
  items.forEach(item => {
    const preview = $('.svc__preview', item);
    if (!preview) return;
    item.addEventListener('mousemove', e => {
      const r = item.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      preview.style.right = 'auto';
      preview.style.left = Math.min(r.width - 300, x + 40) + 'px';
      preview.style.top = (y - 90) + 'px';
    });
  });
}

/* ---------- 20. BEFORE / AFTER SLIDER ---------- */
function initBeforeAfter() {
  const frame = $('#baFrame');
  if (!frame) return;
  const before = $('#baBefore');
  const handle = $('#baHandle');
  let dragging = false;

  const setPos = clientX => {
    const r = frame.getBoundingClientRect();
    let pct = ((clientX - r.left) / r.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    before.style.width = pct + '%';
    handle.style.left = pct + '%';
  };
  const onDown = e => {
    dragging = true;
    document.body.style.userSelect = 'none';
    setPos(e.touches ? e.touches[0].clientX : e.clientX);
  };
  const onMove = e => {
    if (!dragging) return;
    setPos(e.touches ? e.touches[0].clientX : e.clientX);
  };
  const onUp = () => { dragging = false; document.body.style.userSelect = ''; };

  frame.addEventListener('mousedown', onDown);
  frame.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
}

/* ---------- 21. VERTICAL → HORIZONTAL SCROLL ---------- */
function initHScroll() {
  const section = $('#hscrollSection');
  const rail = $('#hscrollRail');
  const fill = $('#hscrollFill');
  const counter = $('#hscrollCount');
  if (!section || !rail) return;
  if (window.innerWidth <= 800) return; // mobile uses native horizontal scroll

  const cards = $$('.hs-card', rail);
  const totalCards = cards.length;

  const getMaxX = () => {
    const viewport = rail.parentElement.clientWidth;
    const padding = parseInt(getComputedStyle(rail).paddingLeft, 10) || 0;
    return Math.max(0, rail.scrollWidth - viewport + padding * 2);
  };

  const syncSectionHeight = () => {
    section.style.height = `${window.innerHeight + getMaxX()}px`;
  };

  const getProgress = () => {
    const r = section.getBoundingClientRect();
    const total = Math.max(1, section.offsetHeight - window.innerHeight);
    return Math.max(0, Math.min(1, -r.top / total));
  };

  const render = (progress) => {
    const maxX = getMaxX();

    rail.style.transform = `translateX(${-progress * maxX}px)`;
    if (fill) fill.style.width = (progress * 100) + '%';
    if (counter) {
      const idx = Math.min(totalCards, Math.max(1, Math.ceil(progress * totalCards) || 1));
      counter.textContent = String(idx).padStart(2, '0');
    }
  };

  const onScroll = () => render(getProgress());
  const onResize = () => {
    syncSectionHeight();
    onScroll();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  syncSectionHeight();
  onScroll();
  window.addEventListener('load', onResize, { once: true });
}

/* ---------- 22. CONTENT STORE (editable) ---------- */
const ContentStore = {
  KEY_P: 'am_projects_v1',
  KEY_A: 'am_articles_v1',

  loadProjects() {
    const stored = localStorage.getItem(this.KEY_P);
    if (stored) { try { return JSON.parse(stored); } catch { } }
    return PROJECTS; // defaults from script
  },
  saveProjects(arr) {
    localStorage.setItem(this.KEY_P, JSON.stringify(arr));
    PROJECTS.splice(0, PROJECTS.length, ...arr);
  },
  loadArticles() {
    const stored = localStorage.getItem(this.KEY_A);
    if (stored) { try { return JSON.parse(stored); } catch { } }
    return null; // null = use embedded JSON island
  },
  saveArticles(arr) {
    localStorage.setItem(this.KEY_A, JSON.stringify(arr));
    ARTICLES = arr;
  }
};

/* ---------- 23. ADMIN PANEL ---------- */
function initAdmin() {
  const panel = $('#adminPanel');
  if (!panel) return;

  // open if URL hash is #admin
  const checkHash = () => {
    if (location.hash === CONFIG.ADMIN_ROUTE) {
      panel.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    } else {
      panel.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };
  window.addEventListener('hashchange', checkHash);
  checkHash();

  // login — sends password to backend for verification, gets back a 4-hour token
  let attempts = 0;
  let lockUntil = 0;
  const tryLogin = async () => {
    if (Date.now() < lockUntil) {
      const wait = Math.ceil((lockUntil - Date.now()) / 1000);
      toast(`Too many attempts. Try again in ${wait}s.`);
      return;
    }
    const v = $('#adminPassword').value;
    if (!v) return;

    try {
      const r = await fetch(CONFIG.API_ADMIN_AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: v })
      });
      const data = await r.json().catch(() => ({}));

      if (r.ok && data.token) {
        attempts = 0;
        sessionStorage.setItem('am_admin', data.token);
        panel.classList.add('is-authed');
        $('#adminPassword').value = '';
        renderAdmin();
        return;
      }

      if (r.status === 429) {
        lockUntil = Date.now() + 5 * 60_000;
        toast('Too many failed attempts. Locked for 5 minutes.');
        return;
      }

      attempts++;
      if (attempts >= 5) {
        lockUntil = Date.now() + 30000;
        attempts = 0;
        toast('Too many failed attempts. Locked for 30 seconds.');
      } else {
        toast(`Wrong password. (${5 - attempts} attempts left)`);
      }
    } catch (e) {
      toast('Could not reach server. Check your connection.');
    }
  };
  if (sessionStorage.getItem('am_admin')) panel.classList.add('is-authed');
  $('#adminLoginBtn').addEventListener('click', tryLogin);
  $('#adminPassword').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

  $('#adminLogout').addEventListener('click', () => {
    sessionStorage.removeItem('am_admin');
    panel.classList.remove('is-authed');
    location.hash = '';
  });

  // tabs
  $$('.admin__tab').forEach(t => {
    t.addEventListener('click', () => {
      $$('.admin__tab').forEach(x => x.classList.remove('is-active'));
      $$('.admin__pane').forEach(x => x.classList.remove('is-active'));
      t.classList.add('is-active');
      $(`.admin__pane[data-pane="${t.dataset.tab}"]`).classList.add('is-active');
    });
  });

  // add buttons
  $('#addProject').addEventListener('click', () => openProjectEditor(null));
  $('#addArticle').addEventListener('click', () => openArticleEditor(null));

  // export / import
  $('#adminExport').addEventListener('click', () => {
    const data = {
      projects: ContentStore.loadProjects(),
      articles: ContentStore.loadArticles() || ARTICLES,
      leads: JSON.parse(localStorage.getItem('am_leads') || '[]'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `am-architects-content-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Content exported.');
  });

  $('#adminImport').addEventListener('click', () => $('#adminImportFile').click());
  $('#adminImportFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('JSON file too large (max 5MB).'); e.target.value = ''; return; }

    // Only allow http(s) image URLs — prevents javascript: / data: payloads
    const safeUrl = (u) => {
      if (typeof u !== 'string') return '';
      try {
        const url = new URL(u, location.href);
        return (url.protocol === 'http:' || url.protocol === 'https:') ? u : '';
      } catch { return ''; }
    };

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.projects)) {
          const clean = data.projects
            .filter(p => p && typeof p === 'object')
            .map(p => ({
              id: String(p.id || ('p' + Date.now())),
              cat: ['residential', 'commercial', 'community'].includes(p.cat) ? p.cat : 'residential',
              title: String(p.title || '').slice(0, 200),
              location: String(p.location || '').slice(0, 200),
              year: String(p.year || '').slice(0, 20),
              size: ['project--sm', 'project--md', 'project--lg'].includes(p.size) ? p.size : 'project--md',
              img: safeUrl(p.img),
              tags: Array.isArray(p.tags) ? p.tags.slice(0, 10).map(t => String(t).slice(0, 50)) : [],
              desc: String(p.desc || '').slice(0, 500),
              body: Array.isArray(p.body) ? p.body.slice(0, 20).map(s => String(s).slice(0, 5000)) : [],
              facts: {
                area: String(p.facts?.area || '').slice(0, 100),
                completion: String(p.facts?.completion || '').slice(0, 100),
                team: String(p.facts?.team || '').slice(0, 200)
              }
            }));
          ContentStore.saveProjects(clean);
        }
        if (data && Array.isArray(data.articles)) {
          const clean = data.articles
            .filter(a => a && typeof a === 'object')
            .map(a => ({
              id: String(a.id || ('a' + Date.now())),
              category: ['sustainable', 'modern', 'techniques'].includes(a.category) ? a.category : 'modern',
              categoryLabel: String(a.categoryLabel || '').slice(0, 100),
              title: String(a.title || '').slice(0, 200),
              excerpt: String(a.excerpt || '').slice(0, 500),
              date: String(a.date || '').slice(0, 50),
              readTime: String(a.readTime || '').slice(0, 30),
              image: safeUrl(a.image),
              body: String(a.body || '').slice(0, 20000)
            }));
          ContentStore.saveArticles(clean);
        }
        renderAdmin();
        renderProjects();
        renderArticles();
        toast('Content imported successfully.');
      } catch {
        toast('Invalid JSON file.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  });

  $('#clearLeads').addEventListener('click', () => {
    if (!confirm('Delete all captured leads? This cannot be undone.')) return;
    localStorage.removeItem('am_leads');
    renderAdmin();
    toast('All leads cleared.');
  });

  // initial render if already auth'd
  if (panel.classList.contains('is-authed')) renderAdmin();
}

function renderAdmin() {
  // projects — every interpolated field escaped to prevent XSS
  const projects = ContentStore.loadProjects();
  $('#adminProjects').innerHTML = projects.map(p => `
    <div class="admin__row">
      <div class="admin__row-thumb" style="background-image:url('${encodeURI(p.img || '')}')"></div>
      <div class="admin__row-info">
        <b>${esc(p.title)}</b>
        <span>${esc(p.cat)} · ${esc(p.location)} · ${esc(p.year)}</span>
      </div>
      <div class="admin__row-actions">
        <button class="admin__action" data-edit-p="${esc(p.id)}">Edit</button>
        <button class="admin__action admin__action--del" data-del-p="${esc(p.id)}">Delete</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">No projects yet.</p>';

  $$('[data-edit-p]').forEach(b => b.addEventListener('click', () => openProjectEditor(b.dataset.editP)));
  $$('[data-del-p]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Delete this project?')) return;
    const arr = ContentStore.loadProjects().filter(x => x.id !== b.dataset.delP);
    ContentStore.saveProjects(arr);
    renderAdmin();
    renderProjects();
    toast('Project deleted.');
  }));

  // articles — same escape treatment
  const articles = ContentStore.loadArticles() || ARTICLES;
  $('#adminArticles').innerHTML = articles.map(a => `
    <div class="admin__row">
      <div class="admin__row-thumb" style="background-image:url('${encodeURI(a.image || '')}')"></div>
      <div class="admin__row-info">
        <b>${esc(a.title)}</b>
        <span>${esc(a.categoryLabel || a.category)} · ${esc(a.date)}</span>
      </div>
      <div class="admin__row-actions">
        <button class="admin__action" data-edit-a="${esc(a.id)}">Edit</button>
        <button class="admin__action admin__action--del" data-del-a="${esc(a.id)}">Delete</button>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted)">No articles yet.</p>';

  $$('[data-edit-a]').forEach(b => b.addEventListener('click', () => openArticleEditor(b.dataset.editA)));
  $$('[data-del-a]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Delete this article?')) return;
    const list = (ContentStore.loadArticles() || ARTICLES).filter(x => x.id !== b.dataset.delA);
    ContentStore.saveArticles(list);
    renderAdmin();
    renderArticles();
    toast('Article deleted.');
  }));

  // leads — same escape treatment
  const leads = JSON.parse(localStorage.getItem('am_leads') || '[]');
  $('#leadCount').textContent = leads.length;
  $('#adminLeadsList').innerHTML = leads.length ? leads.slice().reverse().map(l => {
    const phone = String(l.phone || '');
    const safePhone = phone.replace(/\D/g, '');
    const wa = safePhone ? `https://wa.me/${safePhone}` : '';
    return `
      <div class="lead-row">
        <div class="lead-meta">${esc(l.type || 'lead')} · ${esc(new Date(l.at).toLocaleString())}</div>
        <b>${esc(l.name || phone || '(unknown)')}</b>
        <pre>${esc([
          l.phone && `Phone: ${l.phone}`,
          l.email && `Email: ${l.email}`,
          l.projectType && `Type: ${l.projectType}`,
          l.role && `Role: ${l.role}`,
          l.message && `Message: ${l.message}`,
          l.resume && `Resume: ${l.resume}`
        ].filter(Boolean).join('\n'))}</pre>
        ${wa ? `<a class="lead-wa" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Open in WhatsApp →</a>` : ''}
      </div>
    `;
  }).join('') : '<p style="color:var(--muted)">No leads captured yet.</p>';
}

function openProjectEditor(id) {
  const projects = ContentStore.loadProjects();
  const p = id ? projects.find(x => x.id === id) : {
    id: 'p' + Date.now(),
    cat: 'residential',
    title: '',
    location: '',
    year: String(new Date().getFullYear()),
    size: 'project--md',
    img: '',
    tags: [],
    desc: '',
    body: [''],
    facts: { area: '', completion: '', team: '' }
  };

  $('#editorBody').innerHTML = `
    <div class="editor">
      <h2>${id ? 'Edit project' : 'New project'}</h2>
      <label><span>Title</span><input id="ed_title" value="${esc(p.title)}"></label>
      <label><span>Category</span>
        <select id="ed_cat">
          <option value="residential" ${p.cat === 'residential' ? 'selected' : ''}>Residential</option>
          <option value="commercial" ${p.cat === 'commercial' ? 'selected' : ''}>Commercial</option>
          <option value="community" ${p.cat === 'community' ? 'selected' : ''}>Community</option>
        </select>
      </label>
      <label><span>Location</span><input id="ed_loc" value="${esc(p.location)}"></label>
      <label><span>Year</span><input id="ed_year" value="${esc(p.year)}"></label>
      <label><span>Image URL</span><input id="ed_img" value="${esc(p.img)}" placeholder="https://..."></label>
      <label><span>Tags (comma-separated)</span><input id="ed_tags" value="${esc((p.tags || []).join(', '))}"></label>
      <label><span>Short description (1 line)</span><textarea id="ed_desc" rows="2">${esc(p.desc || '')}</textarea></label>
      <label><span>Full description (paragraphs separated by blank line)</span><textarea id="ed_body" rows="6">${esc((p.body || []).join('\n\n'))}</textarea></label>
      <label><span>Area</span><input id="ed_area" value="${esc(p.facts?.area || '')}"></label>
      <label><span>Completion</span><input id="ed_comp" value="${esc(p.facts?.completion || '')}"></label>
      <label><span>Team</span><input id="ed_team" value="${esc(p.facts?.team || '')}"></label>
      <label><span>Tile size</span>
        <select id="ed_size">
          <option value="project--sm" ${p.size === 'project--sm' ? 'selected' : ''}>Small</option>
          <option value="project--md" ${p.size === 'project--md' ? 'selected' : ''}>Medium</option>
          <option value="project--lg" ${p.size === 'project--lg' ? 'selected' : ''}>Large</option>
        </select>
      </label>
      <div class="editor__actions">
        <button class="btn btn--primary" id="ed_save"><span>${id ? 'Save changes' : 'Add project'}</span></button>
        <button class="btn btn--ghost" data-close>Cancel</button>
      </div>
    </div>
  `;
  openModal('#editorModal');

  $('#ed_save').addEventListener('click', () => {
    const updated = {
      id: p.id,
      cat: $('#ed_cat').value,
      title: $('#ed_title').value.trim(),
      location: $('#ed_loc').value.trim(),
      year: $('#ed_year').value.trim(),
      size: $('#ed_size').value,
      img: $('#ed_img').value.trim(),
      tags: $('#ed_tags').value.split(',').map(s => s.trim()).filter(Boolean),
      desc: $('#ed_desc').value.trim(),
      body: $('#ed_body').value.split(/\n\n+/).map(s => s.trim()).filter(Boolean),
      facts: {
        area: $('#ed_area').value.trim(),
        completion: $('#ed_comp').value.trim(),
        team: $('#ed_team').value.trim()
      }
    };
    if (!updated.title || !updated.img) { toast('Title and image are required.'); return; }
    let list = ContentStore.loadProjects();
    if (id) list = list.map(x => x.id === id ? updated : x);
    else list.push(updated);
    ContentStore.saveProjects(list);
    closeModal('#editorModal');
    renderAdmin();
    renderProjects();
    toast(id ? 'Project saved.' : 'Project added.');
  });
}

function openArticleEditor(id) {
  const articles = ContentStore.loadArticles() || ARTICLES;
  const a = id ? articles.find(x => x.id === id) : {
    id: 'a' + Date.now(),
    category: 'modern',
    categoryLabel: 'Modern Design',
    title: '',
    excerpt: '',
    date: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    readTime: '5 min read',
    image: '',
    body: ''
  };

  $('#editorBody').innerHTML = `
    <div class="editor">
      <h2>${id ? 'Edit article' : 'New article'}</h2>
      <label><span>Title</span><input id="ed_title" value="${esc(a.title)}"></label>
      <label><span>Category</span>
        <select id="ed_cat">
          <option value="sustainable" ${a.category === 'sustainable' ? 'selected' : ''}>Sustainable Architecture</option>
          <option value="modern" ${a.category === 'modern' ? 'selected' : ''}>Modern Design</option>
          <option value="techniques" ${a.category === 'techniques' ? 'selected' : ''}>Building Techniques</option>
        </select>
      </label>
      <label><span>Image URL</span><input id="ed_img" value="${esc(a.image)}" placeholder="https://..."></label>
      <label><span>Date (e.g. March 2026)</span><input id="ed_date" value="${esc(a.date)}"></label>
      <label><span>Read time</span><input id="ed_read" value="${esc(a.readTime)}"></label>
      <label><span>Excerpt (1-2 sentences)</span><textarea id="ed_excerpt" rows="3">${esc(a.excerpt)}</textarea></label>
      <label><span>Body (paragraphs separated by blank line)</span><textarea id="ed_body" rows="10">${esc(a.body)}</textarea></label>
      <div class="editor__actions">
        <button class="btn btn--primary" id="ed_save"><span>${id ? 'Save changes' : 'Publish article'}</span></button>
        <button class="btn btn--ghost" data-close>Cancel</button>
      </div>
    </div>
  `;
  openModal('#editorModal');

  $('#ed_save').addEventListener('click', () => {
    const labelMap = { sustainable: 'Sustainable Architecture', modern: 'Modern Design', techniques: 'Building Techniques' };
    const updated = {
      id: a.id,
      category: $('#ed_cat').value,
      categoryLabel: labelMap[$('#ed_cat').value],
      title: $('#ed_title').value.trim(),
      excerpt: $('#ed_excerpt').value.trim(),
      date: $('#ed_date').value.trim(),
      readTime: $('#ed_read').value.trim(),
      image: $('#ed_img').value.trim(),
      body: $('#ed_body').value.trim()
    };
    if (!updated.title || !updated.image) { toast('Title and image are required.'); return; }
    let list = ContentStore.loadArticles() || ARTICLES.slice();
    if (id) list = list.map(x => x.id === id ? updated : x);
    else list.push(updated);
    ContentStore.saveArticles(list);
    closeModal('#editorModal');
    renderAdmin();
    renderArticles();
    toast(id ? 'Article saved.' : 'Article published.');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Run loader FIRST and independently — never blocked by anything else
  runLoader();

  // Run all other init in a resilient way — one failure won't break the rest
  const safe = (name, fn) => { try { fn(); } catch (e) { console.warn(`[${name}] failed:`, e); } };

  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  safe('initNav', initNav);
  safe('initReveal', initReveal);
  safe('renderProjects', () => renderProjects());
  safe('initProjectFilters', initProjectFilters);
  safe('renderArticles', () => renderArticles());
  safe('initArticleFilters', initArticleFilters);
  safe('initCarousel', initCarousel);
  safe('initRatings', initRatings);
  safe('initModalDismiss', initModalDismiss);
  safe('initAuthFlow', initAuthFlow);
  safe('initContactForm', initContactForm);
  safe('initCareersForm', initCareersForm);
  safe('initFab', initFab);
  safe('initParallax', initParallax);
  safe('refreshUserUI', refreshUserUI);
  safe('initLiveTime', initLiveTime);
  safe('wrapNavLinks', wrapNavLinks);
  safe('initCustomCursor', initCustomCursor);
  safe('initMagnetic', initMagnetic);
  safe('initKineticScroll', initKineticScroll);
  safe('initSectionFollowup', initSectionFollowup);
  safe('initStatsCounter', initStatsCounter);
  safe('initServices', initServices);
  safe('initBeforeAfter', initBeforeAfter);
  safe('initHScroll', initHScroll);
  safe('initAdmin', initAdmin);

  console.log('%cAM Architects — Studio site loaded.', 'font-family:Georgia,serif;font-style:italic;color:#c9985f;font-size:14px;');
});
