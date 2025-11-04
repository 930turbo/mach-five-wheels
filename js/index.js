// =====================================================
// Mach Five Wheels — Main JS (Index)
// Header/Footer, Hero Slider, Zip Modal, Feature Gallery
// + Hard-forced header breakpoint control (inline !important)
// =====================================================

"use strict";

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
  window.addEventListener("load", toTop);
  window.addEventListener("pageshow", () => { toTop(); });

  // ------------------------------
  // Inject Header & Footer
  // ------------------------------
  const headerPromise = fetch(`${base}partials/header.html`)
    .then(r => r.text())
    .then(html => {
      const headerMount = document.getElementById("header");
      if (!headerMount) return;
      headerMount.innerHTML = html;

      // Home-only button under logo
      const isHome = location.pathname === "/" || location.pathname.endsWith("/index.html");
      if (isHome) {
        const logoDiv = document.querySelector(".logo");
        if (logoDiv && !logoDiv.querySelector(".main-site-btn")) {
          const wrap = document.createElement("div");
          wrap.className = "header-link-wrapper";
          wrap.innerHTML = `
            <a href="https://machfivemotors.com" class="main-site-btn" target="_blank" rel="noopener">
              Explore Mach Five
            </a>`;
          logoDiv.appendChild(wrap);
        }
      }

      // ====== Mobile Drawer ======
      const burger = document.querySelector(".hamburger");
      const menu   = document.getElementById("mobileMenu");
      const list   = menu?.querySelector(".mobile-menu__list");
      const close  = menu?.querySelector(".mobile-menu__close");

      if (burger && menu && list) {
        // Build drawer links from current header navs
        const left  = Array.from(document.querySelectorAll(".nav-left a"));
        const right = Array.from(document.querySelectorAll(".nav-right a"));
        const all   = [...left, ...right];
        list.innerHTML = all.map(a => {
          const href = a.getAttribute("href") || "#";
          const text = (a.textContent || href).trim();
          return `<li><a href="${href}">${text}</a></li>`;
        }).join("");

        const openMenu = () => {
          // Show + animate in
          menu.hidden = false;
          requestAnimationFrame(() => {
            menu.classList.add("open");
            burger.setAttribute("aria-expanded", "true");
            document.body.classList.add("menu-open");
          });
        };
        const closeMenu = () => {
          menu.classList.remove("open");
          burger.setAttribute("aria-expanded", "false");
          document.body.classList.remove("menu-open");
          setTimeout(() => { menu.hidden = true; }, 280);
        };

        burger.addEventListener("click", () => {
          const expanded = burger.getAttribute("aria-expanded") === "true";
          expanded ? closeMenu() : openMenu();
        });
        close?.addEventListener("click", closeMenu);
        menu.addEventListener("click", (e) => {
          if (e.target === menu || e.target.hasAttribute("data-close")) closeMenu();
        });
        window.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && !menu.hidden) closeMenu();
        });
        list.addEventListener("click", (e) => {
          const a = e.target.closest("a");
          if (a) closeMenu();
        });

        // ====== HARD BREAKPOINT ENFORCER (inline !important) ======
        const navLeft  = document.querySelector(".nav-left");
        const navRight = document.querySelector(".nav-right");

        const forceShow = (el, disp = "flex") => el?.style.setProperty("display", disp, "important");
        const forceHide = (el) => el?.style.setProperty("display", "none", "important");

        const applyHeaderBreakpoint = () => {
          const isMobile = window.matchMedia("(max-width: 900px)").matches;

          if (isMobile) {
            // Mobile: burger visible, wide navs hidden
            forceShow(burger, "inline-flex");
            forceHide(navLeft);
            forceHide(navRight);
          } else {
            // Desktop: burger hidden, wide navs visible, drawer closed
            forceHide(burger);
            forceShow(navLeft, "flex");
            forceShow(navRight, "flex");
            // Close drawer if it was open
            burger.setAttribute("aria-expanded", "false");
            document.body.classList.remove("menu-open");
            menu.classList.remove("open");
            menu.hidden = true;
          }
        };

        // Run now and keep synced
        applyHeaderBreakpoint();
        window.addEventListener("resize", applyHeaderBreakpoint);
        window.addEventListener("orientationchange", applyHeaderBreakpoint);

        // Fallback: also re-apply after fonts/layout settle
        setTimeout(applyHeaderBreakpoint, 0);
        setTimeout(applyHeaderBreakpoint, 150);
        setTimeout(applyHeaderBreakpoint, 600);
      }
    })
    .catch(() => {});

  const footerPromise = fetch(`${base}partials/footer.html`)
    .then(r => r.text())
    .then(html => {
      const footerMount = document.getElementById("footer");
      if (!footerMount) return;
      footerMount.innerHTML = html;
    })
    .catch(() => {});

  Promise.allSettled([headerPromise, footerPromise]).then(() => {
    requestAnimationFrame(() => toTop());
  });

  // ------------------------------
  // Hero Slider (dots + progress + swipe + keyboard)
  // ------------------------------
  (function initHeroSlider() {
    const sliderEl = document.querySelector(".hero-slider");
    if (!sliderEl) return;

    const slides = Array.from(sliderEl.querySelectorAll(".slide"));
    const dots   = Array.from(sliderEl.querySelectorAll(".dot"));
    const bar    = sliderEl.querySelector(".slider-progress .bar");
    if (!slides.length || !dots.length || !bar) return;

    let index = 0;
    const intervalMs = 4000;
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
  // Index — Feature Gallery / Lightbox
  // ------------------------------
  (function initIndexGallery() {
    const wait = setInterval(() => {
      const grid =
        document.getElementById("homeGallery") ||
        document.querySelector(".gallery-grid") ||
        document.querySelector(".gallery-section");
      if (!grid) return;

      clearInterval(wait);

      // Reveal-on-scroll
      const reveal = grid.querySelectorAll(".gallery-item.reveal, .tile-btn.reveal");
      if (reveal.length) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              io.unobserve(e.target);
            }
          });
        }, { rootMargin: "0px 0px -10% 0px", threshold: 0.15 });
        reveal.forEach(el => io.observe(el));
      }

      // Lightbox
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

      const open = (src) => {
        if (!src) return;
        largeImg.src = src;
        lightbox.hidden = false;
        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      };
      const close = () => {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        lightbox.hidden = true;
        largeImg.src = "";
        document.body.style.overflow = "";
      };

      largeImg.addEventListener("click", close);
      grid.addEventListener("click", (e) => {
        const anchor = e.target.closest('a[href="#"]');
        if (anchor) { e.preventDefault(); return; }
        const tile = e.target.closest(".gallery-item, .tile-btn");
        if (!tile) return;
        const imgEl = tile.querySelector("img");
        const src = tile.getAttribute("data-full") || (imgEl && (imgEl.currentSrc || imgEl.src));
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


// Mobile drawer controls
const menuBtn = document.getElementById('menuToggle');
const drawer  = document.getElementById('mobileMenu');
const backdrop = drawer ? drawer.querySelector('.mobile-menu__backdrop') : null;
const links = drawer ? drawer.querySelectorAll('.mobile-menu__list a') : [];

function openMenu(){
  if(!drawer) return;
  drawer.hidden = false;
  requestAnimationFrame(() => drawer.classList.add('open'));
  menuBtn?.setAttribute('aria-expanded','true');
  document.body.classList.add('menu-open');
}

function closeMenu(){
  if(!drawer) return;
  drawer.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded','false');
  document.body.classList.remove('menu-open');
  setTimeout(() => { drawer.hidden = true; }, 280);
}

menuBtn?.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') === 'true';
  open ? closeMenu() : openMenu();
});

backdrop?.addEventListener('click', closeMenu);

// close the drawer when a nav link is tapped
links.forEach(a => a.addEventListener('click', closeMenu));

// ESC closes
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && drawer && !drawer.hidden) closeMenu();
});
