(() => {
  const canvas = document.getElementById('seer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  function path(points, fill, stroke, width = 1) { ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); } }
  function text(value, x, y, size, color, align = 'left') { ctx.font = `${size}px "DM Mono", monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); }
  function glow(x, y, radius, color, alpha = .35) { const g = ctx.createRadialGradient(x,y,0,x,y,radius); g.addColorStop(0,`${color}${Math.round(alpha*255).toString(16).padStart(2,'0')}`); g.addColorStop(1,`${color}00`); ctx.fillStyle=g; ctx.fillRect(x-radius,y-radius,radius*2,radius*2); }
  function card(x, y, rotation, title, color, time) { ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.shadowColor=color; ctx.shadowBlur=14; ctx.fillStyle='#1b1018'; ctx.fillRect(-27,-39,54,78); ctx.shadowBlur=0; ctx.strokeStyle=color; ctx.lineWidth=2; ctx.strokeRect(-24,-36,48,72); ctx.strokeStyle='#c89563'; ctx.strokeRect(-19,-31,38,62); ctx.fillStyle=color; ctx.beginPath(); ctx.arc(0,-4,13+Math.sin(time/420)*2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f7d795'; ctx.fillRect(-2,-20,4,32); ctx.fillRect(-11,-4,22,4); text(title,0,26,7,'#f6dfb0','center'); ctx.restore(); }
  function draw(time) {
    ctx.clearRect(0,0,W,H); const bg=ctx.createRadialGradient(300,150,0,300,170,260); bg.addColorStop(0,'#632536'); bg.addColorStop(1,'#100b13'); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
    for(let i=0;i<18;i++){ctx.fillStyle=`#f2b36b${(24+i%4*12).toString(16)}`;ctx.fillRect((i*73+time*.02)%W,(i*41)%H,2,2);} glow(285,145,120,'#e1445b',.3);
    ctx.strokeStyle='#d89b64';ctx.globalAlpha=.32;ctx.lineWidth=2;ctx.beginPath();ctx.arc(288,120,82,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(288,31);ctx.lineTo(288,209);ctx.moveTo(199,120);ctx.lineTo(377,120);ctx.stroke();ctx.globalAlpha=1;
    const bob=Math.sin(time/700)*2; path([[170,360],[190,228+bob],[241,183+bob],[288,174+bob],[335,183+bob],[386,228+bob],[406,360]],'#24101d','#b23b4d',2); path([[221,350],[241,204+bob],[288,185+bob],[335,204+bob],[355,350]],'#492030','#e3a269',1);
    ctx.fillStyle='#241321';ctx.beginPath();ctx.ellipse(288,133+bob,47,57,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#110b15';ctx.beginPath();ctx.moveTo(241,128+bob);ctx.quadraticCurveTo(218,58,286,43);ctx.quadraticCurveTo(360,47,337,145+bob);ctx.lineTo(327,92+bob);ctx.quadraticCurveTo(288,115,244,92+bob);ctx.closePath();ctx.fill();ctx.strokeStyle='#a73d58';ctx.stroke();
    ctx.fillStyle='#f0bd9f';ctx.beginPath();ctx.ellipse(288,137+bob,31,39,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2d1421';ctx.fillRect(269,135+bob,12,4);ctx.fillRect(296,135+bob,12,4);ctx.fillStyle='#f7d795';ctx.fillRect(275,154+bob,25,3);
    ctx.strokeStyle='#c89563';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(253,116+bob);ctx.lineTo(231,80+bob);ctx.moveTo(323,116+bob);ctx.lineTo(345,80+bob);ctx.stroke();
    ctx.fillStyle='#f0bd9f';ctx.beginPath();ctx.arc(223,239+bob,13,0,Math.PI*2);ctx.arc(353,239+bob,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#40202d';ctx.fillRect(213,247+bob,20,5);ctx.fillRect(343,247+bob,20,5);
    card(187,218+Math.sin(time/500)*4,-.23,'FATE','#d6535b',time); card(389,213+Math.sin(time/580)*4,.22,'WORK','#608ed8',time);
    text('THE INFERNAL SEER',288,332,11,'#f5d6ad','center');text('GUIDANCE // MEMORY // NEXT MOVE',288,348,8,'#bc8790','center'); requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
