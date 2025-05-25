const SIZE = 10;
const DELETED = Symbol('deleted');
let table = Array(SIZE).fill(null);
let lastInsertedIdx = null;
let history = []; // For undo

// Stats
let totalCollisions = 0;
let totalProbes = 0;
let lastProbes = 0;
let lastCollisions = 0;

// Step-by-step animation state
let stepMode = false;
let stepData = null;
let stepTimer = null;
let stepAuto = false;

// Dark mode toggle
const darkModeBtn = document.getElementById('darkModeToggle');
darkModeBtn.onclick = function() {
  document.body.classList.toggle('dark-mode');
  darkModeBtn.textContent = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
};

// About toggle
const aboutToggle = document.getElementById('aboutToggle');
const aboutInfo = document.getElementById('aboutInfo');
aboutToggle.onclick = function() {
  aboutInfo.classList.toggle('hide');
  aboutToggle.setAttribute('aria-label', aboutInfo.classList.contains('hide') ? 'Show about hashing' : 'Hide about hashing');
  aboutToggle.setAttribute('title', aboutInfo.classList.contains('hide') ? 'Show about hashing' : 'Hide about hashing');
};

// Help/instructions toggle
const helpToggle = document.getElementById('helpToggle');
const helpContent = document.getElementById('helpContent');
helpToggle.onclick = function() {
  helpContent.classList.toggle('active');
  helpToggle.setAttribute('aria-label', helpContent.classList.contains('active') ? 'Hide instructions' : 'Show instructions');
  helpToggle.setAttribute('title', helpContent.classList.contains('active') ? 'Hide instructions' : 'Show instructions');
};

function hash(val) { return val % SIZE; }
function hash2(val) { return 1 + (val % (SIZE - 1)); }
function quadratic(val, i) { return (hash(val) + i * i) % SIZE; }
function getMethod() {
  return document.getElementById('collisionMethod').value;
}

function renderTable(highlightIdx = null, foundIdx = null, deletedIdx = null, insertedIdx = null, currentStepIdx = null, pulseIdx = null, shakeIdx = null) {
  const tbl = document.getElementById('hashTable');
  tbl.innerHTML = '';
  // Header row: indices
  let header = '<tr><th>Index</th>';
  for (let i = 0; i < SIZE; i++) header += `<th>${i}</th>`;
  header += '</tr>';
  // Data row: values
  let row = '<tr><th>Value</th>';
  for (let i = 0; i < SIZE; i++) {
    let tdClass = '';
    if (i === highlightIdx) tdClass = 'highlight';
    if (i === foundIdx) tdClass = 'found';
    if (i === deletedIdx) tdClass = 'deleted';
    if (i === currentStepIdx) tdClass += ' current-step';
    if (i === pulseIdx) tdClass += ' pulse';
    if (i === shakeIdx) tdClass += ' shake';
    if (table[i] === DELETED) tdClass += ' deleted-slot';
    let indicator = '';
    if (i === insertedIdx) {
      indicator = `<span class="inserted-indicator" title="Inserted here">✔️</span>`;
    }
    let valDisplay = table[i] === DELETED ? '' : (table[i] !== null ? table[i] : '');
    row += `<td class="${tdClass.trim()}" style="position:relative;" data-idx="${i}">${valDisplay}${indicator}</td>`;
  }
  row += '</tr>';
  tbl.innerHTML = header + row;
  renderSortedArray();
  addCellTooltips();
}

function renderSortedArray() {
  const sortedTable = document.getElementById('sortedArrayTable');
  const sorted = table.filter(x => x !== null && x !== DELETED).sort((a, b) => a - b);
  let header = '<tr><th>Index</th>';
  let row = '<tr><th>Value</th>';
  for (let i = 0; i < sorted.length; i++) {
    header += `<th>${i}</th>`;
    row += `<td>${sorted[i]}</td>`;
  }
  header += '</tr>';
  row += '</tr>';
  sortedTable.innerHTML = sorted.length ? (header + row) : '<tr><td style="text-align:center;" colspan="11">No values to display</td></tr>';
}

