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
    const li = document.createElement('li');
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
