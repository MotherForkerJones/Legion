const output = document.getElementById('console-output');
const form = document.getElementById('command-form');
const input = document.getElementById('prompt-input');
const sendButton = document.getElementById('send-button');
const status = document.getElementById('run-status');
const healthLabel = document.getElementById('health-label');
const tokenInput = document.getElementById('token-input');
const dialog = document.getElementById('settings-dialog');
const planchetteText = document.getElementById('planchette-text');
const stationLog = document.getElementById('station-log');
const missionList = document.getElementById('mission-list');
const queueCount = document.getElementById('queue-count');
const queueMeter = document.getElementById('queue-meter-fill');
let activeRuns = 0;

function token() { return sessionStorage.getItem('legion-token') || ''; }
function addLine(kind, text) {
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `<span class="kind">[ ${kind} ]</span> ${escapeHtml(String(text))}`;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}
function stationMessage(message, active = false) {
  if (!stationLog) return;
  const row = document.createElement('div'); if (active) row.className = 'active-log';
  row.innerHTML = `<time>NOW</time><span>${escapeHtml(message)}</span>`; stationLog.prepend(row);
  while (stationLog.children.length > 12) stationLog.lastElementChild.remove();
}
function setCrewStatus(agentId, state) {
  const card = document.querySelector(`.crew-card[data-crew="${agentId}"]`); if (!card) return;
  const statusText = card.querySelector('em'); const detail = card.querySelector('small');
  card.classList.toggle('active', state === 'WORKING'); if (statusText) statusText.textContent = state === 'WORKING' ? 'WORKING' : 'READY';
  if (detail) detail.textContent = detail.textContent.replace(/ · (STANDBY|WORKING|READY)$/, ` · ${state}`);
}
function queueMission(agentId, prompt) {
  if (!missionList) return null;
  if (missionList.querySelector('.empty-mission')) missionList.innerHTML = '';
  const item = document.createElement('div'); item.className = 'mission-item'; item.dataset.agent = agentId;
  item.innerHTML = `<time>ACTIVE // ${escapeHtml(agentId.toUpperCase())}</time><span>${escapeHtml(prompt.slice(0, 78))}</span>`; missionList.prepend(item);
  activeRuns += 1; if (queueCount) queueCount.textContent = String(activeRuns).padStart(2, '0'); if (queueMeter) queueMeter.style.width = `${Math.min(activeRuns * 25, 100)}%`;
  return item;
}
function finishMission(item, agentId, success) {
  if (item) { item.classList.add('complete'); item.querySelector('time').textContent = success ? 'COMPLETE' : 'FAILED'; }
  activeRuns = Math.max(0, activeRuns - 1); if (queueCount) queueCount.textContent = String(activeRuns).padStart(2, '0'); if (queueMeter) queueMeter.style.width = `${Math.min(activeRuns * 25, 100)}%`;
  setCrewStatus(agentId, 'READY');
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character])); }
function setBusy(busy) { sendButton.disabled = busy; input.disabled = busy; status.textContent = busy ? 'DESCENDING' : 'STANDBY'; status.style.color = busy ? 'var(--red)' : 'var(--muted)'; }
function updatePlanchette() { if (planchetteText) planchetteText.textContent = input.value ? input.value.slice(-22).toUpperCase() : 'TYPE YOUR PETITION'; }