function renderStats() {
  const stats = document.getElementById('statsPanel');
  const loadFactor = (table.filter(x => x !== null && x !== DELETED).length / SIZE * 100).toFixed(1);
  stats.innerHTML = `
    <b>Statistics:</b>
    <ul>
      <li>Total Collisions: <b>${totalCollisions}</b></li>
      <li>Total Probes: <b>${totalProbes}</b></li>
      <li>Last Operation Collisions: <b>${lastCollisions}</b></li>
      <li>Last Operation Probes: <b>${lastProbes}</b></li>
      <li>Load Factor: <b>${loadFactor}%</b></li>
    </ul>
  `;
  renderLoadBar(loadFactor);
}

function renderLoadBar(loadFactor) {
  const bar = document.getElementById('loadBar');
  const label = document.getElementById('loadBarLabel');
  bar.style.width = `${loadFactor}%`;
  label.textContent = `Load: ${loadFactor}%`;
}

function renderProbingSequence(seq, currentStepIdx = null) {
  const probeDiv = document.getElementById('probingSequence');
  if (!seq || seq.length === 0) {
    probeDiv.innerHTML = '';
    return;
  }
  probeDiv.innerHTML = `<b>Probing Sequence:</b> ${seq.map((i, idx) =>
    `<span style="display:inline-block;min-width:32px;${idx === currentStepIdx ? 'font-weight:bold;text-decoration:underline;' : ''}">${i}</span>`
  ).join(' → ')}`;
}

function showFormula(val) {
  if (isNaN(val)) {
    document.getElementById('hashFormula').textContent = '';
    return;
  }
  const method = getMethod();
  const h1 = hash(val);
  let formula = `Hash formula: <span>hash(${val}) = ${val} % ${SIZE} = ${h1}</span>`;
  if (method === 'double') {
    const h2 = hash2(val);
    formula += `<br>Double Hash step: <span>hash2(${val}) = 1 + (${val} % ${SIZE - 1}) = ${h2}</span>`;
  }
  if (method === 'quadratic') {
    formula += `<br>Quadratic Probing: <span>hash(${val}, i) = (${val} % ${SIZE} + i<sup>2</sup>) % ${SIZE}</span>`;
  }
  document.getElementById('hashFormula').innerHTML = formula;
}

// Step-by-step logic
function startInsert() {
  const val = parseInt(document.getElementById('inputValue').value);
  showFormula(val);
  if (isNaN(val)) return;
  saveHistory();
  let idx = getInsertIndex(val);
  if (idx !== null) {
    animateDotToIndex(idx);
    setTimeout(clearDot, 700);
    drawArrowToIndex(idx);
    setTimeout(clearArrow, 1000);
  }
  prepareStep('insert', val);
  clearInputAndArrow();
}
function startSearch() {
  const val = parseInt(document.getElementById('inputValue').value);
  showFormula(val);
  if (isNaN(val)) return;
  // Only use animated search, not step-by-step for this button
  animatedSearch(val);
  clearInputAndArrow();
}
function startRemove() {
  const val = parseInt(document.getElementById('inputValue').value);
  showFormula(val);
  if (isNaN(val)) return;
  saveHistory();
  let idx = getSearchIndex(val);
  if (idx !== null) {
    animateDotToIndex(idx);
    setTimeout(clearDot, 700);
    drawArrowToIndex(idx);
    setTimeout(clearArrow, 1000);
  }
  prepareStep('remove', val);
  clearInputAndArrow();
}

// Helper to get the index where value would be inserted (for arrow)
function getInsertIndex(val) {
  let method = getMethod();
  let start = hash(val);
  let h2 = hash2(val);
  let firstDeleted = null;
  for (let i = 0; i < SIZE; i++) {
    let idx;
    if (method === 'linear') idx = (start + i) % SIZE;
    else if (method === 'double') idx = (start + i * h2) % SIZE;
    else idx = (start + i * i) % SIZE;
    if (table[idx] === null) return firstDeleted !== null ? firstDeleted : idx;
    if (table[idx] === DELETED && firstDeleted === null) firstDeleted = idx;
  }
  return firstDeleted;
}
// Helper to get the index where value would be found (for arrow)
function getSearchIndex(val) {
  let method = getMethod();
  let start = hash(val);
  let h2 = hash2(val);
  for (let i = 0; i < SIZE; i++) {
    let idx;
    if (method === 'linear') idx = (start + i) % SIZE;
    else if (method === 'double') idx = (start + i * h2) % SIZE;
    else idx = (start + i * i) % SIZE;
    if (table[idx] === val) return idx;
    if (table[idx] === null) return idx;
  }
  return null;
}

