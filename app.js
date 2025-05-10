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
