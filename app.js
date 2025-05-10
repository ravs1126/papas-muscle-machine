// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

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

function extractDay(week, day) {
  return sheetCache
    .map((row, i) => ({ index: i + 2, values: row }))
    .filter(entry =>
      entry.values[0] == week &&
      entry.values[1] == day &&
      typeof entry.values[2] === 'string' &&
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
    const values = e.values;
    const rowNum = e.index;

    // Catch bad rows early
    if (!values || values.length < 11 || typeof values[2] !== 'string' || values[2].trim() === '') return;

    const name   = values[2] || '';
    const wt     = values[3] || '';
    const r1     = values[4] || '';
    const r2     = values[5] || '';
    const r3     = values[6] || '';
    const r4     = values[7] || '';
    const pump   = values[8] || '';
    const healed = values[9] || '';
    const pain   = values[10] || '';
    const setCountFromQ = values.length > 16 ? parseInt(values[16]) || 3 : 3;

    const repsMap = [r1, r2, r3, r4];
    const colMap  = ['E', 'F', 'G', 'H'];

    const allZero = repsMap.every(r => parseFloat(r) === 0 || r === '' || r === null);
    let numSets = allZero
      ? setCountFromQ
      : repsMap.filter(r => !isNaN(parseFloat(r)) && parseFloat(r) > 0).length;

    if (numSets === 0) numSets = 3;

    const clone = document.importNode(tpl, true);
    const nameEl = clone.querySelector('.exercise-name');
    if (nameEl) nameEl.textContent = name;

    function bind(sel, val, col) {
      const inp = clone.querySelector(sel);
      if (!inp) return;
      inp.value = val;
      inp.dataset.row = rowNum;
      inp.dataset.col = col;
    }

    bind('.name-input', name, 'C');
    bind('.weight-input', wt, 'D');
    bind('.pump-input', pump, 'I');
    bind('.healed-input', healed, 'J');
    bind('.pain-input', pain, 'K');

    for (let i = 0; i < 4; i++) {
      const input = clone.querySelector(`.reps${i + 1}-input`);
      const wrapper = input?.closest('div');
      if (i < numSets) {
        if (input) {
          input.value = repsMap[i];
          input.dataset.row = rowNum;
          input.dataset.col = colMap[i];
        }
      } else if (wrapper) {
        wrapper.remove();
      }
    }

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

window.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');

  loginScreen.querySelectorAll('button[data-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;

      try {
        const fullSheet = await fetchSheet(currentUser);
        if (!fullSheet || fullSheet.length <= 1) throw new Error("Sheet is empty or missing header.");

        sheetCache = fullSheet.slice(1);
        await initSelectors(sheetCache);

        loginScreen.style.display = 'none';
        mainContent.style.display = 'block';

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