function prepareStep(type, val) {
  stepMode = true;
  stepData = {
    type,
    val,
    method: getMethod(),
    i: 0,
    seq: [],
    done: false,
    found: false,
    inserted: false,
    deleted: false,
    idx: null,
    start: null,
    h2: null,
    probes: 0,
    collisions: 0,
    lastPulse: null,
    lastShake: null
  };
  if (stepData.method === 'double') stepData.h2 = hash2(val);
  stepData.start = hash(val);
  stepData.idx = stepData.start;
  enableStepControls(true);
  stepStep(); // Show first step
}

function stepStep() {
  if (!stepMode || !stepData || stepData.done) return;
  let {type, val, method, i, start, h2} = stepData;
  let idx;
  if (method === 'linear') {
    idx = (start + i) % SIZE;
  } else if (method === 'double') {
    idx = (start + i * h2) % SIZE;
  } else if (method === 'quadratic') {
    idx = (start + i * i) % SIZE;
  }
  stepData.idx = idx;
  stepData.seq.push(idx);
  stepData.probes++;
  let highlight = idx, found = null, deleted = null, inserted = null;
  let msg = '';
  let pulseIdx = idx, shakeIdx = null;
  if (type === 'insert') {
    animateDotToIndex(idx);
    setTimeout(clearDot, 700);
    if (table[idx] === null || table[idx] === DELETED) {
      table[idx] = val;
      inserted = idx;
      lastInsertedIdx = idx;
      msg = `Inserted ${val} at index ${idx}`;
      stepData.done = true;
      stepData.inserted = true;
      animateCell(idx, 'fadein');
    } else {
      stepData.collisions++;
      shakeIdx = idx;
      animateCell(idx, 'shake');
      if (stepData.probes >= SIZE) {
        msg = 'Table is full!';
        stepData.done = true;
      }
    }
  } else if (type === 'search') {
    animateDotToIndex(idx);
    setTimeout(clearDot, 700);
    if (table[idx] === val) {
      found = idx;
      msg = `Found ${val} at index ${idx}`;
      stepData.done = true;
      animateCell(idx, 'pulse');
    } else if (table[idx] === null) {
      msg = `${val} not found!`;
      stepData.done = true;
      animateCell(idx, 'shake');
    }
    // If table[idx] === DELETED, continue probing
  } else if (type === 'remove') {
    animateDotToIndex(idx);
    setTimeout(clearDot, 700);
    if (table[idx] === val) {
      table[idx] = DELETED;
      deleted = idx;
      msg = `Deleted ${val} from index ${idx}`;
      stepData.done = true;
      stepData.deleted = true;
      animateCell(idx, 'fadeout');
    } else if (table[idx] === null) {
      msg = `${val} not found!`;
      stepData.done = true;
      animateCell(idx, 'shake');
    }
    // If table[idx] === DELETED, continue probing
  }
  renderTable(highlight, found, deleted, inserted, idx, pulseIdx, shakeIdx);
  renderProbingSequence(stepData.seq, stepData.i);
  document.getElementById('message').textContent = msg;
  lastProbes = stepData.probes;
  lastCollisions = stepData.collisions;
  if (stepData.done) {
    totalCollisions += stepData.collisions;
    totalProbes += stepData.probes;
    enableStepControls(false);
    setTimeout(() => {
      lastInsertedIdx = null;
      renderTable();
      renderStats();
      clearArrow();
      clearDot();
    }, 1200);
  }
  renderStats();
}

