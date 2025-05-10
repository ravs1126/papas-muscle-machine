// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

let currentUser = null;
let sheetCache = []; // store sheet rows for filtering

function urlFor(tab) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
}

async function fetchSheet(tab) {
  const res = await fetch(urlFor(tab));
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

// Populate Week and Day selectors dynamically from the actual sheet rows
async function initSelectors(sheetData) {
  const wSel = document.getElementById('week-select');
  const dSel = document.getElementById('day-select');
  wSel.innerHTML = '';
  dSel.innerHTML = '';

  const weekSet = new Set();
  sheetData.forEach(row => {
    if (row[0] && !isNaN(row[0])) {
      weekSet.add(row[0]);
    }
  });

  [...weekSet].sort((a, b) => parseInt(a) - parseInt(b)).forEach(w => {
    wSel.append(new Option(`Week ${w}`, w));
  });

  ['1','2','3','4','5','6','7'].forEach(d => {
    dSel.append(new Option(`Day ${d}`, d));
  });
}

// Extract rows that match selected Week & Day
function extractDay(week, day) {
  return sheetCache
    .map((row, i) => ({ index: i + 1, values: row }))
    .filter(entry =>
      entry.values[0] == week &&
      entry.values[1] == day &&
      typeof entry.values[2] === 'string' &&
      !entry.values[2].toLowerCase().includes('day') &&
      entry.values[2].trim() !== ''
    );
}

function attachInputs(sheetName) {
  document.querySelectorAll(
    '.name-input, .weight-input, .reps1-input, .reps2-input, .reps3-input, .reps4-input, .pump-input, .healed-input, .pain-input'
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
        console.log(`✔ Updated ${sheetName}!${col}${row} → ${value}`);
      } catch (err) {
        console.error(err);
        alert('Save failed—see console.');
      }
    });
  });
}

function renderExercises(entries, sheetName) {
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!entries.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day/week.</p>';
    return;
  }

  const tpl = document.getElementById('exercise-card-template').content;
  entries.forEach(e => {
    const [, , name = '', wt = '', r1 = '', r2 = '', r3 = '', r4 = '', pump = '', healed = '', pain = ''] = e.values;
    const clone = document.importNode(tpl, true);
    const rowNum = e.index;

    function bind(sel, val, col) {
      const inp = clone.querySelector(sel);
      if (!inp) return;
      inp.value = val;
      inp.dataset.row = rowNum;
      inp.dataset.col = col;
    }

    bind('.name-input', name, 'C');
    bind('.weight-input', wt, 'D');
    bind('.reps1-input', r1, 'E');
    bind('.reps2-input', r2, 'F');
    bind('.reps3-input', r3, 'G');
    bind('.reps4-input', r4, 'H');
    bind('.pump-input', pump, 'I');
    bind('.healed-input', healed, 'J');
    bind('.pain-input', pain, 'K');

    const nameEl = clone.querySelector('.exercise-name');
    if (nameEl) nameEl.textContent = name;

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

window.addEventListener('DOMContentLoaded', async () => {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');

  loginScreen.querySelectorAll('button[data-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;
      loginScreen.style.display = 'none';
      mainContent.style.display = 'block';

      try {
        sheetCache = await fetchSheet(currentUser);
        await initSelectors(sheetCache);
        document.getElementById('week-select').onchange = updateView;
        document.getElementById('day-select').onchange = updateView;
        updateView();
      } catch (err) {
        console.error('Failed to load sheet:', err);
        document.getElementById('exercise-list').innerHTML = '<p class="text-center text-red-500">Failed to load sheet.</p>';
      }
    });
  });
});
