// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQL0doOREr3tdzPC0I';

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

function renderExercises(entries, sheetName) {
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day/week.</p>';
    return;
  }

  const currentWeek = parseInt(document.getElementById('week-select').value, 10);
  const currentDay  = document.getElementById('day-select').value;
  const tpl = document.getElementById('exercise-card-template').content;

  entries.forEach(e => {
    const rowNum = e.index;
    const v = e.values;
    if (v.length < 23) return;

    // Destructure based on new layout
    const [
      week, day, name,
      prevWeight, targetWeight, actualWeight,
      prev1, target1, actual1,
      prev2, target2, actual2,
      prev3, target3, actual3,
      prev4, target4, actual4,
      pump, healed, pain,
      rpe, deltaWeight, override,
      repLogic, weightLogic
    ] = v;

    // Determine numSets from prev data
    let numSets = 4;
    if (currentWeek > 1) {
      const prev = sheetCache.find(r =>
        parseInt(r[0],10) === currentWeek-1 &&
        r[1] === currentDay &&
        String(r[2]).trim() === name
      );
      numSets = prev && prev.length > 17 ? parseInt(prev[17],10) || 3 : 3;
    }

    const clone = document.importNode(tpl, true);

    // Bind exercise name
    const nameInput = clone.querySelector('.name-input');
    nameInput.value = name;
    nameInput.dataset.row = rowNum;
    nameInput.dataset.col = 'C';

    // Bind prev/target weight display
    clone.querySelector('.prev-weight-display').innerText   = prevWeight;
    clone.querySelector('.target-weight-display').innerText = targetWeight;

    // Bind actual weight input
    const wtInp = clone.querySelector('.weight-actual-input');
    wtInp.value = actualWeight;
    wtInp.dataset.row = rowNum;
    wtInp.dataset.col = 'F';

    // Bind sets
    const colMapActual = ['I','L','O','R'];
    const prevArr   = [prev1, prev2, prev3, prev4];
    const targetArr = [target1, target2, target3, target4];

    const setDivs = clone.querySelectorAll('.sets-container > div');
    setDivs.forEach((wrap, i) => {
      if (i >= numSets) {
        wrap.remove();
        return;
      }
      wrap.querySelector('.prev-set-display').innerText   = prevArr[i];
      wrap.querySelector('.target-set-display').innerText = targetArr[i];
      const inp = wrap.querySelector(`.reps${i+1}-input`);
      inp.value = actual1; // note: template class name
      inp.dataset.row = rowNum;
      inp.dataset.col = colMapActual[i];
    });

    // Pump/Healed/Pain dropdowns
    ['pump','healed','pain'].forEach((field, idx) => {
      const sel = createDropdown(
        field === 'pump' ? pumpOptions
          : field === 'healed' ? healedOptions
          : painOptions,
        v[18+idx], rowNum, String.fromCharCode(73+idx)
      );
      clone.querySelector(`.${field}-input`).replaceWith(sel);
    });

    // RPE
    const rpeInp = clone.querySelector('.rpe-input');
    rpeInp.value = rpe;
    rpeInp.dataset.row = rowNum;
    rpeInp.dataset.col = 'V';

    // Delta Weight (Weight increment)
    const deltaInp = clone.querySelector('.delta-weight-input');
    deltaInp.value = deltaWeight;
    deltaInp.dataset.row = rowNum;
    deltaInp.dataset.col = 'W';

    // Override per-exercise
    const overInp = clone.querySelector('.override-input');
    overInp.value = override;
    overInp.dataset.row = rowNum;
    overInp.dataset.col = 'X';

    container.appendChild(clone);
  });

  attachInputs(sheetName);
}

async function updateView() {
  if (!currentUser) return;
  const week = document.getElementById('week-select').value;
  const day  = document.getElementById('day-select').value;
  const filtered = extractDay(week, day);
  renderExercises(filtered, currentUser);
}

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/papas-muscle-machine/service-worker.js')
      .catch(console.error);
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
        document.getElementById('week-override').onchange = updateView;
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