function stepNext() {
  if (!stepMode || !stepData || stepData.done) return;
  stepData.i++;
  stepStep();
}
function stepPrev() {
  if (!stepMode || !stepData || stepData.i === 0) return;
  // Undo last step (for insert, remove, search)
  if (stepData.type === 'insert' && stepData.inserted) {
    table[stepData.idx] = null;
    lastInsertedIdx = null;
  }
  if (stepData.type === 'remove' && stepData.deleted) {
    table[stepData.idx] = stepData.val;
  }
  stepData.seq.pop();
  stepData.i--;
  stepData.done = false;
  stepData.inserted = false;
  stepData.deleted = false;
  stepData.found = false;
  stepData.probes--;
  stepStep();
}
function toggleAuto() {
  if (!stepMode || !stepData || stepData.done) return;
  stepAuto = !stepAuto;
  document.getElementById('stepAuto').textContent = stepAuto ? 'Pause' : 'Auto';
  if (stepAuto) {
    stepTimer = setInterval(() => {
      if (!stepMode || !stepData || stepData.done) {
        clearInterval(stepTimer);
        stepAuto = false;
        document.getElementById('stepAuto').textContent = 'Auto';
        return;
      }
      stepNext();
    }, 700);
  } else {
    clearInterval(stepTimer);
  }
}
function stopStep() {
  stepMode = false;
  stepData = null;
  stepAuto = false;
  clearInterval(stepTimer);
  enableStepControls(false);
  document.getElementById('probingSequence').innerHTML = '';
  document.getElementById('message').textContent = '';
  renderTable();
  renderStats();
  clearArrow();
  clearDot();
}
function enableStepControls(enable) {
  document.getElementById('stepPrev').disabled = !enable;
  document.getElementById('stepNext').disabled = !enable;
  document.getElementById('stepAuto').disabled = !enable;
  document.getElementById('stepStop').disabled = !enable;
}

function resetTable() {
  table = Array(SIZE).fill(null);
  document.getElementById('message').textContent = '';
  document.getElementById('hashFormula').textContent = '';
  document.getElementById('inputValue').value = '';
  lastInsertedIdx = null;
  stepMode = false;
  stepData = null;
  stepAuto = false;
  clearInterval(stepTimer);
  enableStepControls(false);
  document.getElementById('probingSequence').innerHTML = '';
  totalCollisions = 0;
  totalProbes = 0;
  lastProbes = 0;
  lastCollisions = 0;
  history = [];
  renderTable();
  renderStats();
  clearArrow();
  clearDot();
}

// Undo functionality
function saveHistory() {
  history.push([...table]);
  if (history.length > 20) history.shift();
}
function undo() {
  if (history.length === 0) return;
  table = history.pop();
  renderTable();
  renderStats();
  document.getElementById('message').textContent = 'Undid last action.';
  clearArrow();
  clearDot();
}

// --- Operation History Panel ---
const historyLog = document.getElementById('historyLog');
const historyPanel = document.getElementById('historyPanel');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
let opHistory = [];

function addHistoryEntry(type, value, result, extra = '') {
  const now = new Date();
  const time = now.toLocaleTimeString();
  let color = type === 'insert' ? '#22c55e' : type === 'delete' ? '#ef4444' : '#A51C30';
  let icon = type === 'insert' ? '➕' : type === 'delete' ? '🗑️' : '🔍';
  let entry = `<div class="history-entry">
    <span style="color:${color}">${icon}</span>
    <span>[${time}]</span>
    <b>${type.charAt(0).toUpperCase() + type.slice(1)}</b>
    <span>Value: <b>${value}</b></span>
    <span>${result}</span>
    ${extra}
  </div>`;
  opHistory.push(entry);
  if (opHistory.length > 50) opHistory.shift();
  historyLog.innerHTML = opHistory.slice().reverse().join('');
}
clearHistoryBtn.onclick = function() {
  opHistory = [];
  historyLog.innerHTML = '';
};

// --- Share/Embed Panel ---
const shareBtn = document.getElementById('shareBtn');
const embedBtn = document.getElementById('embedBtn');
const shareInput = document.getElementById('shareInput');

