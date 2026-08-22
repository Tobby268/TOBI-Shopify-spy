const fetch = require('node-fetch');
const cheerio = require('cheerio');

const USER_AGENT = 'ShopifySpyBot/0.1 (+research tool; contact: you@example.com)';
const REQUEST_TIMEOUT_MS = 15000;

// Known app fingerprints: substrings found in <script src="..."> or inline JS
// that reveal which third-party apps a store has installed. Extend this list
// as you find more — it's the highest-leverage part of the whole tool.
const APP_FINGERPRINTS = {
  'cdn.klaviyo.com': 'Klaviyo (email/SMS)',
  'staticw2.yotpo.com': 'Yotpo (reviews)',
  'judge.me': 'Judge.me (reviews)',
  'privy.com': 'Privy (popups)',
  'rechargepayments.com': 'ReCharge (subscriptions)',
  'gorgias.chat': 'Gorgias (helpdesk)',
  'tapcart.com': 'Tapcart (mobile app)',
  'loox.io': 'Loox (reviews)',
  'aftership.com': 'AfterShip (tracking)',
  'attentive.com': 'Attentive (SMS)',
  'postscript.io': 'Postscript (SMS)',
  'smile.io': 'Smile.io (loyalty)',
  'shogun.com': 'Shogun (page builder)',
  'pagefly': 'PageFly (page builder)',
  'bold.com': 'Bold Commerce',
  'ultimate-bundles': 'Bundle app',
  'candyrack': 'CandyRack (upsell)',
  'zipify': 'Zipify (upsell/funnels)',
};

function robotsAllows(robotsTxt, path) {
  // Minimal robots.txt check against the '*' user-agent group only.
  if (!robotsTxt) return true;
  const lines = robotsTxt.split('\n').map((l) => l.trim());
  let inWildcardGroup = false;
  for (const line of lines) {
    if (/^user-agent:\s*\*/i.test(line)) { inWildcardGroup = true; continue; }
    if (/^user-agent:/i.test(line)) { inWildcardGroup = false; continue; }
    if (inWildcardGroup && /^disallow:/i.test(line)) {
      const rule = line.split(':').slice(1).join(':').trim();
      if (rule && path.startsWith(rule)) return false;
    }
  }
  return true;
}

async function safeFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res;
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

function normalizeDomain(input) {
  let d = input.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return d;
}

function detectTheme(html) {
  // Shopify commonly injects a Shopify.theme JS object with name/id/theme_store_id.
  const match = html.match(/Shopify\.theme\s*=\s*(\{[^;]*?\})\s*;/s);
  if (match) {
    try {
      // Loosely parse the JS object literal as JSON-ish (keys may be unquoted).
      const jsonish = match[1]
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":')
        .replace(/'/g, '"');
      const parsed = JSON.parse(jsonish);
      return { name: parsed.name || null, id: parsed.id || null, themeStoreId: parsed.theme_store_id || null };
    } catch (e) {
      // fall through
    }
  }
  return { name: null, id: null, themeStoreId: null };
}

function detectApps(html) {
  const found = new Set();
  for (const [signature, label] of Object.entries(APP_FINGERPRINTS)) {
    if (html.includes(signature)) found.add(label);
  }
  return Array.from(found);
}

function isShopify(html) {
  return /cdn\.shopify\.com/.test(html) || /Shopify\.theme/.test(html) || /shopify-checkout-api-token/.test(html);
}

async function scanStore(domainInput) {
  const domain = normalizeDomain(domainInput);
  const base = `https://${domain}`;

  const robotsRes = await safeFetch(`${base}/robots.txt`);
  const robotsTxt = robotsRes ? await robotsRes.text() : '';

  if (!robotsAllows(robotsTxt, '/products.json') || !robotsAllows(robotsTxt, '/')) {
    return { error: 'robots.txt disallows fetching this store\'s public data. Skipping.' };
  }

  const homeRes = await safeFetch(`${base}/`);
  if (!homeRes) return { error: 'Could not reach the store (site down, blocking bots, or not a valid domain).' };
  const html = await homeRes.text();

  if (!isShopify(html)) {
    return { error: 'This does not look like a Shopify store (no Shopify fingerprints found on the homepage).' };
  }

  const theme = detectTheme(html);
  const apps = detectApps(html);

  let products = [];
  const productsRes = await safeFetch(`${base}/products.json?limit=250`);
  if (productsRes) {
    try {
      const data = await productsRes.json();
      products = (data.products || []).map((p) => ({
        id: p.id,
        title: p.title,
        productType: p.product_type,
        vendor: p.vendor,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        price: p.variants && p.variants[0] ? p.variants[0].price : null,
        available: p.variants ? p.variants.some((v) => v.available) : null,
        image: p.images && p.images[0] ? p.images[0].src : null,
        handle: p.handle,
      }));
    } catch (e) {
      // products.json not exposed or malformed — not fatal, we still have theme/app data
    }
  }

  return {
    domain,
    scannedAt: new Date().toISOString(),
    theme,
    apps,
    productCount: products.length,
    products,
  };
}

function diffSnapshots(prevSnapshot, currSnapshot) {
  if (!prevSnapshot) {
    return { isFirstScan: true, newProducts: currSnapshot.products, priceChanges: [], removedProducts: [] };
  }
  const prevById = new Map(prevSnapshot.products.map((p) => [p.id, p]));
  const currById = new Map(currSnapshot.products.map((p) => [p.id, p]));

  const newProducts = currSnapshot.products.filter((p) => !prevById.has(p.id));
  const removedProducts = prevSnapshot.products.filter((p) => !currById.has(p.id));
  const priceChanges = [];
  for (const [id, curr] of currById) {
    const prev = prevById.get(id);
    if (prev && prev.price !== curr.price) {
      priceChanges.push({ id, title: curr.title, from: prev.price, to: curr.price });
    }
  }
  return { isFirstScan: false, newProducts, priceChanges, removedProducts };
}

module.exports = { scanStore, diffSnapshots, normalizeDomain };
