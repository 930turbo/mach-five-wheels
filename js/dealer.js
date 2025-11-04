// ----- CONFIG: Dealer list -----
const dealers = [
  {
    name: "Luxury Details",
    address: "Southborough, MA",
    zip: "01772",
    lat: 42.29116,
    lon: -71.53891,
    phone: "(508) 620 7321",
    website: "https://www.luxurydetails.net/"
  },
  // Add more dealers...
];

// ----- Helpers -----
async function getCoordsFromZip(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error("Invalid ZIP code");
  const data = await res.json();
  const { latitude, longitude } = data.places[0];
  return { lat: parseFloat(latitude), lon: parseFloat(longitude) };
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ----- State -----
let dealerMap;
let searchCircle = null;
let markers = [];
let lastFocus = null;

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const resultsWrap = document.getElementById("dealerResults");
  const zipForm = document.getElementById("zipForm");
  const zipInput = document.getElementById("zipInput");
  const searchBtn = zipForm.querySelector('button[type="submit"]');
  const indicator = document.getElementById("scrollIndicator");
  const dealerFormOverlay = document.getElementById("dealerFormOverlay");
  const closeForm = document.getElementById("closeForm");
  const dealerFormBtn = document.getElementById("dealerFormBtn");
  const dealerFormBtnStrip = document.getElementById("dealerFormBtnStrip");
  const submissionPopup = document.getElementById("submissionPopup");
  const closePopup = document.getElementById("closePopup");

  // Map
  dealerMap = L.map("dealerMap", {
    center: [39.8283, -98.5795],
    zoom: 3,
    scrollWheelZoom: false,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(dealerMap);

  // Markers
  markers = dealers.map((d) => {
    const m = L.marker([d.lat, d.lon]).addTo(dealerMap);
    m.bindPopup(`
      <strong>${d.name}</strong><br/>
      ${d.address}<br/>
      ZIP: ${d.zip}<br/>
      Phone: <a href="tel:${d.phone.replace(/\D/g, "")}">${d.phone}</a><br/>
      <a href="${d.website}" target="_blank" rel="noopener noreferrer">Visit website</a>
    `);
    return m;
  });

  // ZIP form
  zipForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const zip = zipInput.value.trim();

    // basic validation
    if (!/^\d{5}$/.test(zip)) {
      resultsWrap.innerHTML = `<div class="placeholder"><p>Please enter a valid 5-digit ZIP code.</p></div>`;
      return;
    }

    resultsWrap.setAttribute("aria-busy", "true");
    searchBtn.disabled = true;
    resultsWrap.innerHTML = `<div class="placeholder"><p>Searching…</p></div>`;

    try {
      const user = await getCoordsFromZip(zip);

      // remove old circle
      if (searchCircle) dealerMap.removeLayer(searchCircle);

      // draw 100 mi radius
      searchCircle = L.circle([user.lat, user.lon], {
        radius: 160934,
        color: "#555",
        fillColor: "#333",
        fillOpacity: 0.22,
        weight: 1,
      }).addTo(dealerMap);

      dealerMap.fitBounds(searchCircle.getBounds(), { padding: [40, 40] });

      // compute distances
      const found = dealers
        .map((d) => ({
          ...d,
          distance: getDistance(user.lat, user.lon, d.lat, d.lon),
        }))
        .filter((d) => d.distance <= 100)
        .sort((a, b) => a.distance - b.distance);

      if (!found.length) {
        resultsWrap.innerHTML = `<div class="placeholder"><p>No dealers found within 100 miles.</p></div>`;
      } else {
        resultsWrap.innerHTML = found
          .map(
            (d) => `
            <article class="dealer-card" tabindex="0">
              <h3>${d.name}</h3>
              <p>${d.address} • ${d.zip}</p>
              <p class="distance">${d.distance.toFixed(1)} miles away</p>
              <p>Phone: <a href="tel:${d.phone.replace(/\D/g, "")}">${d.phone}</a></p>
              <div class="actions">
                <a href="${d.website}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Visit Website</a>
              </div>
            </article>`
          )
          .join("");

        // focus first card for keyboard users
        const first = resultsWrap.querySelector(".dealer-card");
        if (first) first.focus();
      }
    } catch (err) {
      resultsWrap.innerHTML = `<div class="placeholder"><p>Error: ${err.message}</p></div>`;
    } finally {
      resultsWrap.setAttribute("aria-busy", "false");
      searchBtn.disabled = false;
    }
  });

  // Scroll indicator hide on approach to grid
  window.addEventListener("scroll", () => {
    const grid = document.querySelector(".dealer-grid");
    if (!indicator || !grid) return;
    const scrollPos = window.scrollY + window.innerHeight;
    const offsetTop = grid.offsetTop;
    indicator.style.display = scrollPos > offsetTop - 120 ? "none" : "block";
  });

  // Modal (open)
  function openDealerModal(trigger) {
    lastFocus = trigger || document.activeElement;
    dealerFormOverlay.classList.remove("hidden");
    dealerFormOverlay.setAttribute("aria-hidden", "false");
    const firstInput = document.getElementById("business");
    if (firstInput) firstInput.focus();
  }
  dealerFormBtn?.addEventListener("click", (e) => openDealerModal(e.currentTarget));
  dealerFormBtnStrip?.addEventListener("click", (e) => openDealerModal(e.currentTarget));

  // Modal (close)
  function closeDealerModal() {
    dealerFormOverlay.classList.add("hidden");
    dealerFormOverlay.setAttribute("aria-hidden", "true");
    if (lastFocus) lastFocus.focus();
  }
  document.getElementById("closeForm")?.addEventListener("click", closeDealerModal);
  dealerFormOverlay?.addEventListener("click", (e) => {
    if (e.target === dealerFormOverlay) closeDealerModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dealerFormOverlay.classList.contains("hidden")) closeDealerModal();
  });

  // Submission popup close
  closePopup?.addEventListener("click", () => submissionPopup.classList.add("hidden"));

// ===== Dealer Application: outline missing fields in red on submit =====
const dealerAppForm = document.querySelector('#dealerFormOverlay .dealer-form');
if (dealerAppForm) {
  const submitBtn = dealerAppForm.querySelector('button[type="submit"]');

  // Mark inputs/selects/textarea as required unless explicitly optional
  const fields = Array.from(
    dealerAppForm.querySelectorAll(
      'input:not(.hp):not([type="hidden"]):not([data-optional]), textarea:not([data-optional]), select:not([data-optional])'
    )
  );
  fields.forEach(el => {
    if (!el.hasAttribute('required')) el.setAttribute('required', '');
    el.classList.remove('field-error');
  });

  // On submit: highlight empty/invalid fields
  dealerAppForm.addEventListener('submit', (e) => {
    let hasError = false;

    fields.forEach(el => {
      if (!el.value.trim()) {
        el.classList.add('field-error');
        hasError = true;
      } else {
        el.classList.remove('field-error');
      }
    });

    if (hasError) {
      e.preventDefault(); // Stop submission if errors
      // Scroll to first missing field
      const firstInvalid = dealerAppForm.querySelector('.field-error');
      if (firstInvalid) {
        firstInvalid.focus({ preventScroll: false });
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // Remove red outline live when user fixes input
  dealerAppForm.addEventListener('input', (e) => {
    if (e.target.classList.contains('field-error') && e.target.value.trim()) {
      e.target.classList.remove('field-error');
    }
  });

  if (submitBtn) submitBtn.disabled = false;
}

});
