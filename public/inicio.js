(() => {
fetch('/api/v1/auth/session?optional=1',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{ if(d&&d.authenticated) location.replace('/painel'); }).catch(()=>{});
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const movelLeve = innerWidth < 700 || (navigator.hardwareConcurrency||8) <= 4;
const $ = (s,el=document)=>el.querySelector(s), $$ = (s,el=document)=>[...el.querySelectorAll(s)];
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- tema (escuro por padrão) ---------- */
try{ const s=localStorage.getItem('orvok-tema'); if(s) document.documentElement.dataset.theme=s; }catch{}
const escuro = () => document.documentElement.dataset.theme !== 'light';

/* ---------- ícones ---------- */
const IC = {
  casa:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18 6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  globo:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  pessoas:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-4 3.3-6 6.5-6s5.7 2 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14c3 .2 4.8 2.2 5.5 5.5"/>',
  sino:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  perfil:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-7 8-7s7 2.5 8 7"/>',
  mais:'<path d="M12 5v14M5 12h14"/>',
  lua:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  sol:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  enviar:'<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  ok:'<path d="m5 12 5 5 9-10"/>',
  pino:'<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
  alvo:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  espelho:'<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  olho:'<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  coracao:'<path d="M12 20s-7.5-4.4-9-9.2C2 7.4 4.2 4.5 7.4 4.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.2 0 5.4 2.9 4.4 6.3-1.5 4.8-9 9.2-9 9.2z"/>'
};
const ic = (n,extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra} aria-hidden="true">${IC[n]}</svg>`;
function pintaIcones(root=document){ $$('svg[data-ic]',root).forEach(s=>{ s.outerHTML = ic(s.dataset.ic, s.getAttribute('style')?`style="${s.getAttribute('style')}"`:''); }); }

const ORB = '<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/><g class="orbita"><ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#4C8DFF" stroke-width="1.8" transform="rotate(-24 16 16)"/><circle cx="27.5" cy="10.8" r="2.4" fill="#4C8DFF"/></g><circle cx="16" cy="16" r="4.2" fill="#FFA834"/>';
$$('svg.orb').forEach(s=>s.innerHTML=ORB);

/* ---------- interações ---------- */
const dlgC=$('#dlgComecar');
document.addEventListener('click', e=>{
  const cm=e.target.closest('[data-comecar],[data-entrar]');
  if(cm){ e.preventDefault(); location.href = cm.hasAttribute('data-entrar') ? '/entrar' : '/comecar'; return; }
  if(e.target.closest('[data-fecha]')){ e.target.closest('dialog').close(); return; }
});
dlgC.addEventListener('click', e=>{ if(e.target===dlgC) dlgC.close(); });

/* luz que segue o cursor */
document.addEventListener('pointermove', e=>{ const el=e.target.closest?.('.luz'); if(!el) return; const r=el.getBoundingClientRect(); el.style.setProperty('--mx',(e.clientX-r.left)+'px'); el.style.setProperty('--my',(e.clientY-r.top)+'px'); }, {passive:true});

/* empurrão depois da primeira olhada */
const emp=$('#empurrao'); let empFeito=false;
function mostraEmp(){ if(empFeito) return; empFeito=true; emp.classList.add('mostra'); }
addEventListener('scroll',()=>{ if(scrollY>900) mostraEmp(); },{passive:true});
setTimeout(mostraEmp, 16000);
$('#fechaEmp').addEventListener('click',()=>emp.classList.remove('mostra'));

/* ---------- motor do globo (visual de identidade: pontos e arcos abstratos, sem dados reais) ---------- */
const ll=(a,b)=>{a*=Math.PI/180;b*=Math.PI/180;return[Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)]};
const angulo=(p,q)=>Math.acos(Math.max(-1,Math.min(1,p[0]*q[0]+p[1]*q[1]+p[2]*q[2])));
const rnd=(a,b)=>a+Math.random()*(b-a);
const CIDADES=[[-23,-46],[-22,-43],[-15,-47],[-30,-51],[-8,-35],[-3,-38],[40,-74],[34,-118],[51,0],[48,2],[40,-3],[52,13],[35,139],[37,127],[31,121],[19,72],[-33,151],[30,31],[6,3],[55,37],[-34,-58],[19,-99],[1,103],[25,55]].map(([a,b])=>ll(a,b));
function criaGlobo(cv,o){
  const ctx=cv.getContext('2d'); let W=0,H=0,R=0,CX=0,CY=0,vivo=true;
  const N=o.pontos, pts=[], gold=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<N;i++){ const y=1-i/(N-1)*2,r=Math.sqrt(1-y*y),t=gold*i,p=[Math.cos(t)*r,y,Math.sin(t)*r]; let d=9; for(const c of CIDADES) d=Math.min(d,angulo(p,c));
    const amb=d<.2+Math.random()*.08&&Math.random()<.8; pts.push({p,amb,s:amb?rnd(1.1,2):rnd(.9,1.5),tw:Math.random()*6.28,o:[rnd(-3,3),rnd(-3,3),rnd(-3,3)]}); }
  const nos=Array.from({length:o.pessoas},(_,i)=>{ const c=CIDADES[i%CIDADES.length], p=[c[0]+rnd(-.1,.1),c[1]+rnd(-.1,.1),c[2]+rnd(-.1,.1)], l=Math.hypot(...p); return {p:p.map(v=>v/l),lig:[]}; });
  nos.forEach((a,i)=>{ nos.map((b,j)=>[j,angulo(a.p,b.p)]).filter(([j])=>j!==i).sort((x,y)=>x[1]-y[1]).slice(0,2).forEach(([j])=>{ if(!a.lig.includes(j)) a.lig.push(j); if(!nos[j].lig.includes(i)) nos[j].lig.push(i); }); });
  const arcos=[]; while(arcos.length<o.arcos){ const i=Math.floor(Math.random()*nos.length), j=Math.floor(Math.random()*nos.length); if(i!==j&&angulo(nos[i].p,nos[j].p)>.6) arcos.push({i,j,t:Math.random(),v:rnd(.003,.006)}); }
  const malha=[], malhaLig=[]; if(o.malha){ for(let i=0;i<64;i++){ const u=rnd(-1,1),th=rnd(0,6.28),r=Math.sqrt(1-u*u); malha.push([Math.cos(th)*r,u,Math.sin(th)*r]); }
    malha.forEach((a,i)=>malha.map((b,j)=>[j,angulo(a,b)]).filter(([j,d])=>j>i&&d<.75).sort((x,y)=>x[1]-y[1]).slice(0,3).forEach(([j])=>malhaLig.push([i,j]))); }
  let ativo=true; const io=new IntersectionObserver(es=>{ativo=es[0].isIntersecting;}); io.observe(cv);
  let yaw=o.yaw??-1.1, pitch=.34, alvoP=.34, arr=false, lx=0, ly=0, mouse={x:-1e4,y:-1e4}, hover=-1; const t0=performance.now();
  function tam(){ const d=Math.min(devicePixelRatio||1,2), r=cv.getBoundingClientRect(); W=r.width; H=r.height; cv.width=W*d; cv.height=H*d; ctx.setTransform(d,0,0,d,0,0); R=Math.min(W,H)*o.escala; CX=W/2; CY=H/2+(o.desloca||0)*H; }
  tam(); const onR=()=>tam(); addEventListener('resize',onR);
  function pj(v,raio=R,yw=yaw){ const c=Math.cos(yw),s=Math.sin(yw),cp=Math.cos(pitch),sp=Math.sin(pitch); const x=v[0]*c-v[2]*s,z=v[0]*s+v[2]*c,y2=v[1]*cp-z*sp,z2=v[1]*sp+z*cp,f=1+z2*.1; return [CX+x*raio*f,CY-y2*raio*f,z2]; }
  if(o.interativo){
    const pos=e=>{const r=cv.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top];};
    cv.addEventListener('pointerdown',e=>{arr=true;[lx,ly]=pos(e);cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
    cv.addEventListener('pointermove',e=>{ const [x,y]=pos(e); mouse={x,y}; if(arr){ yaw+=(x-lx)*.008; alvoP=Math.max(-.5,Math.min(.9,alvoP+(y-ly)*.004)); lx=x; ly=y; } });
    const solta=()=>{arr=false;cv.style.cursor='';}; cv.addEventListener('pointerup',solta); cv.addEventListener('pointercancel',solta);
    cv.addEventListener('pointerleave',()=>{mouse={x:-1e4,y:-1e4};});
  }
  function quadro(agora){
    if(!vivo) return; if(!ativo||document.hidden){ requestAnimationFrame(quadro); return; } const t=Math.max(0,(agora-t0)/1000), monta=reduz||!o.monta?1:1-Math.pow(1-Math.min(1,t/o.monta),4);
    if(!arr&&!reduz) yaw+=o.vel; pitch+=(alvoP-pitch)*.05; ctx.clearRect(0,0,W,H);
    const g=ctx.createRadialGradient(CX,CY,R*.9,CX,CY,R*1.55); g.addColorStop(0,'rgba(76,141,255,.26)'); g.addColorStop(.35,'rgba(76,141,255,.08)'); g.addColorStop(1,'rgba(76,141,255,0)');
    ctx.globalAlpha=monta; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(CX,CY,R*1.55,0,7); ctx.fill();
    const d=ctx.createRadialGradient(CX-R*.35,CY-R*.4,R*.1,CX,CY,R); d.addColorStop(0,'#0D2756'); d.addColorStop(.7,'#071734'); d.addColorStop(1,'#040C1E');
    ctx.fillStyle=d; ctx.beginPath(); ctx.arc(CX,CY,R,0,7); ctx.fill();
    ctx.strokeStyle='rgba(127,178,255,.6)'; ctx.lineWidth=1.2; ctx.shadowColor='#4C8DFF'; ctx.shadowBlur=22; ctx.beginPath(); ctx.arc(CX,CY,R,0,7); ctx.stroke(); ctx.shadowBlur=0; ctx.globalAlpha=1;
    if(o.malha){ const mp=malha.map(v=>pj(v,R*1.32*(1+(1-monta)*.5),-yaw*.6+1)); ctx.lineWidth=.7;
      malhaLig.forEach(([i,j])=>{ const a=mp[i],b=mp[j]; ctx.strokeStyle=`rgba(127,178,255,${(.05+((a[2]+b[2])/2+1)*.07)*monta})`; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); });
      mp.forEach(a=>{ ctx.fillStyle=`rgba(200,225,255,${(.25+(a[2]+1)*.3)*monta})`; ctx.beginPath(); ctx.arc(a[0],a[1],1.2+(a[2]+1)*.7,0,7); ctx.fill(); }); }
    for(const q of pts){ const v=monta<1?[q.p[0]+q.o[0]*(1-monta),q.p[1]+q.o[1]*(1-monta),q.p[2]+q.o[2]*(1-monta)]:q.p; const [x,y,z]=pj(v); if(z<-.1&&monta>.95) continue; const luzP=Math.max(0,z);
      if(q.amb){ const tw=.6+.4*Math.sin(t*1.7+q.tw); ctx.fillStyle=`rgba(255,${172+Math.floor(tw*40)},80,${(.35+luzP*.65)*tw})`; } else ctx.fillStyle=`rgba(127,178,255,${.1+luzP*.5})`;
      ctx.fillRect(x,y,q.s,q.s); }
    const pp=nos.map(p=>pj(p.p)); ctx.lineWidth=.9;
    nos.forEach((a,i)=>a.lig.forEach(j=>{ if(j<i) return; const A=pp[i],B=pp[j]; if(A[2]<0||B[2]<0) return; const f=hover===i||hover===j;
      ctx.strokeStyle=f?'rgba(255,205,130,.95)':`rgba(127,178,255,${.2*monta})`; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); ctx.stroke(); }));
    arcos.forEach(a=>{ const Pp=nos[a.i].p,Q=nos[a.j].p,m=[Pp[0]+Q[0],Pp[1]+Q[1],Pp[2]+Q[2]],ml=Math.hypot(...m),alt=1+angulo(Pp,Q)*.3;
      const A=pj(Pp),B=pj(Q),C=pj([m[0]/ml*alt,m[1]/ml*alt,m[2]/ml*alt]); const vis=Math.max(0,Math.min(1,Math.min(A[2],B[2])*4)); if(vis<=0) return;
      const f=hover===a.i||hover===a.j, qx=2*C[0]-(A[0]+B[0])/2, qy=2*C[1]-(A[1]+B[1])/2;
      ctx.strokeStyle=f?`rgba(255,205,130,${.95*vis})`:`rgba(76,141,255,${.45*vis*monta})`; ctx.lineWidth=f?1.7:1.1; ctx.beginPath(); ctx.moveTo(A[0],A[1]); ctx.quadraticCurveTo(qx,qy,B[0],B[1]); ctx.stroke();
      if(!reduz) a.t=(a.t+a.v)%1; const u=a.t,x=(1-u)**2*A[0]+2*(1-u)*u*qx+u*u*B[0],y=(1-u)**2*A[1]+2*(1-u)*u*qy+u*u*B[1];
      ctx.shadowColor='#7FB2FF'; ctx.shadowBlur=14; ctx.fillStyle=`rgba(235,245,255,${vis*monta})`; ctx.beginPath(); ctx.arc(x,y,2.2,0,7); ctx.fill(); ctx.shadowBlur=0; });
    let perto=-1,melhor=16;
    pp.forEach((A,i)=>{ if(A[2]<.05) return; const dd=Math.hypot(A[0]-mouse.x,A[1]-mouse.y); if(dd<melhor){melhor=dd;perto=i;}
      const f=hover===i||(hover>=0&&nos[hover].lig.includes(i)); const r=(f?4:2.8)+(hover===i?1.4*Math.sin(t*6)+1.4:0);
      ctx.shadowColor='#FFA834'; ctx.shadowBlur=f?22:10; ctx.fillStyle=f?'#FFE3B8':`rgba(255,190,100,${.55+A[2]*.45})`; ctx.beginPath(); ctx.arc(A[0],A[1],r*monta,0,7); ctx.fill(); ctx.shadowBlur=0; });
    if(!arr) hover=perto;
    requestAnimationFrame(quadro);
  }
  requestAnimationFrame(quadro);
  return {parar(){vivo=false; io.disconnect(); removeEventListener('resize',onR);}};
}
criaGlobo($('#globoFixado'),{pontos:movelLeve?650:900,pessoas:18,arcos:8,escala:.34,vel:.0026,interativo:true,malha:!movelLeve,monta:1.4,yaw:2.1});

/* ---------- abertura cinematográfica (uma vez por sessão) ---------- */
let viuAbertura=false; try{ viuAbertura=sessionStorage.getItem('orvok-abertura')==='1'; }catch{}
if(!reduz && !viuAbertura){
  const ab=$('#abertura'); ab.hidden=false; document.body.classList.add('com-abertura');
  const g=criaGlobo($('#aberturaCanvas'),{pontos:movelLeve?1000:2000,pessoas:30,arcos:14,escala:innerWidth<700?.34:.3,vel:.004,malha:!movelLeve,monta:1.2,desloca:-.06});
  setTimeout(()=>ab.classList.add('fala'),500);
  let saiu=false; const sair=()=>{ if(saiu) return; saiu=true; try{sessionStorage.setItem('orvok-abertura','1')}catch{}
    ab.classList.add('sai'); document.body.classList.add('entrou'); setTimeout(()=>{ g.parar(); ab.remove(); },1200); };
  setTimeout(sair,2100); ab.addEventListener('click',sair); addEventListener('keydown',sair,{once:true});
}

/* ---------- fundo: constelação viva que reage ao cursor ---------- */
(function(){ const cv=$('#fundo'); if(movelLeve||reduz){ cv.remove(); return; } const c=cv.getContext('2d'); let W,H,nos=[]; const m={x:-1e4,y:-1e4};
  function tam(){ const d=Math.min(devicePixelRatio||1,2); W=innerWidth; H=innerHeight; cv.width=W*d; cv.height=H*d; c.setTransform(d,0,0,d,0,0);
    const n=Math.round(W*H/22000); nos=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:rnd(-.12,.12),vy:rnd(-.12,.12),a:Math.random()<.14})); }
  tam(); addEventListener('resize',tam); addEventListener('pointermove',e=>{m.x=e.clientX;m.y=e.clientY;},{passive:true});
  function q(){ if(document.hidden){requestAnimationFrame(q);return;} c.clearRect(0,0,W,H); const az=escuro()?'127,178,255':'31,92,255';
    nos.forEach(n=>{ if(!reduz){n.x+=n.vx;n.y+=n.vy;} if(n.x<0||n.x>W) n.vx*=-1; if(n.y<0||n.y>H) n.vy*=-1; });
    for(let i=0;i<nos.length;i++){ const a=nos[i]; for(let j=i+1;j<nos.length;j++){ const b=nos[j], d=Math.hypot(a.x-b.x,a.y-b.y); if(d<130){ const perto=Math.hypot((a.x+b.x)/2-m.x,(a.y+b.y)/2-m.y)<170; c.strokeStyle=`rgba(${az},${(1-d/130)*(perto?.45:.12)})`; c.lineWidth=perto?1:.6; c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke(); } } }
    nos.forEach(n=>{ const perto=Math.hypot(n.x-m.x,n.y-m.y)<170; c.fillStyle=n.a?`rgba(255,168,52,${perto?.95:.55})`:`rgba(${az},${perto?.9:.4})`; c.beginPath(); c.arc(n.x,n.y,n.a?2:1.3,0,7); c.fill(); });
    requestAnimationFrame(q); }
  requestAnimationFrame(q); })();

/* ---------- teia decorativa do cartão fixado ---------- */
function desenhaTeia(cv,cor){ const r=cv.getBoundingClientRect(); if(!r.width) return; const d=Math.min(devicePixelRatio||1,2); cv.width=r.width*d; cv.height=r.height*d; const c=cv.getContext('2d'); c.scale(d,d);
  const pts=Array.from({length:30},(_,i)=>[((Math.sin(i*12.9898)*43758.5453)%1+1)%1*r.width,((Math.sin(i*78.233)*12345.678)%1+1)%1*r.height]); c.strokeStyle=cor; c.lineWidth=.8;
  pts.forEach((a,i)=>pts.forEach((b,j)=>{ if(j<=i) return; const dd=Math.hypot(a[0]-b[0],a[1]-b[1]); if(dd<120){ c.globalAlpha=(1-dd/120)*.45; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); } }));
  const am=cssv('--ambar'); pts.forEach((a,i)=>{ c.globalAlpha=1; c.fillStyle=i%5===0?am:cor; c.beginPath(); c.arc(a[0],a[1],i%5===0?2.6:1.6,0,7); c.fill(); }); }
function teias(){ const az=cssv('--azul'); const tv=$('#teiaViva'); if(tv) desenhaTeia(tv,az); }
teias(); addEventListener('resize',teias);

/* ---------- tema ---------- */
const btnTema=$('#tema');
function iconeTema(){ btnTema.querySelector('svg').outerHTML=ic(escuro()?'sol':'lua'); }
btnTema.addEventListener('click',()=>{ const n=escuro()?'light':'dark'; document.documentElement.dataset.theme=n; try{localStorage.setItem('orvok-tema',n)}catch{} iconeTema(); teias(); });

const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visivel'); io.unobserve(e.target);} }),{threshold:.18});
$$('.secao').forEach(el=> reduz ? el.classList.add('visivel') : io.observe(el));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
pintaIcones(); iconeTema();
})();
