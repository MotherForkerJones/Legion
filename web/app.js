const output = document.getElementById('console-output');
const form = document.getElementById('command-form');
const input = document.getElementById('prompt-input');
const sendButton = document.getElementById('send-button');
const status = document.getElementById('run-status');
const healthLabel = document.getElementById('health-label');
const tokenInput = document.getElementById('token-input');
const dialog = document.getElementById('settings-dialog');

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

async function checkHealth() {
  try {
    const response = await fetch('/health');
    if (!response.ok) throw new Error('offline');
    healthLabel.textContent = 'THRONE LINKED';
    healthLabel.style.color = 'var(--green)';
  } catch (_) { healthLabel.textContent = 'GATEWAY OFFLINE'; healthLabel.style.color = 'var(--red)'; }
}
async function runTask(prompt) {
  if (!prompt || sendButton.disabled) return;
  if (!token()) { dialog.showModal(); tokenInput.focus(); return; }
  setBusy(true); addLine('you', prompt);
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
  finally { setBusy(false); }
}
form.addEventListener('submit', event => { event.preventDefault(); const prompt = input.value.trim(); input.value = ''; runTask(prompt); });
document.querySelectorAll('.task-card').forEach(card => card.addEventListener('click', () => runTask(card.dataset.prompt)));
document.getElementById('settings-button').addEventListener('click', () => { tokenInput.value = token(); dialog.showModal(); tokenInput.focus(); });
document.getElementById('settings-form').addEventListener('submit', event => { if (event.submitter?.id === 'save-token') { sessionStorage.setItem('legion-token', tokenInput.value.trim()); addLine('system', 'Connection seal stored for this session.'); } });
setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB'); }, 1000);
checkHealth();
