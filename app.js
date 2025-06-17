// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQL0doOREr3tdzPC0I';

const pumpOptions   = [ /* ... */ ];
const healedOptions = [ /* ... */ ];
const painOptions   = [ /* ... */ ];

let currentUser = null;
let sheetCache  = [];

// Build the Sheets API URL for a given tab/user
function urlFor(tab) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${
    SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
}

// Fetch entire sheet data for the current user
async function fetchSheet(tab) {
  const res = await fetch(urlFor(tab));
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

// Populate Week & Day selectors
async function initSelectors(sheetData) {
  const wSel = document.getElementById('week-select');
  const dSel = document.getElementById('day-select');
  wSel.innerHTML = '';
  dSel.innerHTML = '';

  const weekSet = new Set();
  sheetData.forEach(row => {
    if (row[0] && !isNaN(row[0])) weekSet.add(row[0]);
  });

  [...weekSet].sort((a,b)=>a-b)
    .forEach(w => wSel.append(new Option(`Week ${w}`, w)));

  ['1','2','3','4','5','6','7'].forEach(d =>
    dSel.append(new Option(`Day ${d}`, d))
  );
}

// Filter sheetCache for rows matching the selected week/day
function extractDay(week, day) {
  return sheetCache
    .map((row, i) => ({ index: i+2, values: row }))  // +2 because sheet data starts on row 2
    .filter(entry =>
      entry.values[0] == week &&
      entry.values[1] == day &&
      typeof entry.values[2] === 'string' && entry.values[2].trim() !== ''
    );
}

// Attach onChange to every input/select in the rendered cards
function attachInputs(sheetName) {
  document.querySelectorAll(
    'select, .name-input, .weight-actual-input, .reps1-input, .reps2-input, .reps3-input, .reps4-input, .rpe-input, .override-input'
  ).forEach(input => {
    input.addEventListener('change', async e => {
      const { row, col } = e.target.dataset;
      const value = e.target.value;
      try {
        await fetch(WRITE_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ sheet: sheetName, cell: `${col}${row}`, value })
        });
      } catch (err) {
        console.error(err);
        alert('Save failed—see console.');
      }
    });
  });
}

// Create a dropdown <select> for pump/healed/pain fields
function createDropdown(options, selectedValue, rowNum, col) {
  const sel = document.createElement('select');
  sel.className = 'w-20 bg-[#454545] text-white rounded px-2 py-1';
  sel.dataset.row = rowNum;
  sel.dataset.col = col;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '';
  placeholder.selected = true;
  sel.appendChild(placeholder);

  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  });

  sel.value = selectedValue || '';
  return sel;
}

// Main render function: builds a card per exercise row
function renderExercises(entries, sheetName) {
  console.log('renderExercises called with', entries.length, 'entries');
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day/week.</p>';
    return;
  }

  const weekOverrideVal = document.getElementById('week-override').value;
  const tplEl = document.getElementById('exercise-card-template');
  if (!tplEl) throw new Error('Missing <template id="exercise-card-template"> in HTML.');
  const tpl = tplEl.content;

  entries.forEach(e => {
    const rowNum = e.index;
    const v      = e.values;
    if (v.length < 23) return;

    // destructure values...
    const [week, day, name, prevWeight, targetWeightRaw, actualWeight,
      prev1, target1, actual1, prev2, target2, actual2,
      prev3, target3, actual3, prev4, target4, actual4,
      pump, healed, pain, rpe, /* deltaWeight */, override] = v;

    let targetWeight = Number(targetWeightRaw) || 0;
    if (weekOverrideVal === 'Deload') targetWeight = Math.round(targetWeight * 0.9);

    // determine numSets...

    const clone = document.importNode(tpl, true);
    // populate clone as before...

    container.appendChild(clone);
  });

  attachInputs(sheetName);
}

// Update view
async function updateView() {
  if (!currentUser) return;
  const week = document.getElementById('week-select').value;
  const day  = document.getElementById('day-select').value;
  renderExercises(extractDay(week, day), currentUser);
}

// RESET APP
async function resetApp() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload(true);
}

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/papas-muscle-machine/service-worker.js')
      .catch(console.error);
  });
}

// DOMContentLoaded → wire up UI
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#login-screen button[data-user]')
    .forEach(btn => btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;
      try {
        const full = await fetchSheet(currentUser);
        sheetCache = full.slice(1);
        await initSelectors(sheetCache);
        document.getElementById('login-screen').style.display   = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('week-select').onchange   = updateView;
        document.getElementById('day-select').onchange    = updateView;
        document.getElementById('week-override').onchange = updateView;
        updateView();
      } catch (err) {
        console.error(err);
        document.getElementById('exercise-list').innerHTML =
          '<p class="text-center text-red-500">Failed to load sheet.</p>';
      }
    }));

  document.getElementById('reset-app-btn')
    .addEventListener('click', resetApp);
});
