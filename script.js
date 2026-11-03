/* ============ CONFIGURACIÓN (cambia aquí lo que quieras) ============ */
const CFG = {
  velocidadCanto: 0.8,       // Qué tan despacio canta la bola. 1 = normal, 0.7 = más lento, 1.2 = más rápido
  velocidadRecuento: 1.0,    // Velocidad de la voz durante el reconteo
  pausaRecuento: 1200,       // Milisegundos entre una bola y otra en el reconteo (1000 = 1 segundo)
  esperaEntreBolas: 4000,    // Milisegundos de espera entre una bola y la siguiente
  tiempoRevolver: 2500,      // Milisegundos que gira el bombo antes de sacar la bola
  idioma: 'es-CO',           // Idioma preferido de la voz (es-CO, es-MX, es-US, es-ES)
  usarAudios: false,         // false = voz del navegador | true = tus propios archivos en la carpeta audio/
  carpetaAudios: 'audio/'    // Archivos esperados: audio/B1.mp3, audio/B2.mp3 ... audio/O75.mp3
};
/* =================================================================== */

const LETRAS = ['B', 'I', 'N', 'G', 'O'];
const NOMBRES = ['be', 'i', 'ene', 'ge', 'o'];
const TAM = 190; // tamaño de la bola voladora (igual que en el CSS)

