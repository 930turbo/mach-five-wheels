// Simple filter + search + upcoming/past logic
document.addEventListener('DOMContentLoaded', () => {
  const buttons = Array.from(document.querySelectorAll('.chip'));
  const cards = Array.from(document.querySelectorAll('.event-card'));
  const searchInput = document.getElementById('eventSearch');

  const today = new Date();
  today.setHours(0,0,0,0);

  function isUpcoming(card) {
    const d = new Date(card.dataset.date);
    d.setHours(0,0,0,0);
    return d >= today;
  }

  function isPast(card) {
    const d = new Date(card.dataset.date);
    d.setHours(0,0,0,0);
    return d < today;
  }

  function matchesSearch(card, q) {
    if (!q) return true;
    q = q.trim().toLowerCase();
    const text = card.innerText.toLowerCase();
    const tags = (card.dataset.tags || '').toLowerCase();
    return text.includes(q) || tags.includes(q);
  }

  let activeFilter = 'all';
  let query = '';

  function apply() {
    cards.forEach(card => {
      let pass = true;
      if (activeFilter === 'upcoming') pass = isUpcoming(card);
      if (activeFilter === 'past') pass = isPast(card);
      if (pass) pass = matchesSearch(card, query);
      card.style.display = pass ? '' : 'none';
    });
  }

  // filter buttons
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('is-active'); btn.setAttribute('aria-pressed','true');
      activeFilter = btn.dataset.filter || 'all';
      apply();
    });
  });

  // search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      query = e.target.value;
      apply();
    });
  }

  // Initial render
  apply();
});
