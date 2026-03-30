/* =============================================================
   sync.js — Google Sheets Cloud Sync
   My Wellness Journey
   =============================================================

   APPS SCRIPT CODE (deploy at script.google.com):
   ─────────────────────────────────────────────────────────────
   function doGet(e) {
     var sheet  = e.parameter.sheet;
     var ss     = SpreadsheetApp.getActiveSpreadsheet();
     var sh     = ss.getSheetByName(sheet);
     var val    = sh ? sh.getRange(1,1).getValue() : '{}';
     return ContentService
       .createTextOutput(val || '{}')
       .setMimeType(ContentService.MimeType.JSON);
   }

   function doPost(e) {
     var payload = JSON.parse(e.postData.contents);
     var ss      = SpreadsheetApp.getActiveSpreadsheet();
     var sh      = ss.getSheetByName(payload.sheet)
                   || ss.insertSheet(payload.sheet);
     sh.clearContents();
     sh.getRange(1,1).setValue(JSON.stringify(payload.data));
     return ContentService.createTextOutput('OK');
   }
   ─────────────────────────────────────────────────────────────
   Deploy as: Execute as "Me", Access "Anyone"
   ============================================================= */

(function () {
  'use strict';

  const GS_URL     = 'https://script.google.com/macros/s/AKfycbw17iGjXhlw4WIf9G-8lhoooLBrkKLmHHBwpcXATLbGFslD4FxUdrYmD-w0eKwEpxOPTA/exec';
  const LS_TS_KEY  = 'wellness_last_synced';

  /* ── Inject CSS ──────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    #gs-ind {
      position: fixed; top: 72px; right: 16px; z-index: 9999;
      display: flex; align-items: center; gap: 7px;
      background: #fff; border: 1px solid #E5E7EB;
      border-radius: 20px; padding: 5px 14px 5px 10px;
      font: 600 0.73rem/1 'Inter', -apple-system, sans-serif;
      color: #6B7280;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      opacity: 0; transform: translateY(-6px);
      transition: opacity .3s, transform .3s;
      pointer-events: none;
    }
    #gs-ind.gs-show { opacity: 1; transform: translateY(0); }
    #gs-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .gd-pulse { background:#1D9E75; animation: gsPulse .85s ease-in-out infinite; }
    .gd-ok    { background:#1D9E75; }
    .gd-local { background:#BA7517; }
    .gd-err   { background:#EF4444; }
    @keyframes gsPulse {
      0%,100% { opacity:1;   transform:scale(1);   }
      50%     { opacity:.35; transform:scale(1.45); }
    }
    #gs-footer {
      text-align: center;
      font-size: .73rem;
      color: #9CA3AF;
      padding: 18px 24px 36px;
      font-family: 'Inter', -apple-system, sans-serif;
    }
  `;
  document.head.appendChild(style);

  /* ── Inject DOM once ─────────────────────────────────────── */
  function injectDOM() {
    if (!document.getElementById('gs-ind')) {
      const div  = document.createElement('div');
      div.id     = 'gs-ind';
      div.innerHTML = '<span id="gs-dot"></span><span id="gs-lbl"></span>';
      document.body.appendChild(div);
    }
    if (!document.getElementById('gs-footer')) {
      const footer = document.createElement('div');
      footer.id    = 'gs-footer';
      document.body.appendChild(footer);
    }
    refreshFooter();
  }

  /* ── Footer timestamp ────────────────────────────────────── */
  function refreshFooter() {
    const f  = document.getElementById('gs-footer');
    if (!f) return;
    const ts = localStorage.getItem(LS_TS_KEY);
    f.textContent = ts
      ? '☁️  Last synced to Google Sheets: ' + new Date(ts).toLocaleString()
      : '☁️  Not yet synced to Google Sheets';
  }

  /* ── Sync indicator ──────────────────────────────────────── */
  let _hideTimer = null;

  function indicate(state, msg, autohide) {
    const dot = document.getElementById('gs-dot');
    const lbl = document.getElementById('gs-lbl');
    const ind = document.getElementById('gs-ind');
    if (!dot || !ind) return;
    clearTimeout(_hideTimer);
    dot.className   = '';
    lbl.textContent = msg;
    ind.classList.add('gs-show');
    const map = { syncing:'gd-pulse', saved:'gd-ok', local:'gd-local', error:'gd-err' };
    if (map[state]) dot.classList.add(map[state]);
    const ms = autohide !== undefined ? autohide : 2800;
    if (ms > 0) _hideTimer = setTimeout(() => ind.classList.remove('gs-show'), ms);
  }

  /* ── POST to Google Sheets (no-cors) ─────────────────────── */
  async function post(sheet, data) {
    indicate('syncing', 'Saving to cloud…', 0);
    try {
      await fetch(GS_URL, {
        method : 'POST',
        mode   : 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body   : JSON.stringify({ sheet, data }),
      });
      // no-cors gives opaque response — optimistically treat as success
      const now = new Date().toISOString();
      localStorage.setItem(LS_TS_KEY, now);
      indicate('saved', '✓ Saved to cloud');
      refreshFooter();
      return true;
    } catch (err) {
      indicate('local', 'Saved locally only');
      return false;
    }
  }

  /* ── GET from Google Sheets (cors) ───────────────────────── */
  async function get(sheet) {
    try {
      const res = await fetch(GS_URL + '?sheet=' + encodeURIComponent(sheet), {
        method : 'GET',
        mode   : 'cors',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const now  = new Date().toISOString();
      localStorage.setItem(LS_TS_KEY, now);
      refreshFooter();
      return data;
    } catch (_) {
      return null; // silent fallback — localStorage takes over
    }
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.GS = { post, get, refreshFooter, indicate };

  /* ── Auto-init after DOM ready ───────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDOM);
  } else {
    injectDOM();
  }

})();
