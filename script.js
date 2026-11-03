/* ============ CONFIGURACIÓN (cambia aquí lo que quieras) ============ */
const CFG = {
  velocidadCanto: 0.8,       // Qué tan despacio canta la bola. 1 = normal, 0.7 = más lento, 1.2 = más rápido
  velocidadRecuento: 1.0,    // Velocidad de la voz durante el recuento
  pausaRecuento: 1200,       // Milisegundos entre una bola y otra en el recuento (1000 = 1 segundo)
  esperaEntreBolas: 4000,    // Milisegundos de espera entre una bola y la siguiente
  tiempoRevolver: 2500,      // Milisegundos que gira el bombo antes de sacar la bola
  ordenRecuento: 'salida',   // 'salida' = en el orden que salieron | 'numerico' = ordenadas de menor a mayor
  idioma: 'es-CO',           // Idioma preferido de la voz (es-CO, es-MX, es-US, es-ES)
  usarAudios: false,         // false = voz del navegador | true = tus propios archivos en la carpeta audio/
  carpetaAudios: 'audio/'    // Archivos esperados: audio/B1.mp3, audio/B2.mp3 ... audio/O75.mp3
};
/* =================================================================== */

const LETRAS = ['B', 'I', 'N', 'G', 'O'];
const NOMBRES = ['be', 'i', 'ene', 'ge', 'o'];
const COLORES = ['#2f6fed', '#e53935', '#8e63d1', '#2e9e4f', '#f5a623'];

const $ = id => document.getElementById(id);
const tablero = $('tablero'), bombo = $('bombo'), bola = $('bola');
const btnJugar = $('btnJugar'), btnRecuento = $('btnRecuento');

let pool = [], llamadas = [];
let jugando = false, recontando = false, ciclo = false, partida = 0;
let despertar = null, audioActual = null, voz = null;

const filaDe = n => Math.ceil(n / 15) - 1;
const etiqueta = n => LETRAS[filaDe(n)] + n;
const celda = n => $('c' + n);

/* ---------- Construcción de la interfaz ---------- */
function construirTablero() {
  tablero.innerHTML = '';
  LETRAS.forEach((L, f) => {
    const l = document.createElement('div');
    l.className = 'letra'; l.textContent = L; l.style.setProperty('--c', COLORES[f]);
    tablero.appendChild(l);
    for (let i = 1; i <= 15; i++) {
      const n = f * 15 + i, c = document.createElement('div');
      c.className = 'celda'; c.id = 'c' + n; c.textContent = n;
      c.style.setProperty('--c', COLORES[f]);
      tablero.appendChild(c);
    }
  });
}
function construirBombo() {
  bombo.innerHTML = '';
  for (let i = 0; i < 14; i++) {
    const m = document.createElement('div');
    m.className = 'mini';
    m.style.left = (12 + Math.random() * 62) + '%';
    m.style.top = (12 + Math.random() * 62) + '%';
    m.style.setProperty('--c', COLORES[i % 5]);
    m.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
    m.style.setProperty('--dy', (Math.random() * 60 - 30) + 'px');
    bombo.appendChild(m);
  }
}

/* ---------- Utilidades ---------- */
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
const pos = (x, y, s) => `translate(${x - 85}px, ${y - 85}px) scale(${s})`;

function actualizar() {
  btnJugar.textContent = jugando ? '⏸ Pausar' : '▶ Jugar';
  btnJugar.disabled = pool.length === 0 && !jugando;
  btnRecuento.textContent = recontando ? '⏹ Detener recuento' : '🔊 Recuento';
  btnRecuento.disabled = !recontando && (jugando || llamadas.length === 0);
  $('contador').textContent = `${llamadas.length} / 75`;
}

/* ---------- Voz ---------- */
function elegirVoz() {
  const vs = speechSynthesis.getVoices();
  for (const p of [CFG.idioma, 'es-MX', 'es-US', 'es-ES', 'es']) {
    const v = vs.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(p.toLowerCase()));
    if (v) { voz = v; return; }
  }
}
if ('speechSynthesis' in window) { speechSynthesis.onvoiceschanged = elegirVoz; elegirVoz(); }

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
      const u = new SpeechSynthesisUtterance(`${NOMBRES[filaDe(n)]}, ${n}`);
      u.lang = voz ? voz.lang : CFG.idioma;
      if (voz) u.voice = voz;
      u.rate = velocidad; u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    }
  });
}