shareBtn.onclick = function() {
  const url = makeShareUrl();
  shareInput.style.display = 'inline-block';
  shareInput.value = url;
  shareInput.select();
  document.execCommand('copy');
  shareInput.blur();
  shareBtn.textContent = '✅ Copied!';
  setTimeout(() => { shareBtn.textContent = '🔗 Share'; shareInput.style.display = 'none'; }, 1200);
};
embedBtn.onclick = function() {
  const url = makeShareUrl();
  const code = `<iframe src="${url}" width="900" height="600" style="border:none;"></iframe>`;
  shareInput.style.display = 'inline-block';
  shareInput.value = code;
  shareInput.select();
  document.execCommand('copy');
  shareInput.blur();
  embedBtn.textContent = '✅ Copied!';
  setTimeout(() => { embedBtn.textContent = '</> Embed'; shareInput.style.display = 'none'; }, 1200);
};
function makeShareUrl() {
  // Encode table state as a string
  const state = table.map(x => x === null ? '' : x === DELETED ? 'X' : x).join(',');
  const params = new URLSearchParams({ state });
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

// --- Load state from URL if present ---
(function loadStateFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has('state')) {
    const arr = params.get('state').split(',');
    table = arr.map(x => x === '' ? null : x === 'X' ? DELETED : parseInt(x));
  }
})();

// --- Add history logging to operations ---
function logOperation(type, value, result, extra = '') {
  addHistoryEntry(type, value, result, extra);
}

// --- Patch stepStep to log operations ---
const origStepStep = stepStep;
stepStep = function() {
  if (!stepMode || !stepData || stepData.done) return;
  let prevTable = [...table];
  origStepStep.apply(this, arguments);
  // Only log when operation is done
  if (stepData && stepData.done) {
    let type = stepData.type;
    let val = stepData.val;
    let msg = document.getElementById('message').textContent;
    logOperation(type, val, msg);
  }
};

// Patch resetTable and undo to log
const origResetTable = resetTable;
resetTable = function() {
  origResetTable.apply(this, arguments);
  logOperation('reset', '', 'Table reset');
};
const origUndo = undo;
undo = function() {
  origUndo.apply(this, arguments);
  logOperation('undo', '', 'Undo last action');
};

// Show formula as user types or method changes
document.getElementById('inputValue').addEventListener('input', e => {
  showFormula(parseInt(e.target.value));
});
document.getElementById('collisionMethod').addEventListener('change', () => {
  const val = parseInt(document.getElementById('inputValue').value);
  showFormula(val);
});

// Clear input and arrow after action
function clearInputAndArrow() {
  document.getElementById('inputValue').value = '';
  // Don't clear arrow/dot immediately, let them animate for a moment
}

