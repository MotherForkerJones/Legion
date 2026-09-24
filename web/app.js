const output = document.getElementById('console-output');
const form = document.getElementById('command-form');
const input = document.getElementById('prompt-input');
const sendButton = document.getElementById('send-button');
const status = document.getElementById('run-status');
const healthLabel = document.getElementById('health-label');
const tokenInput = document.getElementById('token-input');
const dialog = document.getElementById('settings-dialog');
const planchetteText = document.getElementById('planchette-text');

function token() { return sessionStorage.getItem('legion-token') || ''; }
function addLine(kind, text) {
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `<span class="kind">[ ${kind} ]</span> ${escapeHtml(String(text))}`;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
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
  setBusy(true); addLine('you', prompt); window.LegionWorld?.activate(agentId, prompt);
  try {
    const response = await fetch('/run', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token()}`}, body:JSON.stringify({prompt, max_turns:6})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Gateway rejected the task');
    (data.events || []).forEach(event => {
      if (event.kind === 'answer') addLine('lucifer', event.payload.content);
      else if (event.kind === 'act') addLine(event.payload.tool || 'act', JSON.stringify(event.payload.result));
      else if (event.kind === 'limit') addLine('limit', `Turn limit reached: ${event.payload.max_turns}`);
    });
  } catch (error) { addLine('error', error.message); }
  finally { setBusy(false); window.LegionWorld?.clear(); }
}
const boardLetters = document.getElementById('board-letters');
if (boardLetters) {
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
    const key = document.createElement('button'); key.type = 'button'; key.className = 'board-key'; key.dataset.key = letter; key.textContent = letter;
    key.addEventListener('click', () => { if (!sendButton.disabled) { input.value += letter; updatePlanchette(); input.focus(); } }); boardLetters.appendChild(key);
  });
}
document.querySelectorAll('.board-key[data-key]').forEach(key => key.addEventListener('click', () => {
  if (sendButton.disabled || key.closest('#board-letters')) return;
  const action = key.dataset.key;
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