/* ---------- Un turno: revolver, sacar, cantar, colocar ---------- */
async function turno() {
  const p = partida;
  const n = pool.pop();
  llamadas.push(n);
  bombo.classList.add('girando');
  await esperar(CFG.tiempoRevolver);
  if (p !== partida) return;
  if (!jugando) { pool.push(n); llamadas.pop(); bombo.classList.remove('girando'); actualizar(); return; }

  const f = filaDe(n);
  bola.getAnimations().forEach(a => a.cancel());
  bola.style.setProperty('--c', COLORES[f]);
  bola.querySelector('.l').textContent = LETRAS[f];
  bola.querySelector('.n').textContent = n;
  bola.classList.remove('oculta');
  $('ultima').textContent = `Última: ${LETRAS[f]}-${n}`;
  actualizar();

  const d = centro(bombo), cx = innerWidth / 2, cy = innerHeight / 2;
  await bola.animate([{ transform: pos(d.x, d.y, .15), opacity: 0 }, { transform: pos(cx, cy, 1), opacity: 1 }],
    { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished;
  bombo.classList.remove('girando');
  if (p !== partida) return;

  await decir(n, CFG.velocidadCanto);
  if (p !== partida) return;
  await esperar(500);
  if (p !== partida) return;

  const c = celda(n), t = centro(c);
  await bola.animate([{ transform: pos(cx, cy, 1), opacity: 1 }, { transform: pos(t.x, t.y, c.offsetWidth / 170), opacity: .9 }],
    { duration: 800, easing: 'ease-in-out', fill: 'forwards' }).finished;
  if (p !== partida) return;
  bola.classList.add('oculta');
  c.classList.add('salio');
}

async function bucle() {
  if (ciclo) return;
  ciclo = true;
  const p = partida;
  while (p === partida && jugando && pool.length) {
    await turno();
    if (p === partida && jugando && pool.length) await esperar(CFG.esperaEntreBolas);
  }
  if (p !== partida) return;
  ciclo = false;
  if (!pool.length) { jugando = false; $('ultima').textContent = '¡Fin del juego! Salieron las 75 bolas'; }
  actualizar();
}

/* ---------- Botones ---------- */
function alternarJuego() {
  if (jugando) {                       // PAUSAR
    jugando = false;
    detenerVoz();
    if (despertar) despertar();
    actualizar();
  } else {                             // JUGAR
    if (recontando) { recontando = false; detenerVoz(); if (despertar) despertar(); }
    if (!pool.length) return;
    jugando = true;
    actualizar();
    bucle();
  }
}

async function recontar() {
  if (recontando) { recontando = false; detenerVoz(); if (despertar) despertar(); return; }
  if (jugando || !llamadas.length) return;
  recontando = true; actualizar();
  const p = partida;
  const lista = CFG.ordenRecuento === 'numerico' ? [...llamadas].sort((a, b) => a - b) : [...llamadas];
  for (const n of lista) {
    if (!recontando || p !== partida) break;
    celda(n).classList.add('resalta');
    await decir(n, CFG.velocidadRecuento);
    celda(n).classList.remove('resalta');
    if (!recontando || p !== partida) break;
    await esperar(CFG.pausaRecuento);
  }
  if (p !== partida) return;
  recontando = false;
  document.querySelectorAll('.resalta').forEach(e => e.classList.remove('resalta'));
  actualizar();
}

function reiniciar() {
  if (llamadas.length && !confirm('¿Empezar un juego nuevo? Se borrarán las bolas que ya salieron.')) return;
  partida++; jugando = false; recontando = false; ciclo = false;
  detenerVoz(); if (despertar) despertar();
  bola.getAnimations().forEach(a => a.cancel()); bola.classList.add('oculta');
  bombo.classList.remove('girando');
  pool = mezclar(Array.from({ length: 75 }, (_, i) => i + 1));
  llamadas = [];
  construirTablero();
  $('ultima').textContent = 'Pulsa «Jugar» para empezar';
  actualizar();
}

btnJugar.onclick = alternarJuego;
btnRecuento.onclick = recontar;
$('btnReiniciar').onclick = reiniciar;

construirBombo();
partida = 0;
pool = mezclar(Array.from({ length: 75 }, (_, i) => i + 1));
construirTablero();
actualizar();
