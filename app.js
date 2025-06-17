// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

// Dropdown options with descriptions (unchanged)
const pumpOptions = [ /* ... */ ];
const healedOptions = [ /* ... */ ];
const painOptions =  [ /* ... */ ];

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
    'select, .name-input, .weight-actual-input, .reps1-input, .reps2-input, .reps3-input, .reps4-input, .rpe-input, .delta-weight-input, .override-input'
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

  // blank placeholder
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
  console.log('🛠️ renderExercises called with', entries.length, 'entries')
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day/week.</p>';
    return;
  }

  const currentWeek     = parseInt(document.getElementById('week-select').value, 10);
  const currentDay      = document.getElementById('day-select').value;
  const weekOverrideVal = document.getElementById('week-override').value;
  const tpl             = document.getElementById('exercise-card-template').content;

  entries.forEach(e => {
    const rowNum = e.index;
    const v      = e.values;
    if (v.length < 23) return;  // ensure all expected columns exist

    // Destructure columns A–W (23 entries)
    const [
      week, day, name,
      prevWeight, targetWeightRaw, actualWeight,
      prev1, target1, actual1,
      prev2, target2, actual2,
      prev3, target3, actual3,
      prev4, target4, actual4,
      pump, healed, pain,
      rpe, deltaWeight, override
    ] = v;

    // Compute effective targetWeight (apply week-level deload if set)
    let targetWeight = Number(targetWeightRaw) || 0;
    if (weekOverrideVal === 'Deload') {
      targetWeight = Math.round(targetWeight * 0.9);
    }

    // Determine number of sets (fallback logic as before)
    let numSets = 4;
    if (currentWeek > 1) {
      const prev = sheetCache.find(r =>
        parseInt(r[0],10) === currentWeek-1 &&
        r[1] === currentDay &&
        String(r[2]).trim() === name
      );
      numSets = prev && prev.length > 17
        ? parseInt(prev[17],10) || 3
        : 3;
    }

    // Build arrays for per-set binding
    const prevArr   = [prev1,   prev2,   prev3,   prev4];
    const targetArr = [target1, target2, target3, target4];
    const actualArr = [actual1, actual2, actual3, actual4];
    const colMapActual = ['I','L','O','R'];

    const clone = document.importNode(tpl, true);

    // 1) Exercise name
    const nameInput = clone.querySelector('.name-input');
    nameInput.value = name;
    nameInput.dataset.row = rowNum;
    nameInput.dataset.col = 'C';

    // 2) Prev / Target weight displays
    clone.querySelector('.prev-weight-display').innerText   = prevWeight;
    clone.querySelector('.target-weight-display').innerText = targetWeight;

    // 3) Actual weight input
    const wtInp = clone.querySelector('.weight-actual-input');
    wtInp.value = actualWeight;
    wtInp.dataset.row = rowNum;
    wtInp.dataset.col = 'F';

    // 4) Sets 1–4
    const setDivs = clone.querySelectorAll('.sets-container > div');
    setDivs.forEach((wrap, i) => {
      if (i >= numSets) {
        wrap.remove();
        return;
      }
      // Prev / Target displays
      wrap.querySelector('.prev-set-display').innerText   = prevArr[i];
      wrap.querySelector('.target-set-display').innerText = targetArr[i];

      // Actual rep input
      const inp = wrap.querySelector(`.reps${i+1}-input`);
      inp.value = actualArr[i] || '';
      inp.dataset.row = rowNum;
      inp.dataset.col = colMapActual[i];
    });

    // 5) Pump / Healed / Pain dropdowns
    ['pump','healed','pain'].forEach((field, idx) => {
      const sel = createDropdown(
        field==='pump' ? pumpOptions :
        field==='healed'? healedOptions : painOptions,
        v[18+idx], rowNum, String.fromCharCode(73+idx)  // I, J, K
      );
      clone.querySelector(`.${field}-input`).replaceWith(sel);
    });

    // 6) RPE
    const rpeInp = clone.querySelector('.rpe-input');
    rpeInp.value = rpe;
    rpeInp.dataset.row = rowNum;
    rpeInp.dataset.col = 'V';

    // 7) Delta-weight (renamed Weight)
    const deltaInp = clone.querySelector('.delta-weight-input');
    deltaInp.value = deltaWeight;
    deltaInp.dataset.row = rowNum;
    deltaInp.dataset.col = 'W';

    // 8) Per-exercise override
    const overInp = clone.querySelector('.override-input');
    overInp.value = override;
    overInp.dataset.row = rowNum;
    overInp.dataset.col = 'X';

    console.log('🖨 Appending card for row', rowNum);
    container.appendChild(clone);
  });

  // Wire up all inputs to save back to Sheets
  attachInputs(sheetName);
}

// Update view on week/day/override change
async function updateView() {
  if (!currentUser) return;
  const week  = document.getElementById('week-select').value;
  const day   = document.getElementById('day-select').value;
  const rows  = extractDay(week, day);
  renderExercises(rows, currentUser);
}

// RESET APP (clear SW & cache)
async function resetApp() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
  }
  location.reload(true);
}

// Service worker registration (unchanged)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/papas-muscle-machine/service-worker.js')
      .catch(console.error);
  });
}

// DOMContentLoaded → wire up login & selectors
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#login-screen button[data-user]')
    .forEach(btn => btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;
      try {
        const full = await fetchSheet(currentUser);
        sheetCache = full.slice(1);  // drop header row
        await initSelectors(sheetCache);
        document.getElementById('login-screen').style.display   = 'none';
        document.getElementById('main-content').style.display   = 'block';
        document.getElementById('week-select').onchange        = updateView;
        document.getElementById('day-select').onchange         = updateView;
        document.getElementById('week-override').onchange      = updateView;
        updateView();
      } catch (err) {
        console.error(err);
        document.getElementById('exercise-list').innerHTML =
          '<p class="text-center text-red-500">Failed to load sheet.</p>';
      }
    }));

  const resetBtn = document.getElementById('reset-app-btn');
  if (resetBtn) resetBtn.addEventListener('click', resetApp);
});
