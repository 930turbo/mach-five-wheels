// Minimal lux interactions for the About page
document.addEventListener('DOMContentLoaded', () => {
  /* Modal */
  const modal = document.getElementById('zipModal');
  const openers = [document.getElementById('openZipModal'), document.getElementById('openZipModalStrip')].filter(Boolean);
  const closeEls = modal?.querySelectorAll('[data-close]');

  const openModal = () => {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    const input = modal.querySelector('#zip');
    setTimeout(() => input && input.focus(), 50);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  openers.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); openModal(); }));
  closeEls?.forEach(el => el.addEventListener('click', closeModal));
  modal?.addEventListener('click', (e) => { if (e.target.classList.contains('modal__backdrop')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* Unmute toggle */
  const videoFrame = document.querySelector('.video-frame iframe');
  const videoBtn = document.querySelector('[data-video-toggle]');
  videoBtn?.addEventListener('click', () => {
    // Toggle mute via YouTube player query params (simple reload)
    if (!videoFrame) return;
    const url = new URL(videoFrame.src);
    const isMuted = url.searchParams.get('mute') === '1';
    url.searchParams.set('mute', isMuted ? '0' : '1');
    videoFrame.src = url.toString();
    videoBtn.textContent = isMuted ? 'Mute' : 'Unmute';
  });

  /* Scroll reveal (simple, no libs) */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-in');
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.card-3d, .section-title, .split, .tiles .tile, .cta-surface, .lead.center')
    .forEach(el => { el.classList.add('reveal'); io.observe(el); });
});
