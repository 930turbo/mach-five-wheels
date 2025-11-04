/* /js/contact.js
   Luxe contact form behavior (idempotent)
   - Searchable selects (Country, State, Year, Brand)
   - Required-field enforcement (photos optional)
   - Email confirm validation
   - US-only State gating
   - Drag & drop photo upload with previews
*/

/* ---------- Global guard: prevent double init ---------- */
if (!window.__contactInit) {
  window.__contactInit = true;

  (function () {
    /* ---------- Utilities ---------- */
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const byId = (id) => document.getElementById(id);
    const el = (tag, cls) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      return n;
    };

    /* ---------- Floating label helper ---------- */
    function bindFloatingLabels() {
      $$('.field input, .field textarea').forEach((i) => {
        const toggle = () => i.classList.toggle('has-value', !!i.value.trim());
        i.addEventListener('input', toggle);
        toggle();
      });
    }

    /* ---------- Email confirm validation ---------- */
    function bindEmailConfirm() {
      const email = byId('email');
      const confirm = byId('email-confirm');
      const note = byId('email-note');
      if (!email || !confirm) return;

      const check = () => {
        const a = (email.value || '').trim().toLowerCase();
        const b = (confirm.value || '').trim().toLowerCase();
        if (confirm.value && a !== b) {
          confirm.classList.add('is-invalid');
          if (note) note.textContent = 'Email addresses do not match.';
        } else {
          confirm.classList.remove('is-invalid');
          if (note) note.textContent = '';
        }
      };

      email.addEventListener('input', check);
      confirm.addEventListener('input', check);
    }

    /* ---------- SearchableSelect (vanilla) ---------- */
    class SearchableSelect {
      constructor(root, { name, placeholder, data = [], onChange } = {}) {
        if (!root) return;
        // Per-root guard (idempotent)
        if (root.dataset.ssInit === '1' || root.querySelector('.ss-control')) return;
        root.dataset.ssInit = '1';

        this.root = root;
        this.name = name;
        this.placeholder = placeholder || 'Select...';
        this.data = data;
        this.onChange = onChange;

        this.value = '';
        this.text = '';

        this.hidden = el('input');
        this.hidden.type = 'hidden';
        this.hidden.name = name;

        this.control = el('div', 'ss-control');
        this.input = el('input', 'ss-input');
        this.input.type = 'text';
        this.input.autocomplete = 'off';
        this.input.placeholder = this.placeholder;
        this.caret = el('span', 'ss-caret');
        this.caret.textContent = '▾';

        this.menu = el('div', 'ss-menu');

        this.control.append(this.input, this.caret);
        this.root.append(this.hidden, this.control, this.menu);

        this.renderMenu(this.data, '');

        // Events
        this.control.addEventListener('click', () => this.open());
        this.input.addEventListener('input', () => this.filter(this.input.value));
        this.input.addEventListener('keydown', (e) => this.keyNav(e));
        document.addEventListener('click', (e) => {
          if (!this.root.contains(e.target)) this.close();
        });
      }

      open() {
        this.menu.classList.add('open');
        this.input.focus();
        this.filter(this.input.value);
      }
      close() {
        this.menu.classList.remove('open');
      }
      keyNav(e) {
        const opts = $$('.ss-option', this.menu);
        const current = opts.findIndex((o) => o.getAttribute('aria-selected') === 'true');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = opts[Math.min(current + 1, opts.length - 1)] || opts[0];
          this.selectVisual(next, opts);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = opts[Math.max(current - 1, 0)] || opts[opts.length - 1];
          this.selectVisual(prev, opts);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const item = current >= 0 ? opts[current] : null;
          if (item) item.click();
        } else if (e.key === 'Escape') {
          this.close();
        }
      }
      selectVisual(elm, all) {
        all.forEach((o) => o.setAttribute('aria-selected', 'false'));
        if (elm) {
          elm.setAttribute('aria-selected', 'true');
          elm.scrollIntoView({ block: 'nearest' });
        }
      }
      filter(q) {
        const query = (q || '').toLowerCase().trim();
        this.renderMenu(this.data, query);
      }
      setValue(val, label) {
        this.value = val;
        this.text = label ?? val;
        this.hidden.value = val;

        // Show selection in the input display
        this.input.value = this.text;
        try { this.input.setSelectionRange(this.text.length, this.text.length); } catch (_) {}
        if (typeof this.onChange === 'function') this.onChange(val, label);
        this.close();

        // Clear invalid state if it was marked
        this.control.classList.remove('is-invalid');
      }
      renderMenu(data, query) {
        this.menu.innerHTML = '';
        let count = 0;
        const matches = (s) => s.toLowerCase().includes(query);
        const makeOption = (label, value = label) => {
          const opt = el('div', 'ss-option');
          opt.textContent = label;
          opt.setAttribute('role', 'option');
          opt.setAttribute('aria-selected', 'false');
          opt.addEventListener('click', () => this.setValue(value, label));
          return opt;
        };
        const pushGroup = (title, items) => {
          const g = el('div', 'ss-group');
          const h = el('h5'); h.textContent = title;
          g.appendChild(h);
          items.forEach((lbl) => g.appendChild(makeOption(lbl)));
          this.menu.appendChild(g);
        };

        if (Array.isArray(data) && typeof data[0] === 'string') {
          const items = data.filter((lbl) => matches(lbl));
          if (items.length) {
            const g = el('div', 'ss-group');
            items.forEach((lbl) => { g.appendChild(makeOption(lbl)); count++; });
            this.menu.appendChild(g);
          }
        } else {
          data.forEach((grp) => {
            const items = grp.items.filter((lbl) => matches(lbl) || (query && grp.group.toLowerCase().includes(query)));
            if (items.length) { pushGroup(grp.group, items); count += items.length; }
          });
        }

        if (!count) {
          const empty = el('div', 'ss-empty');
          empty.textContent = 'No matches';
          this.menu.appendChild(empty);
        }
      }
    }

    /* ---------- Parse embedded JSON data ---------- */
    const parseJSON = (id) => {
      try { return JSON.parse(byId(id)?.textContent || '[]'); }
      catch { return []; }
    };
    const countries = parseJSON('countries-data');
    const states    = parseJSON('states-data');
    const years     = parseJSON('years-data');
    const brands    = parseJSON('brands-data');

    /* ---------- Country → State gating ---------- */
    const onCountryChange = (val) => {
      const wrap = byId('stateSelect');
      const isUS = (val === 'United States');
      if (!wrap) return;
      wrap.classList.toggle('is-disabled', !isUS);
      // Clear value visually/logically when disabled
      if (!isUS) {
        const hid = wrap.querySelector('input[type="hidden"]');
        if (hid) hid.value = '';
        const input = wrap.querySelector('.ss-input');
        if (input) input.value = '';
        const control = wrap.querySelector('.ss-control');
        control?.classList.remove('is-invalid');
      }
    };

    /* ---------- Safe initializer for selects ---------- */
    const safeInit = (root, opts) => {
      if (!root || root.dataset.ssInit === '1' || root.querySelector('.ss-control')) return null;
      return new SearchableSelect(root, opts);
    };

    /* ---------- Build selects ---------- */
    const countrySel = safeInit(byId('countrySelect'), {
      name: 'country', placeholder: 'Country', data: countries, onChange: onCountryChange
    });
    const stateSel = safeInit(byId('stateSelect'), {
      name: 'state', placeholder: 'State (US)', data: states
    });
    const yearSel = safeInit(byId('yearSelect'), {
      name: 'vehicle_year', placeholder: 'Vehicle Year', data: years
    });
    const brandSel = safeInit(byId('brandSelect'), {
      name: 'vehicle_make', placeholder: 'Vehicle Make', data: brands
    });

    // Initialize state disabled until country is set
    onCountryChange('');

    /* ---------- Strict required validation (photos optional) ---------- */
    const REQUIRED_TEXT_IDS = [
      'first-name', 'last-name', 'email', 'email-confirm',
      'phone', 'city', 'vehicle-model', 'comments'
    ];
    const form = $('.contact-form');

    function hiddenByName(name) {
      return form?.querySelector(`input[type="hidden"][name="${name}"]`);
    }
    function markSelectInvalid(wrapId, invalid) {
      const wrap = byId(wrapId);
      const ctl = wrap?.querySelector('.ss-control');
      if (ctl) ctl.classList.toggle('is-invalid', !!invalid);
    }

    function enforceRequired(e) {
      if (!form) return;
      let ok = true;

      // Native text/textarea
      REQUIRED_TEXT_IDS.forEach((id) => {
        const ctrl = byId(id);
        if (!ctrl || !ctrl.value.trim()) {
          ok = false;
          ctrl?.classList.add('is-invalid');
        } else {
          ctrl.classList.remove('is-invalid');
        }
      });

      // Email confirm match
      const email = byId('email');
      const confirm = byId('email-confirm');
      const note = byId('email-note');
      if (email && confirm && email.value.trim().toLowerCase() !== confirm.value.trim().toLowerCase()) {
        ok = false;
        confirm.classList.add('is-invalid');
        if (note) note.textContent = 'Email addresses do not match.';
      }

      // Custom selects (hidden inputs)
      const countryVal = hiddenByName('country')?.value || '';
      const yearVal    = hiddenByName('vehicle_year')?.value || '';
      const makeVal    = hiddenByName('vehicle_make')?.value || '';

      if (!countryVal) { ok = false; markSelectInvalid('countrySelect', true); } else { markSelectInvalid('countrySelect', false); }
      if (!yearVal)    { ok = false; markSelectInvalid('yearSelect', true); }    else { markSelectInvalid('yearSelect', false); }
      if (!makeVal)    { ok = false; markSelectInvalid('brandSelect', true); }   else { markSelectInvalid('brandSelect', false); }

      // State if US
      const isUS = countryVal === 'United States';
      const stateVal = hiddenByName('state')?.value || '';
      if (isUS) {
        if (!stateVal) { ok = false; markSelectInvalid('stateSelect', true); } else { markSelectInvalid('stateSelect', false); }
      } else {
        markSelectInvalid('stateSelect', false);
      }

      if (!ok) {
        e.preventDefault();
        const firstInvalid = form.querySelector('.is-invalid, :invalid');
        firstInvalid?.focus();
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        // Honeypot
        const hp = form.querySelector('input.hp');
        if (hp && hp.value) { e.preventDefault(); return; }
        enforceRequired(e);
      });
    }

    /* ---------- Photo Upload (optional) ---------- */
    (function photosInit() {
      const dz = byId('dropzone');
      const input = byId('photos');
      const preview = byId('preview');
      const trigger = dz?.querySelector('.dz-trigger');
      if (!dz || !input || !preview) return;
      if (dz.dataset.init === '1') return; // idempotent
      dz.dataset.init = '1';

      const MAX_FILES = 8;
      const MAX_MB = 10;
      const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      const files = [];

      const syncInput = () => {
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        input.files = dt.files;
      };

      const render = () => {
        preview.innerHTML = '';
        files.forEach((file, idx) => {
          const url = URL.createObjectURL(file);
          const card = el('div', 'thumb');
          card.innerHTML = `
            <img src="${url}" alt="Attachment ${idx + 1}" />
            <button class="remove" aria-label="Remove photo">&times;</button>
          `;
          $('.remove', card).addEventListener('click', () => {
            files.splice(idx, 1);
            syncInput();
            render();
            URL.revokeObjectURL(url);
          });
          preview.appendChild(card);
        });
      };

      const accept = (list) => {
        for (const f of list) {
          if (files.length >= MAX_FILES) break;
          const tooBig = f.size > MAX_MB * 1024 * 1024;
          const badType = !ACCEPTED.includes(f.type);
          if (!tooBig && !badType) files.push(f);
        }
        syncInput();
        render();
      };

      // Drag over
      ['dragenter', 'dragover'].forEach(evt => dz.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover');
      }));
      ['dragleave', 'drop'].forEach(evt => dz.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover');
      }));
      dz.addEventListener('drop', e => {
        const items = e.dataTransfer?.files;
        if (items && items.length) accept(items);
      });

      // Click/keyboard to open picker
      trigger?.addEventListener('click', () => input.click());
      dz.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });

      // From picker
      input.addEventListener('change', () => accept(input.files || []));
    })();

    /* ---------- Init basics ---------- */
    bindFloatingLabels();
    bindEmailConfirm();
  })();
}
