import { S, replaceState, SK } from './state.js';
import { HK, getHistory } from './history.js';
import { todayISO, toast } from './utils.js';

export function exportJSON() {
  const payload = {
    schema: SK,
    exportedAt: new Date().toISOString(),
    state: S,
    history: getHistory(),
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `eljefe-fin-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
  toast('Exported backup', 'success');
}

function looksLikeOurSchema(obj) {
  if (!obj || typeof obj !== 'object') return false;
  // Top-level bundle: { state: {...}, history?: [...] }
  if (obj.state && typeof obj.state === 'object') return true;
  // Direct state dump (no bundle wrapper).
  return Array.isArray(obj.income) || Array.isArray(obj.expenses) || Array.isArray(obj.debts);
}

export function importJSONFile(file) {
  if (!file) return Promise.resolve(false);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => { toast('Could not read that file', 'error'); resolve(false); };
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!looksLikeOurSchema(parsed)) {
          toast('This does not look like an El Jefé Finance backup', 'error');
          resolve(false);
          return;
        }
        const ok = confirm(
          'Import will replace ALL current data with the contents of this file.\n\n' +
          'Tip: export a backup of the current data first if you want to keep it.\n\n' +
          'Continue?'
        );
        if (!ok) { resolve(false); return; }
        const state = parsed.state || parsed;
        replaceState(state);
        if (Array.isArray(parsed.history)) {
          try { localStorage.setItem(HK, JSON.stringify(parsed.history)); } catch { /* ignore */ }
        }
        toast('Backup restored', 'success');
        resolve(true);
      } catch (e) {
        console.error('[eljefe-fin] import failed', e);
        toast('Import failed: ' + (e.message || 'bad JSON'), 'error');
        resolve(false);
      }
    };
    reader.readAsText(file);
  });
}

export function wireBackupButtons() {
  const exportBtn = document.getElementById('btn-export');
  const importBtn = document.getElementById('btn-import');
  const fileInput = document.getElementById('import-file');
  if (exportBtn) exportBtn.addEventListener('click', exportJSON);
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) await importJSONFile(f);
      e.target.value = '';
    });
  }
}