// Arrow animation from input to table index
function drawArrowToIndex(idx) {
  const input = document.getElementById('inputValue');
  const tableCell = document.querySelector(`#hashTable td[data-idx="${idx}"]`);
  const arrowContainer = document.getElementById('arrowContainer');
  arrowContainer.innerHTML = '';
  if (!input || !tableCell) return;

  // Get bounding rectangles
  const inputRect = input.getBoundingClientRect();
  const cellRect = tableCell.getBoundingClientRect();
  const containerRect = arrowContainer.getBoundingClientRect();

  // Calculate start and end points relative to arrowContainer
  const startX = inputRect.left + inputRect.width / 2 - containerRect.left;
  const startY = inputRect.bottom - containerRect.top;
  const endX = cellRect.left + cellRect.width / 2 - containerRect.left;
  const endY = cellRect.top - containerRect.top + 10;

  // SVG arrow
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("arrow-svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "40");
  svg.setAttribute("style", "overflow:visible;");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M${startX},${startY} Q${startX},${startY + 30} ${(startX + endX) / 2},${(startY + endY) / 2} T${endX},${endY}`);
  path.setAttribute("stroke", "#A51C30");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("fill", "none");
  path.setAttribute("marker-end", "url(#arrowhead)");

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("refX", "10");
  marker.setAttribute("refY", "3.5");
  marker.setAttribute("orient", "auto");
  marker.innerHTML = `<polygon points="0 0, 10 3.5, 0 7" fill="#A51C30"/>`;

  svg.appendChild(marker);
  svg.appendChild(path);
  svg.innerHTML += `<defs></defs>`;
  svg.querySelector("defs")?.appendChild(marker);

  arrowContainer.appendChild(svg);
}
function clearArrow() {
  document.getElementById('arrowContainer').innerHTML = '';
}

// Dot animation along the path
function animateDotToIndex(idx) {
  const input = document.getElementById('inputValue');
  const tableCell = document.querySelector(`#hashTable td[data-idx="${idx}"]`);
  const dotContainer = document.getElementById('dotContainer');
  dotContainer.innerHTML = '';
  if (!input || !tableCell) return;

  const inputRect = input.getBoundingClientRect();
  const cellRect = tableCell.getBoundingClientRect();
  const containerRect = dotContainer.getBoundingClientRect();

  const startX = inputRect.left + inputRect.width / 2 - containerRect.left;
  const startY = inputRect.bottom - containerRect.top;
  const endX = cellRect.left + cellRect.width / 2 - containerRect.left;
  const endY = cellRect.top - containerRect.top + 10;

  const dot = document.createElement('div');
  dot.className = 'dot';
  dot.style.left = `${startX}px`;
  dot.style.top = `${startY}px`;
  dotContainer.appendChild(dot);

  // Animate dot
  dot.animate([
    { left: `${startX}px`, top: `${startY}px`, opacity: 0 },
    { left: `${(startX + endX) / 2}px`, top: `${(startY + endY) / 2}px`, opacity: 1 },
    { left: `${endX}px`, top: `${endY}px`, opacity: 1 },
    { left: `${endX}px`, top: `${endY}px`, opacity: 0 }
  ], {
    duration: 700,
    easing: 'ease-in-out'
  });
  setTimeout(() => { dotContainer.innerHTML = ''; }, 700);
}
function clearDot() {
  document.getElementById('dotContainer').innerHTML = '';
}

// Animate cell with a class
function animateCell(idx, animClass) {
  const cell = document.querySelector(`#hashTable td[data-idx="${idx}"]`);
  if (!cell) return;
  cell.classList.add(animClass);
  setTimeout(() => cell.classList.remove(animClass), 700);
}

// Tooltip on hover
function addCellTooltips() {
  document.querySelectorAll('#hashTable td').forEach(td => {
    td.onmouseenter = function(e) {
      const idx = parseInt(td.getAttribute('data-idx'));
      let formula = '';
      const method = getMethod();
      if (method === 'linear') {
        formula = `(${idx} - value % ${SIZE} + ${SIZE}) % ${SIZE}`;
      } else if (method === 'double') {
        formula = `(${idx} - value % ${SIZE} + ${SIZE}) % ${SIZE} / step=${hash2(idx)}`;
      } else {
        formula = `(${idx} - value % ${SIZE} + ${SIZE}) % ${SIZE} / i²`;
      }
      showTooltip(td, `Index: ${idx}<br>Formula: ${formula}`);
    };
    td.onmouseleave = function() {
      hideTooltip();
    };
  });
}
function showTooltip(target, html) {
  let tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.innerHTML = html;
  document.body.appendChild(tooltip);
  const rect = target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
  tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
}
function hideTooltip() {
  document.querySelectorAll('.tooltip').forEach(t => t.remove());
}

// Initial render
renderTable();
renderStats();
enableStepControls(false);

// --- New animated search function ---
function animatedSearch(val) {
  const method = getMethod();
  const start = hash(val);
  const h2 = hash2(val);
  let i = 0;
  let interval = 500; // ms between steps

  function getIdx(i) {
    if (method === 'linear') return (start + i) % SIZE;
    if (method === 'double') return (start + i * h2) % SIZE;
    return (start + i * i) % SIZE;
  }

  function step() {
    if (i >= SIZE) {
      document.getElementById('message').textContent = `${val} not found!`;
      renderTable();
      return;
    }
    const idx = getIdx(i);
    renderTable(idx); // highlight current cell
    animateDotToIndex(idx);

    // Wait, then check value
    setTimeout(() => {
      if (table[idx] === val) {
        renderTable(null, idx); // highlight as found
        document.getElementById('message').textContent = `Found ${val} at index ${idx}`;
        return;
      } else if (table[idx] === null) {
        renderTable();
        document.getElementById('message').textContent = `${val} not found!`;
        return;
      } else {
        i++;
        step();
      }
    }, interval);
  }

  step();
}