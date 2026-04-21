#!/usr/bin/env node
// Build-time artist index generator.
// Run: node build-artist-index.js  → writes artist-index.json
// Requires Node 18+ (native fetch).
//
// Kaynak: /api/nfts — 6529'un tüm koleksiyonlarını döndürür (Memes + Gradient).
// Biz sadece "The Memes by 6529" koleksiyonunu istiyoruz; diğerleri filtrelenir.

const fs   = require('fs');
const path = require('path');

const MEMES_COLLECTION = 'The Memes by 6529';
const PAGE_SIZE    = 1000;
const CHUNK_SIZE   = 10;    // paralel profile fetch
const CHUNK_DELAY  = 50;    // ms — chunk'lar arası bekleme
const SAFETY_LIMIT = 50;    // pagination loop koruması

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJson(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function fetchAllMemes() {
  const all = [];
  let url = `https://api.6529.io/api/nfts?page_size=${PAGE_SIZE}`;
  let safety = SAFETY_LIMIT;
  let page = 0;
  let totalSeen = 0;
  while (url && safety-- > 0) {
    page++;
    process.stdout.write(`\r[nfts] page ${page}... `);
    const d = await fetchJson(url);
    for (const n of d.data || []) {
      totalSeen++;
      if (n.collection === MEMES_COLLECTION) all.push(n);
    }
    url = d.next || null;
  }
  const dropped = totalSeen - all.length;
  process.stdout.write(`\r[nfts] ${all.length} Memes fetched (${dropped} non-Memes filtered) across ${page} pages\n`);
  return all;
}

function collectHandleCounts(nfts) {
  const counts = {};
  for (const nft of nfts) {
    const raw = nft.artist_seize_handle;
    if (!raw) continue;
    const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
    for (const h of parts) {
      const key = h.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

async function resolveHandleWallets(handleCount) {
  const walletCount = {};
  const handles = Object.keys(handleCount);
  let done = 0;
  let failed = 0;
  for (let i = 0; i < handles.length; i += CHUNK_SIZE) {
    const chunk = handles.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (h) => {
      try {
        const p = await fetchJson(`https://api.6529.io/api/profiles/${encodeURIComponent(h)}`);
        const count   = handleCount[h] || 0;
        const wallets = p.consolidation?.wallets || [];
        for (const w of wallets) {
          const addr = w?.wallet?.address;
          if (!addr) continue;
          const key = addr.toLowerCase();
          walletCount[key] = (walletCount[key] || 0) + count;
        }
        const primary = p.profile?.primary_wallet;
        if (primary) {
          const key = primary.toLowerCase();
          if (!walletCount[key]) walletCount[key] = count;
        }
      } catch {
        failed++;
      } finally {
        done++;
      }
    }));
    process.stdout.write(`\r[profiles] ${done}/${handles.length} resolved (${failed} failed)`);
    if (i + CHUNK_SIZE < handles.length) await sleep(CHUNK_DELAY);
  }
  process.stdout.write('\n');
  return walletCount;
}

(async function main() {
  const t0 = Date.now();
  console.log('[build] fetching Memes NFT catalog...');
  const nfts = await fetchAllMemes();

  console.log('[build] aggregating artist handles...');
  const handleCount = collectHandleCounts(nfts);
  console.log(`[build] ${Object.keys(handleCount).length} unique handles`);

  console.log('[build] resolving handles → consolidation wallets...');
  const walletCount = await resolveHandleWallets(handleCount);

  const output = {
    lastBuild: new Date().toISOString(),
    nftCount: nfts.length,
    handles: handleCount,
    wallets: walletCount,
  };

  const outPath = path.join(__dirname, 'artist-index.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[build] done in ${dt}s → ${outPath}`);
  console.log(`[build] ${Object.keys(handleCount).length} handles · ${Object.keys(walletCount).length} wallets · ${nfts.length} NFTs`);
})().catch(err => {
  console.error('[build] FAILED:', err);
  process.exit(1);
});
