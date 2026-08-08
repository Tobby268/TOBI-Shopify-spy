const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, '..', 'data', 'db.json'));
const db = low(adapter);

// Shape of the database:
// {
//   stores: [{ id, domain, label, addedAt, lastScanAt, status }],
//   snapshots: [{ id, storeId, scannedAt, theme, apps, productCount, products: [...] }],
//   productHistory: [{ storeId, productId, title, priceHistory: [{ price, seenAt }] }]
// }
db.defaults({ stores: [], snapshots: [], productHistory: [] }).write();

module.exports = db;