async function checkHealth() {
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('offline');
    healthLabel.textContent = 'THRONE LINKED';
    healthLabel.style.color = 'var(--green)';
  } catch (_) { healthLabel.textContent = 'GATEWAY OFFLINE'; healthLabel.style.color = 'var(--red)'; }
}
async function runTask(prompt, agentId = 'chorus') {
  if (!prompt || sendButton.disabled) return;
  if (!token()) { dialog.showModal(); tokenInput.focus(); return; }
  setBusy(true); addLine('you', prompt); setCrewStatus(agentId, 'WORKING'); const mission = queueMission(agentId, prompt); stationMessage(`Lucifer routed ${agentId.toUpperCase()} into the maze.`, true); window.LegionWorld?.activate(agentId, prompt);
  let succeeded = false;
  try {
    const response = await fetch('/run', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`}, body:JSON.stringify({prompt, max_turns:6})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Gateway rejected the task');
    succeeded = true;
    (data.events || []).forEach(event => {
      if (event.kind === 'answer') addLine('lucifer', event.payload.content);
      else if (event.kind === 'act') addLine(event.payload.tool || 'act', JSON.stringify(event.payload.result));
      else if (event.kind === 'limit') addLine('limit', `Turn limit reached: ${event.payload.max_turns}`);
    });
  } catch (error) { addLine('error', error.message); stationMessage(`The run failed: ${error.message}`); }
  finally { finishMission(mission, agentId, succeeded); stationMessage(succeeded ? `${agentId.toUpperCase()} returned with a result.` : `${agentId.toUpperCase()} returned without a result.`); setBusy(false); window.LegionWorld?.clear(); }
}
function appendBoardValue(value) { if (!sendButton.disabled) { input.value += value; updatePlanchette(); input.focus(); } }
const boardLetters = document.getElementById('board-letters');
if (boardLetters) {
  'ABCDEFGHIJKLM'.split('').forEach(letter => { const key=document.createElement('button'); key.type='button'; key.className='board-key'; key.dataset.key=letter; key.textContent=letter; key.addEventListener('click',()=>appendBoardValue(letter)); boardLetters.appendChild(key); });
  'NOPQRSTUVWXYZ'.split('').forEach(letter => { const key=document.createElement('button'); key.type='button'; key.className='board-key'; key.dataset.key=letter; key.textContent=letter; key.addEventListener('click',()=>appendBoardValue(letter)); boardLetters.appendChild(key); });
}
const boardNumbers = document.getElementById('board-numbers');
if (boardNumbers) '1234567890'.split('').forEach(number => { const key=document.createElement('button'); key.type='button'; key.className='board-key number-key'; key.dataset.key=number; key.textContent=number; key.addEventListener('click',()=>appendBoardValue(number)); boardNumbers.appendChild(key); });
document.querySelectorAll('.board-key[data-key]').forEach(key => key.addEventListener('click', () => {
  if (sendButton.disabled || key.closest('#board-letters')) return;
  const action = key.dataset.key;
  if (/^[0-9]$/.test(action)) return;
  if (action === 'YES' || action === 'NO') appendBoardValue(`[${action}]`);
  if (action === 'GOODBYE') appendBoardValue(' GOODBYE');
  if (action === 'BACKSPACE') input.value = input.value.slice(0, -1);
  if (action === 'SPACE') input.value += ' ';
  if (action === 'CLEAR') input.value = '';
  updatePlanchette(); input.focus();
}));
input.addEventListener('input', updatePlanchette);
form.addEventListener('submit', event => { event.preventDefault(); const prompt = input.value.trim(); input.value = ''; updatePlanchette(); runTask(prompt, 'chorus'); });
const defaultDemonNames = {auditor:'THE AUDITOR',scribe:'THE SCRIBE',oracle:'THE ORACLE',executioner:'THE EXECUTIONER',herald:'THE HERALD',chorus:'THE CHORUS'};
let savedDemonNames = {};
try { savedDemonNames = JSON.parse(localStorage.getItem('legion-demon-names') || '{}'); } catch (_) { savedDemonNames = {}; }
document.querySelectorAll('.demon-name').forEach(field => {
  const agent = field.dataset.agent;
  if (savedDemonNames[agent]) field.value = savedDemonNames[agent];
  const applyName = () => {
    const name = field.value.trim().toUpperCase() || defaultDemonNames[agent];
    field.value = name;
    savedDemonNames[agent] = name;
    localStorage.setItem('legion-demon-names', JSON.stringify(savedDemonNames));
    document.querySelectorAll(`.task-card[data-agent="${agent}"] .task-name`).forEach(label => { label.textContent = name; });
    document.querySelectorAll(`.crew-card[data-crew="${agent}"] b`).forEach(label => { label.textContent = name; });
  };
  field.addEventListener('change', applyName);
  field.addEventListener('blur', applyName);
  applyName();
});
document.querySelectorAll('.task-card').forEach(card => card.addEventListener('click', () => runTask(card.dataset.prompt, card.dataset.agent)));
document.getElementById('settings-button').addEventListener('click', () => { tokenInput.value = token(); dialog.showModal(); tokenInput.focus(); });
document.getElementById('settings-form').addEventListener('submit', event => { if (event.submitter?.id === 'save-token') { sessionStorage.setItem('legion-token', tokenInput.value.trim()); addLine('system', 'Connection seal stored for this session.'); } });
setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);
checkHealth();
