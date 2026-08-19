let stores = [];
let activeStoreId = null;

const el = (id) => document.getElementById(id);

async function loadStores() {
  const res = await fetch('/api/stores');
  stores = await res.json();
  renderStoreList();
  if (activeStoreId) renderDetail();
}

function renderStoreList() {
  el('store-count').textContent = stores.length;
  const list = el('store-list');
  list.innerHTML = '';
  stores.forEach((s) => {
    const li = document.createElement('li');let stores = [];
let activeStoreId = null;

const el = (id) => document.getElementById(id);

async function loadStores() {
  const res = await fetch('/api/stores');
  stores = await res.json();
  updateStats();
  populateFilters();
  renderDirectory();
  if (activeStoreId) renderDetail();
}

function updateStats() {
  el('stat-stores').textContent = stores.length;
  const totalProducts = stores.reduce((sum, s) => sum + (s.latest?.productCount || 0), 0);
  el('stat-products').textContent = totalProducts;
}

function populateFilters() {
  const themes = new Set();
  const apps = new Set();
  stores.forEach((s) => {
    if (s.latest?.theme?.name) themes.add(s.latest.theme.name);
    (s.latest?.apps || []).forEach((a) => apps.add(a));
  });

  const themeSel = el('theme-filter');
  const currentTheme = themeSel.value;
  themeSel.innerHTML = '<option value="">All themes</option>' +
    Array.from(themes).sort().map((t) => `<option value="${t}">${t}</option>`).join('');
  themeSel.value = currentTheme;

  const appSel = el('app-filter');
  const currentApp = appSel.value;
  appSel.innerHTML = '<option value="">All apps</option>' +
    Array.from(apps).sort().map((a) => `<option value="${a}">${a}</option>`).join('');
  appSel.value = currentApp;
}

function getFilteredSortedStores() {
  const query = el('search-input').value.trim().toLowerCase();
  const themeFilter = el('theme-filter').value;
  const appFilter = el('app-filter').value;
  const sortBy = el('sort-select').value;

  let filtered = stores.filter((s) => {
    if (themeFilter && s.latest?.theme?.name !== themeFilter) return false;
    if (appFilter && !(s.latest?.apps || []).includes(appFilter)) return false;
    if (query) {
      const domainMatch = s.domain.toLowerCase().includes(query);
      const productMatch = (s.latest?.products || []).some((p) => (p.title || '').toLowerCase().includes(query));
      if (!domainMatch && !productMatch) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'products-desc') return (b.latest?.productCount || 0) - (a.latest?.productCount || 0);
    if (sortBy === 'products-asc') return (a.latest?.productCount || 0) - (b.latest?.productCount || 0);
    if (sortBy === 'domain') return a.domain.localeCompare(b.domain);
    // recent
    return new Date(b.lastScanAt || 0) - new Date(a.lastScanAt || 0);
  });

  return filtered;
}

function renderDirectory() {
  const grid = el('directory-grid');
  const filtered = getFilteredSortedStores();

  el('directory-empty').hidden = stores.length > 0;
  grid.hidden = stores.length === 0;

  grid.innerHTML = filtered.map((s) => {
    const snap = s.latest;
    const themeLabel = snap?.theme?.name || (snap ? 'unknown theme' : 'not scanned yet');
    const productCount = snap?.productCount ?? '—';
    const chips = (snap?.apps || []).slice(0, 3).map((a) => `<span class="chip">${a}</span>`).join('');
    return `
      <div class="store-card" data-id="${s.id}">
        <div class="store-card-top">
          <span class="status-dot ${s.status}"></span>
          <span class="store-card-domain">${s.domain}</span>
        </div>
        <div class="store-card-theme">${themeLabel}</div>
        <div class="store-card-stats"><span>${productCount} products</span><span>${s.lastScanAt ? new Date(s.lastScanAt).toLocaleDateString() : 'unscanned'}</span></div>
        <div class="store-card-chips">${chips}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.store-card').forEach((card) => {
    card.addEventListener('click', () => {
      activeStoreId = card.dataset.id;
      showDetail();
    });
  });
}

function showDetail() {
  el('directory-view').hidden = true;
  el('store-detail').hidden = false;
  renderDetail();
}

function showDirectory() {
  activeStoreId = null;
  el('store-detail').hidden = true;
  el('directory-view').hidden = false;
  renderDirectory();
}

function renderDetail() {
  const store = stores.find((s) => s.id === activeStoreId);
  if (!store) return;

  el('detail-domain').textContent = store.domain;
  const statusPill = el('detail-status');
  statusPill.textContent = store.status;
  statusPill.className = `status-pill status-${store.status}`;
  el('detail-last-scan').textContent = store.lastScanAt
    ? `last scanned ${new Date(store.lastScanAt).toLocaleString()}`
    : 'never scanned';

  const snap = store.latest;
  if (!snap) {
    el('theme-info').textContent = '—';
    el('apps-info').innerHTML = '—';
    el('catalog-summary').textContent = '—';
    el('product-table-body').innerHTML = '';
    el('diff-panel').hidden = true;
    return;
  }

  el('theme-info').innerHTML = `name: ${snap.theme?.name || 'unknown'}<br/>id: ${snap.theme?.id || '—'}`;
  el('apps-info').innerHTML = snap.apps?.length
    ? snap.apps.map((a) => `<span class="chip">${a}</span>`).join('')
    : '<span class="muted">none detected</span>';
  el('catalog-summary').innerHTML = `${snap.productCount} products found<br/>scanned ${new Date(snap.scannedAt).toLocaleString()}`;

  const body = el('product-table-body');
  body.innerHTML = (snap.products || []).slice(0, 100).map((p) => `
    <tr>
      <td>${p.title || ''}</td>
      <td>${p.productType || ''}</td>
      <td>${p.price ? '$' + p.price : '—'}</td>
      <td>${p.available === null ? '—' : (p.available ? 'yes' : 'no')}</td>
    </tr>
  `).join('');
}

function renderDiff(diff) {
  const panel = el('diff-panel');
  const content = el('diff-content');
  if (diff.isFirstScan) {
    panel.hidden = true;
    return;
  }
  if (!diff.newProducts.length && !diff.priceChanges.length && !diff.removedProducts.length) {
    panel.hidden = false;
    content.innerHTML = '<div class="muted mono-block">No changes since last scan.</div>';
    return;
  }
  panel.hidden = false;
  const rows = [
    ...diff.newProducts.map((p) => `<div class="diff-row diff-new">+ new: ${p.title}</div>`),
    ...diff.priceChanges.map((p) => `<div class="diff-row diff-price">~ price: ${p.title} — $${p.from} → $${p.to}</div>`),
    ...diff.removedProducts.map((p) => `<div class="diff-row diff-removed">− removed: ${p.title}</div>`),
  ];
  content.innerHTML = rows.join('');
}

// ---- Modal ----
el('open-add-store').addEventListener('click', () => {
  el('add-store-modal').hidden = false;
  el('domain-input').focus();
});
el('cancel-add-store').addEventListener('click', () => {
  el('add-store-modal').hidden = true;
});
el('add-store-modal').addEventListener('click', (e) => {
  if (e.target.id === 'add-store-modal') el('add-store-modal').hidden = true;
});

el('add-store-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = el('domain-input');
  const domain = input.value.trim();
  if (!domain) return;
  const res = await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (res.ok) {
    const store = await res.json();
    input.value = '';
    el('add-store-modal').hidden = true;
    await loadStores();
    activeStoreId = store.id;
    showDetail();
    // auto-trigger first scan
    el('scan-btn').click();
  } else {
    const err = await res.json();
    alert(err.error || 'Could not add store');
  }
});

// ---- Detail view actions ----
el('back-to-directory').addEventListener('click', showDirectory);

el('scan-btn').addEventListener('click', async () => {
  if (!activeStoreId) return;
  const btn = el('scan-btn');
  btn.disabled = true;
  el('scan-progress').hidden = false;

  try {
    const res = await fetch(`/api/stores/${activeStoreId}/scan`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Scan failed');
    } else {
      await loadStores();
      renderDetail();
      renderDiff(data.diff);
    }
  } finally {
    btn.disabled = false;
    el('scan-progress').hidden = true;
  }
});

// ---- Directory controls ----
el('search-input').addEventListener('input', renderDirectory);
el('theme-filter').addEventListener('change', renderDirectory);
el('app-filter').addEventListener('change', renderDirectory);
el('sort-select').addEventListener('change', renderDirectory);

loadStores();
    li.className = 'store-item' + (s.id === activeStoreId ? ' active' : '');
    li.innerHTML = `<span class="status-dot ${s.status}"></span><span class="domain">${s.domain}</span>`;
    li.onclick = () => { activeStoreId = s.id; renderStoreList(); renderDetail(); };
    list.appendChild(li);
  });
}

function renderDetail() {
  const store = stores.find((s) => s.id === activeStoreId);
  if (!store) return;

  el('empty-state').hidden = true;
  el('store-detail').hidden = false;

  el('detail-domain').textContent = store.domain;
  const statusPill = el('detail-status');
  statusPill.textContent = store.status;
  statusPill.className = `status-pill status-${store.status}`;
  el('detail-last-scan').textContent = store.lastScanAt
    ? `last scanned ${new Date(store.lastScanAt).toLocaleString()}`
    : 'never scanned';

  const snap = store.latest;
  if (!snap) {
    el('theme-info').textContent = '—';
    el('apps-info').innerHTML = '—';
    el('catalog-summary').textContent = '—';
    el('product-table-body').innerHTML = '';
    el('diff-panel').hidden = true;
    return;
  }

  el('theme-info').innerHTML = `name: ${snap.theme?.name || 'unknown'}<br/>id: ${snap.theme?.id || '—'}`;
  el('apps-info').innerHTML = snap.apps?.length
    ? snap.apps.map((a) => `<span class="chip">${a}</span>`).join('')
    : '<span class="muted">none detected</span>';
  el('catalog-summary').innerHTML = `${snap.productCount} products found<br/>scanned ${new Date(snap.scannedAt).toLocaleString()}`;

  const body = el('product-table-body');
  body.innerHTML = (snap.products || []).slice(0, 100).map((p) => `
    <tr>
      <td>${p.title || ''}</td>
      <td>${p.productType || ''}</td>
      <td>${p.price ? '$' + p.price : '—'}</td>
      <td>${p.available === null ? '—' : (p.available ? 'yes' : 'no')}</td>
    </tr>
  `).join('');
}

function renderDiff(diff) {
  const panel = el('diff-panel');
  const content = el('diff-content');
  if (diff.isFirstScan) {
    panel.hidden = true;
    return;
  }
  if (!diff.newProducts.length && !diff.priceChanges.length && !diff.removedProducts.length) {
    panel.hidden = false;
    content.innerHTML = '<div class="muted mono-block">No changes since last scan.</div>';
    return;
  }
  panel.hidden = false;
  const rows = [
    ...diff.newProducts.map((p) => `<div class="diff-row diff-new">+ new: ${p.title}</div>`),
    ...diff.priceChanges.map((p) => `<div class="diff-row diff-price">~ price: ${p.title} — $${p.from} → $${p.to}</div>`),
    ...diff.removedProducts.map((p) => `<div class="diff-row diff-removed">− removed: ${p.title}</div>`),
  ];
  content.innerHTML = rows.join('');
}

el('add-store-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = el('domain-input');
  const domain = input.value.trim();
  if (!domain) return;
  const res = await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  if (res.ok) {
    const store = await res.json();
    input.value = '';
    await loadStores();
    activeStoreId = store.id;
    renderStoreList();
    renderDetail();
  } else {
    const err = await res.json();
    alert(err.error || 'Could not add store');
  }
});

el('scan-btn').addEventListener('click', async () => {
  if (!activeStoreId) return;
  const btn = el('scan-btn');
  btn.disabled = true;
  el('scan-progress').hidden = false;

  try {
    const res = await fetch(`/api/stores/${activeStoreId}/scan`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Scan failed');
    } else {
      await loadStores();
      renderDetail();
      renderDiff(data.diff);
    }
  } finally {
    btn.disabled = false;
    el('scan-progress').hidden = true;
  }
});

loadStores();
