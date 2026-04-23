// THE SIGILS — Shared Archive
// Every sigil ever read, by anyone, anywhere, logged to a public table.
// Backend: Supabase REST + one RPC ("record_read"), anon key only.

const SUPABASE_URL  = 'https://nujoirwbkywbntkpjjza.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51am9pcndia3l3Ym50a3BqanphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MjkyMTAsImV4cCI6MjA5MjUwNTIxMH0.lykVtcLsFLRP3Xd1puAKMoCLK2-bapjxpaTxuxNmACc';

const ARCHIVE_LIMIT = 1000;

// ── Record a read (fire and forget) ───────────────────────────
// Called from renderSigil after buildHUD, so we always log once per successful read.
function recordSigilRead(sigilObj, sigilName, tierName) {
  if (!sigilObj || !SUPABASE_URL || !SUPABASE_ANON) return;

  // Prefer canonical primary wallet; fall back to address string if it is a hex wallet
  const candidate = (sigilObj.primary_wallet || sigilObj.address || '').toString().toLowerCase();
  const wallet    = /^0x[a-f0-9]{40}$/i.test(candidate) ? candidate : null;
  if (!wallet) return;  // consolidation-display strings etc. are not valid row keys

  fetch(`${SUPABASE_URL}/rest/v1/rpc/record_read`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      p_wallet:     wallet,
      p_handle:     sigilObj.handle     || null,
      p_sigil_name: sigilName           || null,
      p_tier:       tierName            || null,
    }),
  }).catch(() => { /* silent — archive is best-effort */ });
}

// ── Fetch the archive ────────────────────────────────────────
async function _archiveFetch(sortBy) {
  let order;
  switch (sortBy) {
    case 'popular': order = 'read_count.desc,last_read_at.desc'; break;
    case 'newest':  order = 'first_read_at.desc';                break;
    case 'recent':
    default:        order = 'last_read_at.desc';                 break;
  }

  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/reads?order=${order}&limit=${ARCHIVE_LIMIT}&select=*`,
      {
        headers: {
          'apikey':        SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
      }
    );
    if (!resp.ok) throw new Error(`archive HTTP ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn('[archive] load failed:', err.message);
    return null;
  }
}

// ── UI state + render ────────────────────────────────────────
const _archiveState = {
  rows:   [],
  sortBy: 'recent',
  search: '',
};

async function openArchive() {
  const ov = document.getElementById('archiveOverlay');
  if (!ov) return;
  ov.classList.add('visible');
  document.body.classList.add('archive-mode');

  const body  = document.getElementById('archiveBody');
  const empty = document.getElementById('archiveEmpty');
  const stats = document.getElementById('archiveStats');
  if (body)  body.innerHTML = '<tr class="archive-loading"><td colspan="7">loading the archive…</td></tr>';
  if (empty) empty.style.display = 'none';
  if (stats) stats.textContent   = '';

  const rows = await _archiveFetch(_archiveState.sortBy);
  if (rows === null) {
    if (body) body.innerHTML = '<tr class="archive-loading"><td colspan="7">archive unreachable. try again.</td></tr>';
    return;
  }
  _archiveState.rows = rows;
  _renderArchive();
}

function closeArchive() {
  const ov = document.getElementById('archiveOverlay');
  if (!ov) return;
  ov.classList.remove('visible');
  document.body.classList.remove('archive-mode');
}

async function setArchiveSort(btn) {
  const sortBy = btn.dataset.sort;
  if (!sortBy || sortBy === _archiveState.sortBy) return;
  _archiveState.sortBy = sortBy;
  document.querySelectorAll('.archive-sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === sortBy)
  );
  const body = document.getElementById('archiveBody');
  if (body) body.innerHTML = '<tr class="archive-loading"><td colspan="7">sorting…</td></tr>';
  const rows = await _archiveFetch(sortBy);
  if (rows === null) return;
  _archiveState.rows = rows;
  _renderArchive();
}

function archiveSearchInput(el) {
  _archiveState.search = el.value.toLowerCase();
  _renderArchive();
}

function _renderArchive() {
  const { rows, search } = _archiveState;
  const body  = document.getElementById('archiveBody');
  const stats = document.getElementById('archiveStats');
  const empty = document.getElementById('archiveEmpty');
  if (!body) return;

  const filtered = search
    ? rows.filter(r =>
          (r.wallet     || '').toLowerCase().includes(search)
       || (r.handle     || '').toLowerCase().includes(search)
       || (r.sigil_name || '').toLowerCase().includes(search)
       || (r.tier       || '').toLowerCase().includes(search))
    : rows;

  if (!filtered.length) {
    body.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    if (stats) stats.textContent = rows.length
      ? `no match in ${rows.length.toLocaleString()} sigils`
      : '';
    return;
  }
  if (empty) empty.style.display = 'none';

  body.innerHTML = filtered.map((r, i) => {
    const handleTxt = r.handle ? _archiveEscape(r.handle) : '<span class="ar-dim">—</span>';
    const nameTxt   = r.sigil_name ? _archiveEscape(r.sigil_name) : '';
    const tierTxt   = r.tier || '';
    const tierCls   = tierTxt.toLowerCase().replace(/\s+/g, '-');
    const readsTxt  = (r.read_count || 1).toLocaleString();
    const lastTxt   = _archiveRelative(r.last_read_at);
    const walletTxt = _archiveShort(r.wallet);

    // Match the main HUD: tier and sigil name are colored by each wallet's baseHue.
    // sigilHue() is defined in sigil-organism.js and loads before this script.
    const hue = (typeof sigilHue === 'function') ? sigilHue(r.wallet) : null;
    const tierStyle = hue !== null ? ` style="color:hsl(${hue},82%,74%)"` : '';
    const nameStyle = hue !== null ? ` style="color:hsla(${hue},60%,82%,0.85)"` : '';

    return `<tr class="archive-row" data-wallet="${r.wallet}" onclick="_archiveOpen('${r.wallet}')">
      <td class="ar-idx">${i + 1}</td>
      <td class="ar-handle">${handleTxt}</td>
      <td class="ar-wallet"><code>${walletTxt}</code></td>
      <td class="ar-name"${nameStyle}>${nameTxt}</td>
      <td class="ar-tier tier-${tierCls}"${tierStyle}>${tierTxt}</td>
      <td class="ar-reads">${readsTxt}</td>
      <td class="ar-last">${lastTxt}</td>
    </tr>`;
  }).join('');

  if (stats) {
    stats.textContent = filtered.length === rows.length
      ? `${rows.length.toLocaleString()} sigils in the archive`
      : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} sigils`;
  }
}

function _archiveOpen(wallet) {
  closeArchive();
  const input = document.getElementById('walletInput');
  if (input) input.value = wallet;
  if (typeof readSigil === 'function') readSigil();
}

// ── Tiny helpers (archive-scoped to avoid global collisions) ─
function _archiveShort(addr) {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function _archiveEscape(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function _archiveRelative(iso) {
  if (!iso) return '';
  const t  = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s <  10)      return 'just now';
  if (s <  60)      return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m <  60)      return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h <  24)      return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d <  30)      return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)      return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const ov = document.getElementById('archiveOverlay');
    if (ov && ov.classList.contains('visible')) closeArchive();
  }
});