const ICONOS = {
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  table: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>'
};
const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[n]}</svg>`;

const $ = id => document.getElementById(id);
const p2 = n => String(n).padStart(2, '0');
const filaDe = n => Math.ceil(n / 15) - 1;
const celda = n => $('c' + n);
const etiqueta = n => LETRAS[filaDe(n)] + n; // para los audios: B1, I20, O75...
const tablero = $('tablero'), svgBombo = $('svgBombo'), bola = $('bola'), bolaGrande = $('bolaGrande');
const btnJugar = $('btnJugar'), btnRecuento = $('btnRecuento'), btnSiguiente = $('btnSiguiente'), selVoz = $('selVoz');

let pool = [], llamadas = [];
let jugando = false, recontando = false, ciclo = false, enTurno = false, partida = 0;
let despertar = null, audioActual = null, voz = null, vocesES = [];

const terminado = () => !pool.length && !enTurno;
const dormir = ms => new Promise(r => setTimeout(r, ms));
function esperar(ms) {
  return new Promise(res => {
    const t = setTimeout(res, ms);
    despertar = () => { clearTimeout(t); res(); };
  });
}
function mezclar(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const centro = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const dentro = p => ({ x: Math.min(Math.max(p.x, 0), innerWidth), y: Math.min(Math.max(p.y, 0), innerHeight) });
const pos = (x, y, s) => `translate(${x - TAM / 2}px, ${y - TAM / 2}px) scale(${s})`;

/* ---------- Construcción de la interfaz ---------- */
function construirBombo() {
  const cols = ['#2563eb', '#dc2626', '#f1f5f9', '#059669', '#f59e0b'];
  let h = '';
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 78;
    const x = 150 + Math.cos(a) * r, y = 150 + Math.sin(a) * r, rad = 8 + Math.random() * 3;
    const dx = (Math.random() * 30 - 15).toFixed(1), dy = (Math.random() * 30 - 15).toFixed(1);
    h += `<g class="bolita" style="--dx:${dx}px;--dy:${dy}px"><circle cx="${x}" cy="${y}" r="${rad}" fill="${cols[i % 5]}"/><circle cx="${x - rad * .35}" cy="${y - rad * .35}" r="${rad * .28}" fill="#fff" opacity=".7"/></g>`;
  }
  $('bolitas').innerHTML = h;
}
function construirTablero() {
  tablero.innerHTML = '';
  LETRAS.forEach((L, f) => {
    const col = document.createElement('div');
    col.className = 'col';
    let h = `<div class="chip c${f}">${L}</div>`;
    for (let i = 1; i <= 15; i++) { const n = f * 15 + i; h += `<div class="celda c${f}" id="c${n}">${p2(n)}</div>`; }
    col.innerHTML = h;
    tablero.appendChild(col);
  });
}
function mostrarGrande(n) {
  const f = filaDe(n);
  bolaGrande.className = 'bolaVis c' + f;
  bolaGrande.querySelector('.l').textContent = LETRAS[f];
  bolaGrande.querySelector('.n').textContent = p2(n);
  void bolaGrande.offsetWidth;
  bolaGrande.classList.add('pop');
}
function resetGrande() {
  bolaGrande.className = 'bolaVis';
  bolaGrande.querySelector('.l').textContent = '--';
  bolaGrande.querySelector('.n').textContent = '00';
}
function renderUltimas() {
  const l = llamadas.slice(-5).reverse();
  $('ultimas').innerHTML = l.length
    ? l.map(n => `<div class="chipbola c${filaDe(n)}"><small>${LETRAS[filaDe(n)]}</small><b>${p2(n)}</b></div>`).join('')
    : '<em>Aún no se han sacado bolas</em>';
}
function actualizar() {
  const rest = 75 - llamadas.length;
  $('restantes').textContent = rest;
  $('badgeBolas').textContent = rest + ' Bolas';

  let est = ['listo', 'Listo para iniciar'];
  if (recontando) est = ['recuento', 'Recontando…'];
  else if (terminado() && llamadas.length) est = ['fin', 'Juego terminado'];
  else if (jugando) est = ['jugando', 'Jugando'];
  else if (llamadas.length) est = ['pausa', 'En pausa'];
  $('estado').className = 'pill ' + est[0];
  $('estadoTxt').textContent = est[1];

  const fin = terminado() && llamadas.length > 0;
  btnJugar.className = 'btn-main' + (jugando ? ' pausar' : '');
  btnJugar.disabled = fin;
  const txt = fin ? 'Juego terminado' : jugando ? 'Pausar Juego' : llamadas.length ? 'Continuar Juego' : 'Iniciar Juego';
  btnJugar.innerHTML = `${svg(jugando ? 'pause' : 'play')}<span>${txt}</span>`;

  $('txtRecuento').textContent = recontando ? 'Detener' : 'Reconteo';
  btnRecuento.disabled = !recontando && (jugando || enTurno || !llamadas.length);
  btnSiguiente.disabled = fin || recontando || (!jugando && (enTurno || !pool.length));
}

/* ---------- Voz ---------- */
const MUJER = ['sabina', 'helena', 'laura', 'dalia', 'elena', 'paulina', 'monica', 'mónica', 'paloma', 'salome', 'salomé', 'elvira', 'lucia', 'lucía', 'camila', 'marisol', 'catalina', 'maria', 'maría', 'sofia', 'sofía', 'valentina', 'ximena', 'tatiana', 'conchita', 'penelope', 'penélope', 'gabriela', 'jimena', 'carmen', 'abril', 'mireia', 'estrella', 'nuria', 'esperanza'];
const HOMBRE = ['raul', 'raúl', 'pablo', 'jorge', 'alvaro', 'álvaro', 'diego', 'juan', 'carlos', 'alonso', 'gonzalo', 'arnau', 'enrique', 'miguel', 'mateo', 'tomas', 'tomás', 'pedro', 'santiago', 'andres', 'andrés', 'emilio', 'jose', 'josé', 'luis', 'manuel', 'sergio', 'mauricio', 'jaime', 'ramon', 'ramón', 'jesus', 'jesús', 'antonio', 'ricardo', 'alberto'];
function etiquetaVoz(v) {
  const n = v.name.toLowerCase();
  const g = MUJER.some(x => n.includes(x)) ? ' · mujer' : HOMBRE.some(x => n.includes(x)) ? ' · hombre' : '';
  return v.name + g;
}
function llenarVoces() {
  if (CFG.usarAudios || !('speechSynthesis' in window)) { $('vozWrap').classList.add('oculta'); return; }
  const vs = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang.replace('_', '-')));
  selVoz.innerHTML = '';
  if (!vs.length) { selVoz.appendChild(new Option('Voz automática', 0)); voz = null; vocesES = []; return; }
  vs.sort((a, b) => a.name.localeCompare(b.name));
  vs.forEach((v, i) => selVoz.appendChild(new Option(etiquetaVoz(v), i)));
  let guardada = null;
  try { guardada = localStorage.getItem('bingoVoz'); } catch (e) {}
  const actual = voz ? voz.name : guardada;
  let i = vs.findIndex(v => v.name === actual);
  if (i < 0) i = vs.findIndex(v => v.lang.replace('_', '-').toLowerCase().startsWith(CFG.idioma.toLowerCase()));
  if (i < 0) i = 0;
  selVoz.value = i; voz = vs[i]; vocesES = vs;
}
selVoz.onchange = () => {
  voz = vocesES[selVoz.value] || null;
  if (voz) { try { localStorage.setItem('bingoVoz', voz.name); } catch (e) {} }
  if (!jugando && !recontando && !enTurno) { detenerVoz(); decir(12, CFG.velocidadCanto); } // prueba de la voz
};
if ('speechSynthesis' in window) { speechSynthesis.onvoiceschanged = llenarVoces; }

function detenerVoz() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (audioActual) { audioActual.pause(); audioActual.dispatchEvent(new Event('ended')); }
}
function decir(n, velocidad) {
  return new Promise(res => {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; clearTimeout(guarda); audioActual = null; res(); } };
    const guarda = setTimeout(fin, 10000);
    if (CFG.usarAudios) {
      const a = new Audio(`${CFG.carpetaAudios}${etiqueta(n)}.mp3`);
      a.playbackRate = velocidad; audioActual = a;
      a.onended = fin; a.onerror = fin;
      a.play().catch(fin);
    } else {
      if (!('speechSynthesis' in window)) return fin();
      const u = new SpeechSynthesisUtterance(`${NOMBRES[filaDe(n)]}, ${n}`);
      u.lang = voz ? voz.lang : CFG.idioma;
      if (voz) u.voice = voz;
      u.rate = velocidad; u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    }
  });
}

/* ---------- Animación de la bola voladora ---------- */
function prepararBola(n) {
  const f = filaDe(n);
  bola.className = 'bolaVis c' + f;
  bola.querySelector('.l').textContent = LETRAS[f];
  bola.querySelector('.n').textContent = p2(n);
  bola.classList.remove('oculta');
}
async function volar(frames, ms, easing) {
  bola.getAnimations().forEach(a => a.cancel());
  const a = bola.animate(frames, { duration: ms, easing, fill: 'forwards' });
  try { await a.finished; } catch (e) {}
}

/* ---------- Un turno: revolver, sacar, cantar, colocar ---------- */
async function turno(manual = false) {
  const p = partida;
  enTurno = true;
  const n = pool.pop();
  actualizar();
  try {
    svgBombo.classList.add('girando');
    await esperar(CFG.tiempoRevolver);
    if (p !== partida) return;
    if (!manual && !jugando) { pool.push(n); svgBombo.classList.remove('girando'); return; }
    llamadas.push(n);

    // 1) del bombo a la tarjeta "Última bola cantada"
    prepararBola(n);
    const d = centro(svgBombo), t = dentro(centro(bolaGrande)), s = bolaGrande.offsetWidth / TAM;
    await volar([{ transform: pos(d.x, d.y, .15), opacity: 0 }, { transform: pos(t.x, t.y, s), opacity: 1 }], 900, 'cubic-bezier(.2,.8,.2,1)');
    if (p !== partida) return;
    svgBombo.classList.remove('girando');
    bola.classList.add('oculta');
    mostrarGrande(n); renderUltimas(); actualizar();

    // 2) cantar
    await decir(n, CFG.velocidadCanto);
    if (p !== partida) return;
    await esperar(500);
    if (p !== partida) return;

    // 3) de la tarjeta a su casilla del tablero
    const c = celda(n);
    let r = c.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight - 90) c.scrollIntoView({ block: 'center' });
    const o = dentro(centro(bolaGrande)), e = centro(c);
    prepararBola(n);
    await volar([{ transform: pos(o.x, o.y, s), opacity: 1 }, { transform: pos(e.x, e.y, Math.min(c.offsetWidth, c.offsetHeight) / TAM), opacity: .9 }], 800, 'ease-in-out');
    if (p !== partida) return;
    bola.classList.add('oculta');
    c.classList.add('salio', 'pop');
  } finally {
    if (p === partida) { enTurno = false; actualizar(); }
  }
}

async function bucle() {
  if (ciclo) return;
  ciclo = true;
  const p = partida;
  while (enTurno && p === partida) await dormir(100);
  while (p === partida && jugando && pool.length) {
    await turno();
    if (p === partida && jugando && pool.length) await esperar(CFG.esperaEntreBolas);
  }
  if (p !== partida) return;
  ciclo = false;
  if (!pool.length) jugando = false;
  actualizar();
}

/* ---------- Botones ---------- */
function alternarJuego() {
  if (jugando) {                       // PAUSAR
    jugando = false;
    detenerVoz();
    if (despertar) despertar();
    actualizar();
  } else {                             // INICIAR / CONTINUAR
    if (recontando) { recontando = false; detenerVoz(); if (despertar) despertar(); }
    if (!pool.length) return;
    jugando = true;
    actualizar();
    bucle();
  }
}

function siguiente() {                 // ⏭ Sacar la siguiente bola / saltar la espera
  if (terminado() || recontando) return;
  if (jugando) { if (despertar) despertar(); return; }
  if (enTurno || !pool.length) return;
  turno(true);
}

async function recontar() {            // Reconteo: B → I → N → G → O (de menor a mayor)
  if (recontando) { recontando = false; detenerVoz(); if (despertar) despertar(); return; }
  if (jugando || enTurno || !llamadas.length) return;
  recontando = true; actualizar();
  const p = partida;
  const lista = [...llamadas].sort((a, b) => a - b);
  for (const n of lista) {
    if (!recontando || p !== partida) break;
    const c = celda(n);
    c.classList.add('resalta');
    c.scrollIntoView({ block: 'nearest' });
    mostrarGrande(n);
    await decir(n, CFG.velocidadRecuento);
    c.classList.remove('resalta');
    if (!recontando || p !== partida) break;
    await esperar(CFG.pausaRecuento);
  }
  if (p !== partida) return;
  recontando = false;
  document.querySelectorAll('.resalta').forEach(e => e.classList.remove('resalta'));
  if (llamadas.length) mostrarGrande(llamadas[llamadas.length - 1]);
  actualizar();
}

function nuevaPartida() {
  partida++; jugando = false; recontando = false; ciclo = false; enTurno = false;
  detenerVoz(); if (despertar) despertar();
  bola.getAnimations().forEach(a => a.cancel()); bola.classList.add('oculta');
  svgBombo.classList.remove('girando');
  pool = mezclar(Array.from({ length: 75 }, (_, i) => i + 1));
  llamadas = [];
  construirTablero(); resetGrande(); renderUltimas(); actualizar();
}
function reiniciar() {
  if (llamadas.length && !confirm('¿Empezar un juego nuevo? Se borrarán las bolas que ya salieron.')) return;
  nuevaPartida();
}

btnJugar.onclick = alternarJuego;
btnRecuento.onclick = recontar;
btnSiguiente.onclick = siguiente;
$('btnReiniciar').onclick = reiniciar;

document.querySelectorAll('[data-i]').forEach(e => e.innerHTML = svg(e.dataset.i));
construirBombo();
nuevaPartida();
llenarVoces();
setTimeout(llenarVoces, 600); // por si el navegador carga las voces con retraso
