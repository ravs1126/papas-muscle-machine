// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

let currentUser = null;
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  deferredPrompt.prompt();
});

function urlFor(tab) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
         `/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
}

function fetchSheet(tab) {
  return fetch(urlFor(tab))
    .then(res => res.json())
    .then(json => json.values || []);
}

function initSelectors() {
  const wSel = document.getElementById('week-select');
  const dSel = document.getElementById('day-select');
  wSel.innerHTML = '';
  dSel.innerHTML = '';

  // Only one sheet per user now
  wSel.append(new Option("N/A", "N/A"));

  ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7']
    .forEach(d => dSel.append(new Option(d, d)));
}

function extractDay(rows, label) {
  const start = rows.findIndex(r => typeof r[2] === 'string' && r[2].trim().startsWith(label));
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < rows.length; i++) {
    if (typeof rows[i][2] === 'string' && /^Day\s*\d+/.test(rows[i][2].trim())) break;
    if (rows[i].some(c => c !== '')) out.push({ index: i, values: rows[i] });
  }
  return out;
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
  const filtered = entries.filter(e => typeof e.values[2] === 'string' && e.values[2].toLowerCase().trim() !== 'execuse');
  const container = document.getElementById('exercise-list');
  container.innerHTML = '';
  if (!filtered.length) {
    container.innerHTML = '<p class="text-center text-gray-500">No exercises for this day.</p>';
    return;
  }
  const tpl = document.getElementById('exercise-card-template').content;
  filtered.forEach(e => {
    const [,,name = '', wt = '', r1 = '', r2 = '', r3 = '', r4 = '', pump = '', healed = '', pain = ''] = e.values;
    const clone = document.importNode(tpl, true);
    const nameEl = clone.querySelector('.exercise-name');
    if (nameEl) nameEl.textContent = name;
    const rowNum = e.index + 1;
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
    container.appendChild(clone);
  });
  attachInputs(sheetName);
}

async function updateView() {
  if (!currentUser) return;
  try {
    const day = document.getElementById('day-select').value;
    const sheetName = currentUser;
    const all = await fetchSheet(sheetName);
    renderExercises(extractDay(all, day), sheetName);
  } catch (err) {
    console.error(err);
    document.getElementById('exercise-list').innerHTML = '<p class="text-center text-red-500">Error loading data.</p>';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('login-screen');
  const mainContent = document.getElementById('main-content');
  loginScreen.querySelectorAll('button[data-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentUser = btn.dataset.user;
      loginScreen.style.display = 'none';
      mainContent.style.display = 'block';
      initSelectors();
      document.getElementById('week-select').onchange = updateView;
      document.getElementById('day-select').onchange = updateView;
      updateView();
    });
  });
});
