/* Isolated public ranking DEMO. Never reads accounts, writes XP or uses localStorage. */
(function (root) {
  'use strict';
  const DEMO = Object.freeze([
    ['Sol Andina', 3200, ['culture', 'friend']], ['Café Viajero', 2400, ['friend']],
    ['Colibrí', 1900, ['culture']], ['Sendero Verde', 1500, ['friend']],
    ['Luna Lojana', 1000, ['culture']], ['Brisa del Sur', 850, []],
    ['Cóndor', 700, ['friend']], ['Flor de Loja', 500, ['friend']],
    ['Río Zamora', 350, []], ['Estrella', 200, []]
  ].map(([alias, xp, badges], index) => Object.freeze({ alias, xp, badges: Object.freeze(badges),
    // Existing local image is a placeholder, never a photo of a real participant.
    photo: 'mascota-vive-loja.png', color: ['#fbbf24', '#5eead4', '#fda4af', '#c4b5fd'][index % 4] })));
  function selectTop(entries, limit) {
    if (![3, 5, 10].includes(limit)) throw new Error('Invalid ranking size');
    return entries.filter(item => typeof item.alias === 'string' && Number.isSafeInteger(item.xp) && item.xp >= 0)
      .slice().sort((a, b) => b.xp - a.xp || a.alias.localeCompare(b.alias)).slice(0, limit);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { DEMO, selectTop };
  if (!root || !root.document) return;
  const $ = id => root.document.getElementById(id);
  const host = $('chabaquitoRanking'); if (!host) return;
  const core = root.VisitaLojaChabaquitoV1Core;
  const english = () => root.document.documentElement.lang === 'en';
  const tr = (es, en) => english() ? en : es;
  const make = (tag, cls, text) => { const el = root.document.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  let limit = 5, selected = null;
  const levels = ['Curious Traveler', 'Loja Walker', 'Loja Adventurer', 'Loja Explorer', 'Loja Connoisseur', 'Loja Guardian', 'Master Explorer', 'Loja Legend'];
  function levelLabel(entry) { const level = core.levelForXp(entry.xp); return `${tr('Nivel', 'Level')} ${level} · ${english() ? levels[level - 1] : core.LEVELS[level - 1].name}`; }
  function badges(entry) {
    const box = make('div', 'chabaquito-ranking-badges');
    entry.badges.slice(0, 3).forEach(id => box.append(make('span', '', id === 'friend'
      ? tr('Amigo de Chabaquito', 'Friend of Chabaquito') : tr('Explorador cultural', 'Culture explorer')))); return box;
  }
  function avatar(entry) {
    const wrap = make('span', 'chabaquito-ranking-avatar'); wrap.style.setProperty('--avatar-accent', entry.color);
    const img = make('img', ''); img.src = entry.photo; img.alt = ''; img.width = 80; img.height = 80; img.loading = 'lazy';
    img.addEventListener('error', () => { img.remove(); wrap.textContent = entry.alias[0]; }, { once: true }); wrap.append(img); return wrap;
  }
  function detail(entry) {
    selected = entry; const content = $('chabaquitoRankingProfileContent'); content.replaceChildren();
    content.append(avatar(entry)); const title = make('h4', '', entry.alias); title.id = 'chabaquitoRankingProfileTitle';
    content.append(title, make('p', '', levelLabel(entry)), make('strong', 'chabaquito-ranking-xp', `${entry.xp.toLocaleString(english() ? 'en' : 'es')} XP · ${tr('ejemplo', 'sample')}`), badges(entry),
      make('p', 'chabaquito-ranking-privacy', tr('Perfil ficticio y avatar provisional de Chabaquito. El ranking real usará alias y foto pública con consentimiento.',
        'Fictional profile with a placeholder Chabaquito avatar. The real ranking will use a public alias and photo with consent.')));
  }
  function card(entry, rank, podium) {
    const button = make('button', podium ? `chabaquito-ranking-winner rank-${rank}` : 'chabaquito-ranking-row'); button.type = 'button';
    button.setAttribute('aria-label', `${tr('Ver perfil de ejemplo', 'View sample profile')}: ${entry.alias}, ${tr('puesto', 'position')} ${rank}`);
    button.append(make('span', 'chabaquito-ranking-position', `${rank === 1 ? '★ ' : ''}#${rank}`), avatar(entry));
    const info = make('span', 'chabaquito-ranking-person'); info.append(make('strong', '', entry.alias), make('span', 'chabaquito-ranking-level', levelLabel(entry)));
    button.append(info, make('strong', 'chabaquito-ranking-xp', `${entry.xp.toLocaleString(english() ? 'en' : 'es')} XP`));
    if (podium) button.append(badges(entry));
    button.addEventListener('click', () => { detail(entry); $('chabaquitoRankingProfile').showModal(); }); return button;
  }
  function render() {
    $('chabaquitoRankingDemo').textContent = tr('Ranking de usuarios · demostración', 'User ranking · demo');
    $('chabaquitoRankingTitle').textContent = tr('Exploradores de Loja', 'Loja explorers');
    $('chabaquitoRankingDescription').textContent = tr('Conoce el podio y explora el Top 3, 5 o 10. Estos perfiles y puntos son de ejemplo.', 'Meet the podium and explore the Top 3, 5 or 10. These profiles and points are samples.');
    $('chabaquitoRankingPrivacy').textContent = tr('El ranking real será voluntario y contará únicamente XP validado. Aquí no se consultan cuentas reales.', 'The real ranking will be opt-in and use validated XP only. No real accounts are queried here.');
    $('chabaquitoRankingFilters').setAttribute('aria-label', tr('Cantidad de usuarios', 'Number of users'));
    $('chabaquitoRankingClose').setAttribute('aria-label', tr('Cerrar', 'Close'));
    const entries = selectTop(DEMO, limit); const podium = $('chabaquitoRankingPodium'), list = $('chabaquitoRankingList'); podium.replaceChildren(); list.replaceChildren();
    entries.slice(0, 3).forEach((entry, index) => podium.append(card(entry, index + 1, true)));
    entries.slice(3).forEach((entry, index) => { const item = make('li', ''); item.append(card(entry, index + 4, false)); list.append(item); });
    list.hidden = entries.length <= 3;
    host.querySelectorAll('[data-ranking-limit]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.rankingLimit) === limit)));
    $('chabaquitoRankingStatus').textContent = tr(`Mostrando ${entries.length} perfiles de ejemplo. Pulsa un perfil para ver sus insignias.`, `Showing ${entries.length} sample profiles. Select a profile to see badges.`);
    if (selected && $('chabaquitoRankingProfile').open) detail(selected);
  }
  host.querySelectorAll('[data-ranking-limit]').forEach(button => button.addEventListener('click', () => { limit = Number(button.dataset.rankingLimit); render(); }));
  $('chabaquitoRankingClose').addEventListener('click', () => $('chabaquitoRankingProfile').close());
  $('chabaquitoRankingProfile').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  new MutationObserver(render).observe(root.document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  render();
})(typeof window !== 'undefined' ? window : null);
