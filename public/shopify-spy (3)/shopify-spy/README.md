# Shopify Spy (MVP)

A self-hosted tool for tracking Shopify stores over time: theme, installed apps,
and product catalog (with price/new-product/removed-product diffs between scans).

## Why this exists

Commercial tools like Shopify Spy, BootLeads, and PPspy do roughly this. This is
your own version — free to run, and you own the data.

## What it does right now

- Add any live Shopify store by domain
- "Scan" pulls:
  - the store's theme name/id (from the `Shopify.theme` JS object Shopify injects)
  - installed third-party apps (fingerprinted from script tags — Klaviyo, Yotpo,
    ReCharge, Gorgias, etc. — extend the list in `src/scraper.js`)
  - the full public product catalog via the store's `/products.json` endpoint
- Every scan is saved as a snapshot. Re-scanning a store shows you a diff:
  new products, price changes, removed products.
- Checks `robots.txt` before fetching and skips stores that disallow it.

## What it does NOT do yet (intentionally out of MVP scope)

- Ad creative tracking (Meta Ad Library / TikTok Creative Center integration) —
  this is the natural next feature. It's a clean API integration, not scraping,
  so it's a good next step.
- Store discovery — right now you add domains you already know. A "find new
  stores in niche X" feature would need a seed list or a discovery API.
- Scheduled/automatic scans — right now scans are triggered manually from the
  dashboard. Cron-style scheduling is a small addition to `server.js`.

## Running it

```bash
npm install
npm start
```

Then open http://localhost:3000

## Project structure

```
server.js           # Express entry point
src/scraper.js       # All the fetching + fingerprinting logic — this is the core IP
src/routes.js         # API endpoints
src/db.js             # Storage (flat JSON file via lowdb — swap for Postgres later)
public/               # Dashboard (vanilla HTML/CSS/JS, no build step)
data/db.json           # Your data lives here — back it up / gitignore it
```

## Notes on scaling this into a product later

- Swap `lowdb` for Postgres once you have real concurrent users — the `db.js`
  interface is small and easy to replace without touching the rest of the app.
- Move scans into a background job queue (BullMQ + Redis) once you're tracking
  more than a handful of stores, so scans don't block the request/response cycle.
- The app-fingerprint list in `scraper.js` is the thing worth continuously
  growing — it's the highest-leverage, most defensible part of the tool.
- Be a good citizen: keep the custom `User-Agent` in `scraper.js` honest, don't
  drop the `robots.txt` check, and don't crank up request concurrency — that's
  what gets scraping tools blocked or blacklisted.
