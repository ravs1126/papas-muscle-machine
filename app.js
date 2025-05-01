// ─── CONFIG ───
const WRITE_URL = 'https://script.google.com/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec';
const SHEET_ID  = '1VX4J2xy887awfpTbUrYTqbGCJiaHXCBRJ6kcW31HTaw';
const API_KEY   = 'AIzaSyA23e0btCLiuyAddQLN0doOREr3tdzPC0I';

// Build the Sheets API URL for a data range
function urlFor(tab) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
         `/values/${encodeURIComponent(tab)}?key=${API_KEY}`;
}

// URL to fetch sheet metadata (titles)
function metadataUrl() {
  return `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
         `?fields=sheets(properties(title))&key=${API_KEY}`;
}

// Fetch sheet names dynamically
async function fetchSheetNames() {
  const res = await fetch(metadataUrl());
  if (!res.ok) throw new Error(`Metadata API error: ${res.status}`);
  const json = await res.json();
  return json.sheets.map(s => s.properties.title);
}

// Fetch all rows from a sheet tab
async function fetchSheet(tab) {
  const url = urlFor(tab);
  console.log('Fetching:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

// Initialize Week & Day selectors dynamically
async function initSelectors() {
  const wSel = document.getElementById('week-select');
  const dSel = document.getElementById('day-select');
  // Days static
  ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7']
    .forEach(d => dSel.append(new Option(d, d)));
  // Weeks dynamic
  try {
    const titles = await fetchSheetNames();
    // Filter and sort "Week X" titles
    const weeks = titles
      .filter(t => /^Week\s+\d+$/i.test(t))
      .sort((a,b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    weeks.forEach(w => wSel.append(new Option(w, w)));
  } catch (err) {
    console.error('Failed to load sheet names:', err);
    // Fallback: static list
    ['Week 1','Week 2','Week 3','Week 4']
      .forEach(w => wSel.append(new Option(w, w)));
  }
}

// Extract the block of rows for the chosen day
function extractDay(rows, label) {
  const start = rows.findIndex(r => typeof r[0]==='string' && r[0].trim().startsWith(label));
  if (start<0) return [];
  const out = [];
  for (let i=start+1;i<rows.length;i++){
    if (typeof rows[i][0]==='string' && /^Day\s*\d+/.test(rows[i][0].trim())) break;
    if (rows[i].some(c=>c!=='')) out.push({index:i,values:rows[i]});
  }
  return out;
}

// Attach change listeners to inputs with no-cors
function attachInputs() {
  document.querySelectorAll(
    '.name-input, .weight-input, .reps1-input, .reps2-input, .reps3-input, .reps4-input, .pump-input, .healed-input, .pain-input'
  ).forEach(input => {
    input.addEventListener('change', async e => {
      const {sheet,row,col} = e.target.dataset;
      const value = e.target.value;
      try {
        await fetch(WRITE_URL, { method:'POST', mode:'no-cors', body:JSON.stringify({sheet,cell:`${col}${row}`,value}) });
        console.log(`✔ Updated ${sheet}!${col}${row} → ${value}`);
      } catch(err) {
        console.error(err);
        alert('Save failed—see console.');
      }
    });
  });
}

// Render the exercise cards into the DOM
function renderExercises(entries) {
  // entries: [{index,values}]
  const filtered = entries.filter(e=> typeof e.values[0]==='string' && e.values[0].toLowerCase().trim()!=='execuse');
  const container = document.getElementById('exercise-list');
  container.innerHTML='';
  if (!filtered.length) {
    container.innerHTML='<p class="text-center text-gray-500">No exercises for this day.</p>';
    return;
  }
  const tpl= document.getElementById('exercise-card-template').content;
  const week=document.getElementById('week-select').value;
  filtered.forEach(e=>{
    const [name='',wt='',r1='',r2='',r3='',r4='',pump='',healed='',pain='']=e.values;
    const clone=document.importNode(tpl,true);
    const nameEl=clone.querySelector('.exercise-name'); if(nameEl) nameEl.textContent=name;
    const rowNum=e.index+1;
    function bind(sel,val,col){const inp=clone.querySelector(sel);if(!inp)return;inp.value=val;inp.dataset.sheet=week;inp.dataset.row=rowNum;inp.dataset.col=col;}
    bind('.name-input',  name, 'A');bind('.weight-input',wt,'B');bind('.reps1-input',r1,'C');bind('.reps2-input',r2,'D');bind('.reps3-input',r3,'E');bind('.reps4-input',r4,'F');bind('.pump-input',pump,'G');bind('.healed-input',healed,'H');bind('.pain-input',pain,'I');
    container.appendChild(clone);
  });
  attachInputs();
}

// Fetch + render when selection changes
async function updateView() {
  try {
    const week=document.getElementById('week-select').value;
    const day =document.getElementById('day-select').value;
    const all =await fetchSheet(week);
    renderExercises(extractDay(all,day));
  } catch(err){
    console.error(err);
    document.getElementById('exercise-list').innerHTML='<p class="text-center text-red-500">Error loading data.</p>';
  }
}

// Bootstrap
(async()=>{
  await initSelectors();
  document.getElementById('week-select').addEventListener('change',updateView);
  document.getElementById('day-select').addEventListener('change',updateView);
  await updateView();
})();
