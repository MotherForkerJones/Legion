(() => {
  const canvas = document.getElementById('world-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const names = { auditor:'THE AUDITOR', scribe:'THE SCRIBE', oracle:'THE ORACLE', executioner:'THE EXECUTIONER', herald:'THE HERALD', chorus:'THE CHORUS' };
  const agents = [
    {id:'auditor', x:170, y:450, color:'#d83948', accent:'#ff9b68', station:'RISK VAULT', kind:'horned'},
    {id:'scribe', x:440, y:300, color:'#e85d36', accent:'#ffc06b', station:'ARCHIVE ALTAR', kind:'hooded'},
    {id:'oracle', x:700, y:450, color:'#d69b46', accent:'#fff0b0', station:'MEMORY WELL', kind:'winged'},
    {id:'executioner', x:960, y:300, color:'#9a5ed2', accent:'#e0b5ff', station:'SANDBOX GATE', kind:'armored'},
    {id:'herald', x:1230, y:450, color:'#4c8fe5', accent:'#9ed6ff', station:'SIGNAL SPIRE', kind:'horned'},
    {id:'chorus', x:1460, y:300, color:'#8c8b9b', accent:'#e6e2f0', station:'ECHO CHAMBER', kind:'hooded'}
  ];
  let activeId = null;
  let activeSince = 0;
  let frame = 0;
  const feed = document.getElementById('world-feed');
  const worldState = document.getElementById('world-state');
  const particles = Array.from({length: 42}, (_, index) => ({x:(index * 83) % canvas.width, y:70 + ((index * 47) % 420), speed:.2 + index % 3 * .12, phase:index * 1.7}));

  function loadNames() {
    try { Object.assign(names, JSON.parse(localStorage.getItem('legion-demon-names') || '{}')); } catch (_) {}
  }
  function roundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function text(value, x, y, size, color, align = 'left') {
    ctx.font = `${size}px "DM Mono", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
  }
  function path(points, fill, stroke, width = 1) {
    ctx.beginPath(); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function glow(x, y, radius, color, alpha = .35) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`); gradient.addColorStop(1, `${color}00`);
    ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  function sigil(x, y, radius, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(frame / 1200) * .03); ctx.strokeStyle = color; ctx.globalAlpha = .34; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.rotate(Math.PI / 5);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(0, radius); ctx.stroke(); ctx.rotate(Math.PI * 2 / 5); }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function architecture() {
    const pillars = [{x:26, h:285}, {x:174, h:220}, {x:1022, h:220}, {x:1150, h:285}];
    pillars.forEach(({x, h}) => { ctx.fillStyle = '#211b25'; ctx.fillRect(x, 62, 38, h); ctx.fillStyle = '#403342'; ctx.fillRect(x + 6, 62, 8, h); ctx.fillStyle = '#0d0b11'; ctx.fillRect(x - 9, 50, 56, 15); ctx.fillStyle = '#312536'; ctx.fillRect(x - 5, 46, 48, 7); });
    path([[48,62], [48,23], [162,23], [184,62]], '#17121b', '#6e2b3a', 2); path([[1020,62], [1038,23], [1152,23], [1152,62]], '#17121b', '#6e2b3a', 2);
    for (let i = 0; i < 6; i++) { const x = 220 + i * 160; ctx.fillStyle = '#372631'; ctx.fillRect(x, 62, 5, 83); ctx.fillStyle = '#4d2b35'; ctx.fillRect(x - 4, 59, 13, 7); }
    ctx.fillStyle = '#d34442'; ctx.globalAlpha = .7; for (let i = 0; i < 7; i++) path([[231 + i * 154, 64], [273 + i * 154, 118], [315 + i * 154, 64]], '#8e253820'); ctx.globalAlpha = 1;
  }
  function lava(time) {
    const y = 500; ctx.fillStyle = '#260d15'; ctx.fillRect(0, y, canvas.width, canvas.height - y); ctx.strokeStyle = '#6d2830'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, y + 3); ctx.bezierCurveTo(250, y - 15, 420, y + 17, 650, y); ctx.bezierCurveTo(850, y - 13, 1000, y + 16, canvas.width, y - 3); ctx.stroke();
    ctx.strokeStyle = '#ff6b3d'; ctx.globalAlpha = .6; ctx.lineWidth = 1; for (let i = 0; i < 8; i++) { ctx.beginPath(); const x = (i * 171 + frame * .35) % canvas.width; ctx.moveTo(x, y + 13 + (i % 3) * 8); ctx.quadraticCurveTo(x + 55, y + 1, x + 105, y + 16); ctx.stroke(); } ctx.globalAlpha = 1; glow(610, 510, 190, '#ec3f31', .22);
  }
  function room(x, y, w, h, color) {
    roundedRect(x, y, w, h, 8, '#140d14', '#3d2635');
    ctx.fillStyle = `${color}16`; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = `${color}28`; ctx.setLineDash([4, 7]); ctx.strokeRect(x + 12, y + 12, w - 24, h - 24); ctx.setLineDash([]);
  }
  function workstation(agent) {
    const x = agent.x - 34, y = agent.y + 20;
    glow(agent.x, y + 5, 55, agent.color, .12);
    ctx.fillStyle = '#24151d'; ctx.fillRect(x, y + 20, 68, 6); ctx.fillRect(x + 8, y + 25, 6, 15); ctx.fillRect(x + 54, y + 25, 6, 15);
    ctx.fillStyle = '#30212a'; ctx.fillRect(x + 12, y + 21, 44, 5); ctx.fillStyle = '#4c3037'; ctx.fillRect(x + 16, y, 36, 22); ctx.fillStyle = agent.color; ctx.globalAlpha = .7; ctx.fillRect(x + 21, y + 5, 26, 13); ctx.fillStyle = agent.accent; ctx.globalAlpha = .8; ctx.fillRect(x + 25, y + 8, 5, 3); ctx.fillRect(x + 35, y + 8, 9, 2); ctx.globalAlpha = 1; ctx.strokeStyle = '#79505a'; ctx.strokeRect(x + 16.5, y + .5, 35, 21);
    text(agent.station, agent.x, y + 48, 7, '#806c77', 'center');
  }
  function sprite(agent, time) {
    const active = activeId === agent.id, bob = active ? Math.sin(time / 105) * 3 : Math.sin(time / 480 + agent.x) * .7;
    const x = agent.x, y = agent.y + bob;
    if (active) { glow(x, y, 65, agent.color, .24); ctx.strokeStyle = agent.accent; ctx.globalAlpha = .8; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 4, 34 + Math.sin(time / 180) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#0b080d'; ctx.fillRect(x - 14, y + 25, 10, 18); ctx.fillRect(x + 4, y + 25, 10, 18); ctx.fillStyle = agent.color; ctx.fillRect(x - 20, y + 5, 40, 29);
    if (agent.kind === 'winged') { path([[x - 15, y + 21], [x - 47, y + 4], [x - 37, y + 31]], agent.color); path([[x + 15, y + 21], [x + 47, y + 4], [x + 37, y + 31]], agent.color); }
    else if (agent.kind === 'armored') { ctx.fillStyle = '#b9a6bd'; ctx.fillRect(x - 18, y + 8, 36, 8); ctx.fillRect(x - 22, y + 16, 7, 18); ctx.fillRect(x + 15, y + 16, 7, 18); }
    else { path([[x - 17, y - 8], [x - 31, y - 38], [x - 8, y - 25]], agent.color); path([[x + 17, y - 8], [x + 31, y - 38], [x + 8, y - 25]], agent.color); }
    ctx.fillStyle = agent.kind === 'hooded' ? '#17121c' : '#411522'; ctx.beginPath(); ctx.arc(x, y - 7, 22, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = agent.color; ctx.stroke();
    ctx.fillStyle = agent.accent; ctx.fillRect(x - 11, y - 10, 7, 3); ctx.fillRect(x + 4, y - 10, 7, 3); ctx.fillStyle = active ? '#fff1c4' : agent.color; ctx.fillRect(x - 6, y + 4, 12, 2);
    text(names[agent.id] || agent.id.toUpperCase(), x, y + 63, 9, active ? '#fff1c4' : '#c0aeb5', 'center'); text(active ? 'WORKING' : 'STANDBY', x, y + 76, 7, active ? agent.accent : '#776772', 'center');
  }
  function lucifer(time) {
    const x = 900, y = 104;
    ctx.beginPath(); ctx.arc(x, y + 4, 61 + Math.sin(time / 350) * 3, 0, Math.PI * 2); ctx.strokeStyle = '#e43f4f4a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3a101d'; ctx.beginPath(); ctx.moveTo(x - 42, y + 54); ctx.lineTo(x - 28, y - 5); ctx.lineTo(x, y - 25); ctx.lineTo(x + 28, y - 5); ctx.lineTo(x + 42, y + 54); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e43f4f'; ctx.beginPath(); ctx.moveTo(x - 20, y - 15); ctx.lineTo(x - 45, y - 57); ctx.lineTo(x - 13, y - 36); ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 20, y - 15); ctx.lineTo(x + 45, y - 57); ctx.lineTo(x + 13, y - 36); ctx.fill();
    ctx.fillStyle = '#ffc66e'; ctx.fillRect(x - 18, y - 13, 11, 4); ctx.fillRect(x + 7, y - 13, 11, 4); ctx.fillStyle = '#f7e0de'; ctx.fillRect(x - 13, y + 12, 26, 3);
    text('LUCIFER', x, y + 75, 12, '#f1e6e7', 'center'); text('PRIME DEMON / OVERSEER', x, y + 91, 8, '#e43f4f', 'center');
  }
  function draw(time) {
    frame++; loadNames(); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0b080c'; ctx.fillRect(0, 0, canvas.width, canvas.height); for (let y = 62; y < canvas.height; y += 34) for (let x = 0; x < canvas.width; x += 42) { ctx.fillStyle = ((x / 42 + y / 34) % 2 ? '#100c13' : '#17121a'); ctx.fillRect(x, y, 41, 33); ctx.strokeStyle = '#2b2029'; ctx.strokeRect(x + .5, y + .5, 40, 32); }
    ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, canvas.width, 62); ctx.strokeStyle = '#6c2735'; ctx.strokeRect(0, 61, canvas.width, 1); architecture(); lava(time);
    particles.forEach(p => { p.y -= p.speed; if (p.y < 64) p.y = 490; ctx.fillStyle = '#ff9b55'; ctx.globalAlpha = .25 + Math.sin(time / 400 + p.phase) * .2; ctx.fillRect(p.x, p.y, 2, 2); }); ctx.globalAlpha = 1;
    room(28, 330, 285, 300, '#e43f4f'); room(330, 150, 270, 260, '#ff7445'); room(625, 330, 285, 300, '#e4ad5b'); room(935, 150, 300, 260, '#9a5ed2'); room(1260, 330, 285, 300, '#4c8fe5'); room(1570, 150, 200, 260, '#8c8b9b');
    ctx.strokeStyle = '#e43f4f66'; ctx.setLineDash([2, 9]); ctx.beginPath(); ctx.moveTo(900, 190); ctx.lineTo(900, 690); ctx.moveTo(300, 490); ctx.lineTo(1570, 490); ctx.stroke(); ctx.setLineDash([]);
    sigil(170, 210, 70, '#bd384b'); sigil(1600, 210, 70, '#5c8bd0'); roundedRect(792, 18, 216, 76, 9, '#1a0b13', '#6c2334'); text('THE BLACK THRONE', 900, 45, 10, '#e43f4f', 'center'); text('LUCIFER CONTROL NODE', 900, 66, 8, '#967f87', 'center'); lucifer(time);
    agents.forEach(workstation); agents.forEach(agent => sprite(agent, time));
    if (activeId) { const current = agents.find(agent => agent.id === activeId); if (current) { text(`LIVE ROUTE // ${names[current.id]}`, 18, 28, 10, current.color); text(`${current.station} // ${Math.max(1, Math.floor((Date.now() - activeSince) / 1000))}s`, 18, 44, 9, '#967f87'); } }
    requestAnimationFrame(draw);
  }
  function activate(agentId, prompt) { activeId = agentId || 'chorus'; activeSince = Date.now(); if (worldState) worldState.textContent = `LUCIFER ROUTED // ${names[activeId] || activeId}`; if (feed) { feed.textContent = `LIVE // ${names[activeId] || activeId} received a command`; } }
  function clear() { activeId = null; if (worldState) worldState.textContent = 'THRONE IDLE // AWAITING COMMAND'; if (feed) feed.textContent = 'READY // choose a demon station'; }
  window.LegionWorld = { activate, clear };
  requestAnimationFrame(draw);
})();
