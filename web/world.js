(() => {
  const canvas = document.getElementById('world-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const names = { auditor:'THE AUDITOR', scribe:'THE SCRIBE', oracle:'THE ORACLE', executioner:'THE EXECUTIONER', herald:'THE HERALD', chorus:'THE CHORUS' };
  const agents = [
    {id:'auditor', x:210, y:370, color:'#e43f4f', station:'RISK VAULT'},
    {id:'scribe', x:390, y:270, color:'#ff7445', station:'ARCHIVE ALTAR'},
    {id:'oracle', x:610, y:370, color:'#e4ad5b', station:'MEMORY WELL'},
    {id:'executioner', x:800, y:270, color:'#b076ed', station:'SANDBOX GATE'},
    {id:'herald', x:960, y:370, color:'#6ca8ff', station:'SIGNAL SPIRE'},
    {id:'chorus', x:1080, y:270, color:'#aaa3a8', station:'ECHO CHAMBER'}
  ];
  let activeId = null;
  let activeSince = 0;
  let frame = 0;
  const feed = document.getElementById('world-feed');
  const worldState = document.getElementById('world-state');

  function loadNames() {
    try { Object.assign(names, JSON.parse(localStorage.getItem('legion-demon-names') || '{}')); } catch (_) {}
  }
  function roundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function text(value, x, y, size, color, align = 'left') {
    ctx.font = `${size}px "DM Mono", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function room(x, y, w, h, color) {
    roundedRect(x, y, w, h, 8, '#140d14', '#3d2635');
    ctx.fillStyle = `${color}16`; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = `${color}28`; ctx.setLineDash([4, 7]); ctx.strokeRect(x + 12, y + 12, w - 24, h - 24); ctx.setLineDash([]);
  }
  function workstation(agent) {
    const x = agent.x - 34, y = agent.y + 20;
    ctx.fillStyle = '#24151d'; ctx.fillRect(x, y + 20, 68, 6); ctx.fillRect(x + 8, y + 25, 6, 15); ctx.fillRect(x + 54, y + 25, 6, 15);
    ctx.fillStyle = agent.color; ctx.fillRect(x + 17, y, 34, 21); ctx.fillStyle = '#090709'; ctx.fillRect(x + 21, y + 4, 26, 12);
    ctx.fillStyle = agent.color; ctx.globalAlpha = .6; ctx.fillRect(x + 24, y + 7, 15, 2); ctx.globalAlpha = 1;
  }
  function sprite(agent, time) {
    const bob = activeId === agent.id ? Math.sin(time / 130) * 3 : Math.sin(time / 600 + agent.x) * 1;
    const x = agent.x, y = agent.y + bob, active = activeId === agent.id;
    if (active) { ctx.beginPath(); ctx.arc(x, y + 7, 34 + Math.sin(time / 220) * 3, 0, Math.PI * 2); ctx.strokeStyle = `${agent.color}70`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = '#090709'; ctx.fillRect(x - 13, y + 25, 9, 13); ctx.fillRect(x + 4, y + 25, 9, 13);
    ctx.fillStyle = agent.color; ctx.fillRect(x - 17, y + 7, 34, 25);
    ctx.fillStyle = '#30121c'; ctx.fillRect(x - 16, y - 14, 32, 25);
    ctx.fillStyle = agent.color; ctx.beginPath(); ctx.moveTo(x - 14, y - 10); ctx.lineTo(x - 27, y - 31); ctx.lineTo(x - 9, y - 20); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 14, y - 10); ctx.lineTo(x + 27, y - 31); ctx.lineTo(x + 9, y - 20); ctx.fill();
    ctx.fillStyle = '#ffc66e'; ctx.fillRect(x - 9, y - 4, 6, 3); ctx.fillRect(x + 3, y - 4, 6, 3);
    ctx.fillStyle = active ? '#fff0c2' : '#d55c61'; ctx.fillRect(x - 5, y + 6, 10, 2);
    text(names[agent.id] || agent.id.toUpperCase(), x, y + 55, 10, active ? '#fff0c2' : '#bfa6b0', 'center');
    text(active ? 'WORKING' : 'IDLE', x, y + 69, 8, active ? agent.color : '#6e5962', 'center');
  }
  function lucifer(time) {
    const x = 600, y = 104;
    ctx.beginPath(); ctx.arc(x, y + 4, 61 + Math.sin(time / 350) * 3, 0, Math.PI * 2); ctx.strokeStyle = '#e43f4f4a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3a101d'; ctx.beginPath(); ctx.moveTo(x - 42, y + 54); ctx.lineTo(x - 28, y - 5); ctx.lineTo(x, y - 25); ctx.lineTo(x + 28, y - 5); ctx.lineTo(x + 42, y + 54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e43f4f'; ctx.beginPath(); ctx.moveTo(x - 20, y - 15); ctx.lineTo(x - 45, y - 57); ctx.lineTo(x - 13, y - 36); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 20, y - 15); ctx.lineTo(x + 45, y - 57); ctx.lineTo(x + 13, y - 36); ctx.fill();
    ctx.fillStyle = '#ffc66e'; ctx.fillRect(x - 18, y - 13, 11, 4); ctx.fillRect(x + 7, y - 13, 11, 4); ctx.fillStyle = '#f7e0de'; ctx.fillRect(x - 13, y + 12, 26, 3);
    text('LUCIFER', x, y + 75, 12, '#f1e6e7', 'center'); text('PRIME DEMON / OVERSEER', x, y + 91, 8, '#e43f4f', 'center');
  }
  function draw(time) {
    frame++; loadNames(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b080c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 32) for (let x = 0; x < canvas.width; x += 32) { ctx.fillStyle = ((x / 32 + y / 32) % 2 ? '#100b11' : '#130d14'); ctx.fillRect(x, y, 31, 31); }
    ctx.strokeStyle = '#271821'; ctx.lineWidth = 1; for (let x = 0; x < canvas.width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y < canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    room(32, 192, 270, 224, '#e43f4f'); room(320, 108, 220, 200, '#ff7445'); room(560, 192, 270, 224, '#e4ad5b'); room(850, 108, 300, 200, '#6ca8ff');
    ctx.strokeStyle = '#e43f4f66'; ctx.setLineDash([2, 9]); ctx.beginPath(); ctx.moveTo(600, 192); ctx.lineTo(600, 450); ctx.stroke(); ctx.setLineDash([]);
    roundedRect(492, 18, 216, 76, 9, '#1a0b13', '#6c2334'); text('THE BLACK THRONE', 600, 45, 10, '#e43f4f', 'center'); text('LUCIFER CONTROL NODE', 600, 66, 8, '#967f87', 'center'); lucifer(time);
    agents.forEach(workstation); agents.forEach(agent => sprite(agent, time));
    if (activeId) { const current = agents.find(agent => agent.id === activeId); if (current) { text(`LIVE ROUTE // ${names[current.id]}`, 18, 28, 10, current.color); text(`${current.station} // ${Math.max(1, Math.floor((Date.now() - activeSince) / 1000))}s`, 18, 44, 9, '#967f87'); } }
    requestAnimationFrame(draw);
  }
  function activate(agentId, prompt) { activeId = agentId || 'chorus'; activeSince = Date.now(); if (worldState) worldState.textContent = `LUCIFER ROUTED // ${names[activeId] || activeId}`; if (feed) { feed.textContent = `LIVE // ${names[activeId] || activeId} received a command`; } }
  function clear() { activeId = null; if (worldState) worldState.textContent = 'THRONE IDLE // AWAITING COMMAND'; if (feed) feed.textContent = 'READY // choose a demon station'; }
  window.LegionWorld = { activate, clear };
  requestAnimationFrame(draw);
})();
