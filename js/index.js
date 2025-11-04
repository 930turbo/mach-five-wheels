// =====================================================
// Mach Five Wheels — Main JS (Index)
// Header/Footer, Hero Slider, Zip Modal, Feature Gallery
// + Force scroll to top on refresh / navigation
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  const inPages = location.pathname.includes("/pages/");
  const base = inPages ? "../" : "";

  // ------------------------------
  // Force Top (disable restoration)
  // ------------------------------
  if ("scrollRestoration" in history) {
    try { history.scrollRestoration = "manual"; } catch {}
  }
  const toTop = () => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      html.style.scrollBehavior = prev || "";
    });
  };

  // On full load and when restored from bfcache
  window.addEventListener("load", toTop);
  window.addEventListener("pageshow", (e) => {
    // When coming back from bfcache, some browsers keep position—override
    toTop();
  });

  // Optional: if anchors are yanking you down on first paint, uncomment:
  /*
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  */

  // ------------------------------
  // Inject Header & Footer (then ensure top)
  // ------------------------------
  const headerPromise = fetch(`${base}partials/header.html`)
    .then(res => res.text())
    .then(html => {
      const headerEl = document.getElementById("header");
      if (!headerEl) return;
      headerEl.innerHTML = html;

      // Home-only add-on under logo
      const isHome = location.pathname === "/" || location.pathname.endsWith("/index.html");
      if (isHome) {
        const logoDiv = document.querySelector(".logo");
        if (logoDiv && !logoDiv.querySelector(".main-site-btn")) {
          const btnWrapper = document.createElement("div");
          btnWrapper.className = "header-link-wrapper";
          btnWrapper.innerHTML = `
            <a href="https://machfivemotors.com"
               class="main-site-btn"
               target="_blank"
               rel="noopener">
              Explore Mach Five
            </a>`;
          logoDiv.appendChild(btnWrapper);
        }
      }
    })
    .catch(() => { /* no-op */ });

  const footerPromise = fetch(`${base}partials/footer.html`)
    .then(res => res.text())
    .then(html => {
      const footerEl = document.getElementById("footer");
      if (!footerEl) return;
      footerEl.innerHTML = html;
    })
    .catch(() => { /* no-op */ });

  // After both injects, re-assert top (in case layout shift moved it)
  Promise.allSettled([headerPromise, footerPromise]).then(() => {
    requestAnimationFrame(() => toTop());
  });

  // ------------------------------
  // Hero Slider (dots + progress + swipe + keyboard) — no arrows
  // ------------------------------
  (function initHeroSlider() {
    const sliderEl = document.querySelector(".hero-slider");
    if (!sliderEl) return;

    const slides = Array.from(sliderEl.querySelectorAll(".slide"));
    const dots   = Array.from(sliderEl.querySelectorAll(".dot"));
    const bar    = sliderEl.querySelector(".slider-progress .bar");
    if (!slides.length || !dots.length || !bar) return;

    let index = 0;
    const intervalMs = 4000; // matches --hero-interval
    let timer;

    const setActive = (i) => {
      slides.forEach((s, n) => s.classList.toggle("active", n === i));
      dots.forEach((d, n) => d.classList.toggle("active", n === i));

      bar.style.transition = "none";
      bar.style.width = "0%";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.transition = `width ${intervalMs}ms linear`;
          bar.style.width = "100%";
        });
      });

      index = i;
    };

    const nextSlide = () => setActive((index + 1) % slides.length);
    const prevSlide = () => setActive((index - 1 + slides.length) % slides.length);

    const startTimer = () => {
      clearInterval(timer);
      timer = setInterval(nextSlide, intervalMs);
    };

    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => { setActive(i); startTimer(); });
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { nextSlide(); startTimer(); }
      if (e.key === "ArrowLeft")  { prevSlide(); startTimer(); }
    });

    let sx = 0, sy = 0;
    const thresh = 40;
    sliderEl.addEventListener("touchstart", (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, {passive:true});
    sliderEl.addEventListener("touchend", (e) => {
      if (!sx) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (Math.abs(dx) > thresh && dy < 60) {
        dx < 0 ? nextSlide() : prevSlide();
        startTimer();
      }
      sx = sy = 0;
    }, {passive:true});

    setActive(0);
    startTimer();
  })();

  // ------------------------------
  // Zip Code Modal → Contact
  // ------------------------------
  (function initZipModal() {
    const modal = document.getElementById("zipModal");
    const openBtn = document.getElementById("openZipModal");
    const submitBtn = document.getElementById("submitZip");
    const input = document.getElementById("zipInput");

    if (openBtn && modal && input) {
      openBtn.addEventListener("click", () => {
        modal.classList.remove("hidden");
        input.focus();
      });
    }

    if (submitBtn && input) {
      submitBtn.addEventListener("click", () => {
        const zip = input.value.trim();
        if (/^\d{5}(-\d{4})?$/.test(zip)) {
          const target = inPages ? "contact.html" : "pages/contact.html";
          window.location.href = `${target}?zip=${encodeURIComponent(zip)}`;
        } else {
          input.style.border = "2px solid red";
        }
      });
    }

    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  })();

  // ------------------------------
  // Index — Feature Gallery (Updated)
  // ------------------------------
  (function initIndexGallery() {
    // Wait until gallery exists in DOM
    const waitForGallery = setInterval(() => {
      const grid =
        document.getElementById("homeGallery") ||
        document.querySelector(".gallery-grid") ||
        document.querySelector(".gallery-section");

      if (!grid) return;

      clearInterval(waitForGallery);

      // Reveal-on-scroll
      const revealTiles = grid.querySelectorAll(".gallery-item.reveal, .tile-btn.reveal");
      if (revealTiles.length) {
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("is-in");
                io.unobserve(e.target);
              }
            });
          },
          { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
        );
        revealTiles.forEach((el) => io.observe(el));
      }

      // Lightbox elements
      const lightbox =
        document.getElementById("hgLightbox") ||
        document.getElementById("lightbox");
      const largeImg =
        document.getElementById("hgLarge") ||
        document.getElementById("lightbox-img");
      const closeBtn =
        document.getElementById("hgClose") ||
        document.querySelector(".lightbox-close");

      if (!(lightbox && largeImg)) return;

      // Open lightbox
      const open = (src) => {
        if (!src) return;
        largeImg.src = src;
        lightbox.hidden = false;
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      };

      // Close lightbox
      const close = () => {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        lightbox.hidden = true;
        largeImg.src = "";
        document.body.style.overflow = "";
      };

      // Image click closes lightbox too
      largeImg.addEventListener("click", close);

      grid.addEventListener("click", (e) => {
        const anchor = e.target.closest('a[href="#"]');
        if (anchor) { e.preventDefault(); return; }

        const tile = e.target.closest(".gallery-item, .tile-btn");
        if (!tile) return;

        const imgEl = tile.querySelector("img");
        const src =
          tile.getAttribute("data-full") ||
          (imgEl && (imgEl.currentSrc || imgEl.src));

        open(src);
      });

      closeBtn?.addEventListener("click", close);
      lightbox.addEventListener("click", (e) => {
        if (e.target.hasAttribute("data-close") || e.target === lightbox) close();
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !lightbox.hidden) close();
      });
    }, 50);
  })();
});

