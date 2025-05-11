// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

// Dropdown options with descriptions
const pumpOptions = [
  { value: 1, label: '1 - Very light pump, muscle barely engaged' },
  { value: 2, label: '2 - Mild pump, ready for more volume' },
  { value: 3, label: '3 - Solid pump, strong/full (ideal)' },
  { value: 4, label: '4 - Heavy pump, nearing fatigue' },
  { value: 5, label: '5 - Max pump, risk of discomfort' }
];
const healedOptions = [
  { value: 1, label: '1 - Actively sore, hurts to move' },
  { value: 2, label: '2 - Sore but trainable (heavily fatigued)' },
  { value: 3, label: '3 - Minor DOMS, just tightness' },
  { value: 4, label: '4 - Mostly recovered, no soreness' },
  { value: 5, label: '5 - Fully recovered, fresh and energized' }
];
const painOptions = [
  { value: 0, label: '0 - No discomfort' },
  { value: 1, label: '1 - Minor ache, no impact on performance' },
  { value: 2, label: '2 - Noticeable pain, affecting execution' },
  { value: 3, label: '3 - Sharp pain, risking injury' }
];

let currentUser = null;
let sheetCache = [];

function urlFor(tab) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
}

async function fetchSheet(tab) {
  const res = await fetch(urlFor(tab));
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

async function initSelectors(sheetData) {
  const wSel = document.getElementById('week-select');
  const dSel = document.getElementById('day-select');
  wSel.innerHTML = '';
  dSel.innerHTML = '';

  const weekSet = new Set();
  sheetData.forEach(row => {
    if (row[0] && !isNaN(row[0])) weekSet.add(row[0]);
  });

  [...weekSet]
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(w => wSel.append(new Option(`Week ${w}`, w)));

  ['1','2','3','4','5','6','7'].forEach(d =>
    dSel.append(new Option(`Day ${d}`, d))
  );
}

function extractDay(week, day) {
  return sheetCache
    .map((row, i) => ({ index: i + 2, values: row }))
    .filter(entry =>
      entry.values[0] == week &&
      entry.values[1] == day &&
      typeof entry.values[2] === 'string' && entry.values[2].trim() !== ''
    );
}

function attachInputs(sheetName) {
  document.querySelectorAll(
    'select, .name-input, .weight-input, .reps1-input, .reps2-input, .reps3-input, .reps4-input'
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

function createDropdown(options, selectedValue, rowNum, col) {
  const sel = document.createElement('select');
  // apply boxed styling like the number inputs
  sel.className = 'w-20 bg-[#454545] text-white rounded px-2 py-1';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value == selectedValue) o.selected = true;
    sel.appendChild(o);
  });
  sel.dataset.row = rowNum;
  sel.dataset.col = col;
  return sel;
}

function renderExercises(entries, sheetName) {
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day/week.</p>';
    return;
  }

  const currentWeek = parseInt(
    document.getElementById('week-select').value, 10
  );
  const currentDay = document.getElementById('day-select').value;
  const tpl = document.getElementById('exercise-card-template').content;

  entries.forEach(e => {
    const values = e.values;
    const rowNum = e.index;
    if (!values || values.length < 11) return;

    const [week, day, name, wt, r1, r2, r3, r4, pump, healed, pain] = values;

    // Determine numSets:
    let numSets;
    if (currentWeek === 1) {
      numSets = 4;
    } else {
      const prev = sheetCache.find(r =>
        parseInt(r[0],10) === currentWeek-1 &&
        r[1] === currentDay &&
        String(r[2]).trim() === name
      );
      numSets = prev && prev.length>16 ? parseInt(prev[16],10)||3 : 3;
    }

    const repsMap = [r1, r2, r3, r4];
    const colMap = ['E','F','G','H'];

    const clone = document.importNode(tpl, true);

    // Bind editable name field
    const nameInput = clone.querySelector('.name-input');
    if (nameInput) {
      nameInput.value = name;
      nameInput.dataset.row = rowNum;
      nameInput.dataset.col = 'C';
    }

    // Bind weight
    const wtEl = clone.querySelector('.weight-input');
    if (wtEl) {
      wtEl.value = wt;
      wtEl.dataset.row = rowNum;
      wtEl.dataset.col = 'D';
    }

    // Render reps
    for (let i = 0; i < 4; i++) {
      const inp = clone.querySelector(`.reps${i+1}-input`);
      const wrap = inp?.closest('div');
      if (i < numSets) {
        inp.value = repsMap[i];
        inp.dataset.row = rowNum;
        inp.dataset.col = colMap[i];
      } else if (wrap) {
        wrap.remove();
      }
    }

    // Dropdowns for pump/healed/pain
    ['pump','healed','pain'].forEach((field, idx) => {
      const el = clone.querySelector(`.${field}-input`);
      const sel = createDropdown(
        field === 'pump' ? pumpOptions : field === 'healed' ? healedOptions : painOptions,
        values[8+idx], rowNum, String.fromCharCode(73+idx)
      );
      if (el) el.replaceWith(sel);
    });

    container.appendChild(clone);
  });

  attachInputs(sheetName);
}

async function updateView() {
  if (!currentUser) return;
  const week = document.getElementById('week-select').value;
  const day = document.getElementById('day-select').value;
  const filtered = extractDay(week, day);
  renderExercises(filtered, currentUser);
}

// Service Worker Registration (added)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
   navigator.serviceWorker.register('/papas-muscle-machine/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#login-screen button[data-user]')
    .forEach(btn => btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;
      try {
        const full = await fetchSheet(currentUser);
        sheetCache = full.slice(1);
        await initSelectors(sheetCache);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('week-select').onchange = updateView;
        document.getElementById('day-select').onchange = updateView;
        updateView();
      } catch (err) {
        console.error(err);
        document.getElementById('exercise-list').innerHTML =
          '<p class="text-center text-red-500">Failed to load sheet.</p>';
      }
    }));
});
