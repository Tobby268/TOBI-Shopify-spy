const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

// Shape of the database:
// {
//   stores: [{ id, domain, label, addedAt, lastScanAt, status }],
//   snapshots: [{ id, storeId, scannedAt, theme, apps, productCount, products: [...] }],
//   productHistory: [{ storeId, productId, title, priceHistory: [{ price, seenAt }] }]
// }
db.defaults({ stores: [], snapshots: [], productHistory: [] }).write();

module.exports = db;
