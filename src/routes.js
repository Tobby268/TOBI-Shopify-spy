const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { scanStore, diffSnapshots, normalizeDomain } = require('./scraper');

const router = express.Router();

// List all tracked stores with their latest snapshot summary
router.get('/stores', (req, res) => {
  const stores = db.get('stores').value();
  const withLatest = stores.map((s) => {
    const snapshots = db.get('snapshots').filter({ storeId: s.id }).sortBy('scannedAt').value();
    const latest = snapshots[snapshots.length - 1] || null;
    return { ...s, latest };
  });
  res.json(withLatest);
});

// Add a store to the watchlist (does not scan yet)
router.post('/stores', (req, res) => {
  const { domain, label } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });
  const normalized = normalizeDomain(domain);

  const existing = db.get('stores').find({ domain: normalized }).value();
  if (existing) return res.status(409).json({ error: 'That store is already tracked', store: existing });

  const store = {
    id: uuidv4(),
    domain: normalized,
    label: label || normalized,
    addedAt: new Date().toISOString(),
    lastScanAt: null,
    status: 'unscanned',
  };
  db.get('stores').push(store).write();
  res.status(201).json(store);
});

router.delete('/stores/:id', (req, res) => {
  db.get('stores').remove({ id: req.params.id }).write();
  db.get('snapshots').remove({ storeId: req.params.id }).write();
  res.status(204).end();
});

// Trigger a fresh scan of one store; returns the new snapshot + diff vs previous
router.post('/stores/:id/scan', async (req, res) => {
  const store = db.get('stores').find({ id: req.params.id }).value();
  if (!store) return res.status(404).json({ error: 'store not found' });

  const result = await scanStore(store.domain);
  if (result.error) {
    db.get('stores').find({ id: store.id }).assign({ status: 'error', lastScanAt: new Date().toISOString() }).write();
    return res.status(422).json({ error: result.error });
  }

  const prevSnapshots = db.get('snapshots').filter({ storeId: store.id }).sortBy('scannedAt').value();
  const prevSnapshot = prevSnapshots[prevSnapshots.length - 1] || null;
  const diff = diffSnapshots(prevSnapshot, result);

  const snapshot = { id: uuidv4(), storeId: store.id, ...result };
  db.get('snapshots').push(snapshot).write();
  db.get('stores').find({ id: store.id }).assign({
    status: 'ok',
    lastScanAt: snapshot.scannedAt,
  }).write();

  res.json({ snapshot, diff });
});

// Full snapshot history for one store
router.get('/stores/:id/history', (req, res) => {
  const snapshots = db.get('snapshots').filter({ storeId: req.params.id }).sortBy('scannedAt').value();
  res.json(snapshots);
});

module.exports = router;
