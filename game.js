/* KUKİ: Eto'ya Karşı — v2.0 */
'use strict';
(() => {

// ============================================================
//  Sabitler
// ============================================================
const W = 480, H = 800, GROUND = 712;
const KUKI_X = 120;
const GRAVITY = 1500, FLAP = -440, MAX_FALL = 720;
const KUKI_HP = 5;
const KUKILE_AT = 8;   // Yavuz: kaç isabette Eto kukilenir
const LEVELS = {
  1: { title: 'BÖLÜM 1', name: 'Kantin', obstacles: 12, speed: 165, gap0: 210, gapMin: 168, hp: 80, boss: 'ETO', sub: 'Şaşı Sultan', cave: false, music: 'main', bossSub: 'Şaşı Sultan geliyor!' },
  2: { title: 'BÖLÜM 2', name: 'Mağara', obstacles: 15, speed: 182, gap0: 205, gapMin: 160, hp: 110, boss: 'MAĞARA ETO', sub: 'Uga Buga Sultan', cave: true, music: 'cave', bossSub: 'Eto mağarasından çıktı!' },
};
let LV = 1, L = LEVELS[1];
let CH = 'mustafa';
const ULT_AT = 0.55, ULT_DMG = 14;   // destek ultisi: tek sefer, Eto'nun canı %55'e inince
const INK = '#1a1320';

const $ = s => document.querySelector(s);
const stage = $('#stage'), canvas = $('#game'), ctx = canvas.getContext('2d');
let scale = 1, dpr = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

// ============================================================
//  Ekran ölçekleme
// ============================================================
function resize() {
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  stage.style.width = W * scale + 'px';
  stage.style.height = H * scale + 'px';
  stage.style.fontSize = 16 * scale + 'px';
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
resize();

// ============================================================
//  Ses: ıslık + sentez müzik + efektler
// ============================================================
const NOTE = m => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
const SONGS = {
  main: {
    bpm: 132, leadType: 'square', leadVol: 0.32,
    lead: [72,_,76,79, 76,_,72,74,  76,_,74,72, 69,_,67,_,  72,_,76,79, 81,_,79,76,  77,76,74,72, 74,_,72,_],
    bass: [48,_,55,_, 52,_,55,_,  45,_,52,_, 48,_,52,_,  41,_,48,_, 45,_,48,_,  43,_,50,_, 47,_,50,_],
    drums: true, kickEvery: 4,
  },
  boss: {
    bpm: 168, leadType: 'sawtooth', leadVol: 0.2,
    lead: [69,72,76,72, 69,72,76,77,  76,74,72,71, 72,_,69,_,  65,69,72,69, 67,71,74,71,  76,_,75,_, 76,77,76,_],
    bass: [45,45,57,45, 45,45,57,45,  41,41,53,41, 41,41,53,41,  43,43,55,43, 43,43,55,43,  40,40,52,40, 44,44,56,44],
    drums: true, kickEvery: 2,
  },
  cave: {
    bpm: 118, leadType: 'triangle', leadVol: 0.5,
    lead: [69,_,72,_, 74,_,72,69,  67,_,69,_, _,_,_,_,  69,_,72,74, 76,_,74,72,  74,_,72,_, 69,_,_,_],
    bass: [45,_,45,_, 45,_,52,_,  43,_,43,_, 43,_,50,_,  41,_,41,_, 41,_,48,_,  40,_,40,_, 45,_,_,_],
    drums: true, kickEvery: 2,
  },
};

const Sound = {
  ctx: null, master: null, music: null, sfx: null, noiseBuf: null,
  whistleBuf: null, whistleSrc: null, fallback: null,
  muted: store('kuki_muted') === '1',
  song: null, step: 0, nextTime: 0, timer: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.fallback = new Audio('assets/islik.mp3'); return; }
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0.11; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.loadWhistle();
  },
  async loadWhistle() {
    try {
      const r = await fetch('assets/islik.mp3');
      const ab = await r.arrayBuffer();
      this.whistleBuf = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
    } catch (e) { this.fallback = new Audio('assets/islik.mp3'); }
  },
  setMuted(m) {
    this.muted = m; store('kuki_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
    updateMuteIcon();
  },
  whistle() {
    if (this.muted) return;
    if (this.whistleBuf) {
      try { if (this.whistleSrc) this.whistleSrc.stop(); } catch (e) {}
      const s = this.ctx.createBufferSource();
      s.buffer = this.whistleBuf;
      s.playbackRate.value = rand(0.93, 1.08) * (CHARS[CH] ? CHARS[CH].pitch : 1);
      const g = this.ctx.createGain(); g.gain.value = 1.6;
      s.connect(g); g.connect(this.master);
      s.start();
      this.whistleSrc = s;
    } else if (this.fallback) {
      try { this.fallback.currentTime = 0; this.fallback.play().catch(() => {}); } catch (e) {}
    }
  },
  tone(f, dur, type = 'square', vol = 0.3, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, hp = 1000, when = 0, dest = null) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t); s.stop(t + dur + 0.02);
  },
  sfxScore() { this.tone(880, 0.08, 'square', 0.15); this.tone(1320, 0.12, 'square', 0.15, null, 0.07); },
  sfxThrow() { this.noise(0.12, 0.18, 2500); },
  sfxBoing() { this.tone(300, 0.35, 'triangle', 0.5, 90); this.tone(620, 0.1, 'square', 0.12); },
  sfxHurt() { this.tone(220, 0.3, 'sawtooth', 0.3, 60); this.noise(0.2, 0.25, 400); },
  sfxDie() { this.tone(600, 0.7, 'square', 0.25, 80); },
  sfxSlipper() { this.noise(0.18, 0.12, 1200); this.tone(500, 0.12, 'triangle', 0.12, 250); },
  sfxLaserWarn() { this.tone(900, 0.12, 'square', 0.12); this.tone(900, 0.12, 'square', 0.12, null, 0.25); this.tone(900, 0.12, 'square', 0.12, null, 0.5); },
  sfxLaser() { this.tone(1400, 0.5, 'sawtooth', 0.2, 200); this.noise(0.5, 0.15, 3000); },
  sfxAlarm() { for (let i = 0; i < 4; i++) { this.tone(520, 0.22, 'square', 0.2, 780, i * 0.45); } },
  sfxWin() { [72, 76, 79, 84, 79, 84].forEach((m, i) => this.tone(NOTE(m), i === 5 ? 0.6 : 0.16, 'square', 0.22, null, i * 0.14)); },
  sfxClick() { this.tone(660, 0.06, 'square', 0.12); },
  sfxSupport() { [67, 72, 76, 79, 84].forEach((m, i) => this.tone(NOTE(m), 0.18, 'triangle', 0.3, null, i * 0.09)); },
  sfxUlt() { this.tone(140, 0.9, 'sawtooth', 0.25, 1800); this.noise(0.9, 0.12, 2000); },
  sfxSlurp() { this.tone(900, 0.14, 'square', 0.12, 180); this.noise(0.08, 0.25, 3000, 0.06); },
  sfxCrunch() { this.noise(0.06, 0.2, 4000); this.noise(0.05, 0.15, 5000, 0.05); },
  sfxKuki() { [76, 79, 84, 88].forEach((m, i) => this.tone(NOTE(m), 0.12, 'square', 0.2, null, i * 0.07)); },
  sfxRumble() { this.tone(70, 0.6, 'sawtooth', 0.35, 40); this.noise(0.5, 0.25, 100); },
  // mağara adamı homurtusu
  grunt(n = 1) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let k = 0; k < n; k++) {
      const t = c.currentTime + k * 0.26, base = rand(80, 125), len = rand(0.2, 0.32);
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.35, t); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + len);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 28; lg.gain.value = 14;
      lfo.connect(lg); lg.connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.8;
      f.frequency.setValueAtTime(rand(550, 850), t); f.frequency.exponentialRampToValueAtTime(320, t + len);
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(2.6, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(f); f.connect(g); g.connect(this.sfx);
      o.start(t); lfo.start(t); o.stop(t + len + 0.03); lfo.stop(t + len + 0.03);
      this.noise(len * 0.7, 0.06, 300, k * 0.26);
    }
  },

  playMusic(name) {
    if (this.song === name) return;
    this.song = name; this.step = 0;
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.06;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },
  stopMusic() { this.song = null; },
  tick() {
    if (!this.ctx || !this.song) return;
    const song = SONGS[this.song], sd = 60 / song.bpm / 2, now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.12) {
      this.playStep(song, this.step, this.nextTime, sd);
      this.nextTime += sd;
      this.step = (this.step + 1) % song.lead.length;
    }
  },
  playStep(song, i, t, sd) {
    const c = this.ctx;
    const note = (m, type, vol, dur) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = NOTE(m);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.02);
    };
    if (song.lead[i] != null) note(song.lead[i], song.leadType, song.leadVol, sd * 0.9);
    if (song.bass[i] != null) note(song.bass[i] - 12, 'triangle', 0.9, sd * 1.6);
    if (song.drums) {
      if (i % song.kickEvery === 0) {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.17);
      }
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = i % 4 === 2 ? 1500 : 7000;
      const g = c.createGain(); const v = i % 4 === 2 ? 0.35 : 0.12;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (i % 4 === 2 ? 0.12 : 0.04));
      s.connect(f); f.connect(g); g.connect(this.music); s.start(t); s.stop(t + 0.15);
    }
  },
};

// ============================================================
//  Çizim yardımcıları
// ============================================================
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }
function fillStroke(c, fill, lw = 2, stroke = INK) { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }

// ---------- KUKİ (kuştan insana evrilmiş) ----------
function drawWing(c, px, py, ang, col) {
  c.save(); c.translate(px, py); c.rotate(ang);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(-6, -20, -30, -28, -40, -16);
  c.lineTo(-33, -11); c.lineTo(-40, -4); c.lineTo(-30, -2); c.lineTo(-34, 5); c.lineTo(-20, 3); c.lineTo(-22, 9);
  c.quadraticCurveTo(-8, 8, 0, 0);
  c.closePath();
  fillStroke(c, col, 2);
  c.strokeStyle = 'rgba(26,19,32,.35)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(-6, -4); c.lineTo(-28, -12); c.moveTo(-6, 0); c.lineTo(-24, 2); c.stroke();
  c.restore();
}

function drawCup(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.beginPath(); c.moveTo(-6, -8); c.lineTo(6, -8); c.lineTo(4.5, 8); c.lineTo(-4.5, 8); c.closePath();
  fillStroke(c, '#fbfbf7', 1.6);
  c.fillStyle = INK;
  c.fillRect(-4, -4, 3, 1.4); c.fillRect(0, -2, 4, 1.4); c.fillRect(-3, 1, 5, 1.4); c.fillRect(-2, 4, 3, 1.2);
  c.fillStyle = '#5b3a1e'; c.beginPath(); c.ellipse(0, -8, 6, 1.8, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawKuki(c, x, y, o = {}) {
  const t = o.t || 0;
  const gc = o.who && o.who !== 'mustafa' ? GUYS[o.who] : null;
  const vest = gc ? gc.shirt : '#d42a2a', vest2 = gc ? gc.sleeve : '#a81d1d', sweat = gc ? gc.sleeve : '#1b2135', skin = gc ? gc.skin : '#e3a57c';
  c.save(); c.translate(x, y); c.rotate(o.rot || 0);
  const sq = o.squash || 0; c.scale((o.size || 1) * (1 + sq * 0.2), (o.size || 1) * (1 - sq * 0.2));
  const wing = o.wing != null ? o.wing : Math.sin(t * 6) * 0.25;

  // arka kanat
  drawWing(c, -6, 4, wing * 0.8 - 0.25, '#d8d3c8');
  // kuyruk tüyleri
  c.beginPath();
  c.moveTo(-14, 22); c.lineTo(-32, 20); c.lineTo(-26, 26); c.lineTo(-34, 30); c.lineTo(-24, 31); c.lineTo(-12, 30); c.closePath();
  fillStroke(c, '#ece8de', 2);

  // gövde: kırmızı polar yelek + lacivert sweat
  c.beginPath(); c.ellipse(0, 16, 19, 17, 0, 0, Math.PI * 2); fillStroke(c, sweat, 2);
  c.save(); c.beginPath(); c.ellipse(0, 16, 19, 17, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = vest; c.fillRect(-14, -4, 26, 40);
  c.fillStyle = vest2; c.fillRect(5, 0, 1.8, 36);           // fermuar
  c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-12, 4, 5, 28);
  c.restore();
  // yaka (dik polar yaka)
  c.beginPath(); c.moveTo(-8, 0); c.lineTo(-4, -6); c.lineTo(4, 2); c.closePath(); fillStroke(c, vest, 1.6);
  c.beginPath(); c.moveTo(14, 0); c.lineTo(10, -6); c.lineTo(4, 2); c.closePath(); fillStroke(c, vest, 1.6);

  // ön kol (reflektörlü)
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.moveTo(2, 10); c.lineTo(22, 20); c.stroke();
  c.strokeStyle = sweat; c.lineWidth = 7.5; c.beginPath(); c.moveTo(2, 10); c.lineTo(22, 20); c.stroke();
  if (!gc) { c.strokeStyle = '#b9c2cc'; c.lineWidth = 7.5; c.beginPath(); c.moveTo(9, 13.5); c.lineTo(13, 15.5); c.stroke(); }
  c.lineCap = 'butt';
  // el + kahve
  if (!gc && o.cup !== false) drawCup(c, 28, 12, 0.85, 0.1);
  else if (o.who === 'sirac') drawSugar(c, 28, 13, 0.75, 0.3);
  circle(c, 24, 19, 4.6); fillStroke(c, skin, 1.6);

  // ön kanat
  drawWing(c, -8, 8, wing, '#f6f3ec');

  // ---- KAFA ----
  if (gc) { c.save(); c.translate(4, -16); c.scale(0.45, 0.45); c.translate(0, 6); drawGuyHead(c, gc, o); c.restore(); }
  else drawKukiHead(c, o, t);
  c.restore();
}

function drawKukiHead(c, o = {}, t = 0) {
  const hx = 4, hy = -16;
  circle(c, hx - 14, hy + 2, 5); fillStroke(c, '#d9966d', 1.8);      // kulak
  circle(c, hx, hy, 18); fillStroke(c, '#e3a57c', 2);
  // sakal
  c.save(); circle(c, hx, hy, 18); c.clip();
  c.beginPath(); c.moveTo(-20, hy + 3); c.quadraticCurveTo(hx + 2, hy + 12, hx + 24, hy + 1); c.lineTo(hx + 24, hy + 30); c.lineTo(-20, hy + 30); c.closePath();
  c.fillStyle = '#2b211c'; c.fill();
  c.restore();
  c.beginPath(); c.ellipse(hx + 5, hy + 16, 12, 6, 0.15, 0, Math.PI); c.fillStyle = '#2b211c'; c.fill();
  // favori
  c.fillStyle = '#2b211c'; c.fillRect(hx - 10, hy - 6, 4, 12);
  // ağız
  c.strokeStyle = '#8c4a3a'; c.lineWidth = 2; c.beginPath();
  if (o.dead) { c.arc(hx + 12, hy + 10, 3, Math.PI, 0); }
  else if (o.happy) { c.arc(hx + 12, hy + 6, 3.5, 0.1, Math.PI - 0.1); }
  else { c.moveTo(hx + 9, hy + 8); c.lineTo(hx + 15, hy + 7); }
  c.stroke();
  // bıyık
  c.fillStyle = '#2b211c'; c.beginPath(); c.ellipse(hx + 13, hy + 4, 6, 2.2, -0.1, 0, Math.PI * 2); c.fill();
  // saç (koyu, dağınık kısa)
  c.save(); circle(c, hx, hy, 18.6); c.clip();
  c.beginPath(); c.moveTo(-30, hy - 30); c.lineTo(hx + 30, hy - 30); c.lineTo(hx + 30, hy - 10);
  c.quadraticCurveTo(hx + 12, hy - 14, hx + 2, hy - 9); c.quadraticCurveTo(hx - 8, hy - 10, hx - 20, hy - 2); c.closePath();
  c.fillStyle = '#1d1714'; c.fill();
  c.restore();
  c.fillStyle = '#1d1714';
  for (let i = 0; i < 6; i++) {
    const a = -2.7 + i * 0.36;
    const bx = hx + Math.cos(a) * 16, by = hy + Math.sin(a) * 16;
    c.beginPath(); c.moveTo(bx - 4, by + 2); c.lineTo(bx + Math.cos(a) * 7 + 2, by + Math.sin(a) * 7); c.lineTo(bx + 4, by + 2); c.fill();
  }
  // kaşlar
  c.strokeStyle = '#1d1714'; c.lineWidth = 2.8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(hx + 4, hy - 7); c.lineTo(hx + 10, hy - 8.5); c.stroke();
  c.beginPath(); c.moveTo(hx + 13, hy - 8.5); c.lineTo(hx + 18, hy - 7); c.stroke();
  c.lineCap = 'butt';
  // gözler
  if (o.dead) {
    c.strokeStyle = INK; c.lineWidth = 2;
    [[hx + 7, hy - 2], [hx + 15, hy - 2]].forEach(([ex, ey]) => { c.beginPath(); c.moveTo(ex - 2.5, ey - 2.5); c.lineTo(ex + 2.5, ey + 2.5); c.moveTo(ex + 2.5, ey - 2.5); c.lineTo(ex - 2.5, ey + 2.5); c.stroke(); });
  } else {
    const blink = (t % 3.3) > 3.18;
    const big = o.scared ? 1.35 : 1;
    [[hx + 7, hy - 2, 3.8], [hx + 15, hy - 2, 3.4]].forEach(([ex, ey, r]) => {
      if (blink) { c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(ex - r, ey); c.lineTo(ex + r, ey); c.stroke(); return; }
      circle(c, ex, ey, r * big); fillStroke(c, '#fff', 1.4);
      circle(c, ex + 1.1, ey + (o.lookDown ? 1.2 : 0), 1.9); c.fillStyle = INK; c.fill();
    });
  }
  // burun
  c.beginPath(); c.moveTo(hx + 16, hy - 1); c.quadraticCurveTo(hx + 23, hy + 3, hx + 18, hy + 5); fillStroke(c, '#e3a57c', 1.6);
  if (o.hurt) { c.fillStyle = 'rgba(255,60,60,.35)'; circle(c, hx, hy, 18); c.fill(); }
}

// ---------- ETO (boss) ----------
const ETO_HAIR = [], ETO_BEARD = [];
(() => {
  const r = mulberry32(7);
  for (let i = 0; i < 90; i++) ETO_HAIR.push({ x: -50 + r() * 100, y: -62 + r() * 40, a: -0.6 + r() * 1.2, l: 6 + r() * 10, c: r() < 0.5 ? '#f4f2ee' : (r() < 0.6 ? '#2a2522' : '#b9b4ae') });
  for (let i = 0; i < 160; i++) ETO_BEARD.push({ x: -46 + r() * 92, y: 0 + r() * 80, a: 1.2 + r() * 0.7, l: 5 + r() * 9, c: r() < 0.45 ? '#f4f2ee' : (r() < 0.6 ? '#2a2522' : '#a9a49e') });
})();

function strands(c, list, lw = 1.6) {
  c.lineWidth = lw; c.lineCap = 'round';
  for (const s of list) { c.strokeStyle = s.c; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + Math.cos(s.a) * s.l, s.y + Math.sin(s.a) * s.l); c.stroke(); }
  c.lineCap = 'butt';
}

function drawEto(c, x, y, o = {}) {
  const t = o.t || 0;
  c.save(); c.translate(x, y); c.rotate(o.rot || 0);
  const s = o.size || 0.9; c.scale(s, s);
  if (o.hit > 0) c.translate(Math.sin(t * 90) * 5, 0);

  // ---- uçan kantin sandalyesi / uçan kaya ----
  if (!o.noChair && o.cave) drawRockSeat(c, t);
  else if (!o.noChair) {
    const fl = 14 + Math.sin(t * 40) * 6;
    [-40, 40].forEach(lx => {
      c.beginPath(); c.moveTo(lx - 9, 214); c.quadraticCurveTo(lx, 214 + fl * 2.2, lx + 9, 214); c.closePath();
      c.fillStyle = '#ffb03a'; c.fill();
      c.beginPath(); c.moveTo(lx - 5, 214); c.quadraticCurveTo(lx, 214 + fl * 1.2, lx + 5, 214); c.closePath();
      c.fillStyle = '#fff3b0'; c.fill();
    });
    c.strokeStyle = '#7d868e'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-44, 168); c.lineTo(-40, 212); c.moveTo(44, 168); c.lineTo(40, 212); c.stroke();
    rr(c, -52, 205, 24, 10, 3); fillStroke(c, '#5d666e', 2);
    rr(c, 28, 205, 24, 10, 3); fillStroke(c, '#5d666e', 2);
    rr(c, -66, 156, 132, 18, 8); fillStroke(c, '#f26b2a', 2.5);
    rr(c, 50, 70, 18, 96, 8); fillStroke(c, '#f26b2a', 2.5);   // sırtlık
  }

  // ---- gövde: modern lacivert ceket, açık yakalı gömlek (mağarada post) ----
  if (o.cave) drawPelt(c); else {
  c.beginPath(); c.moveTo(-58, 66); c.quadraticCurveTo(0, 44, 58, 66); c.lineTo(66, 160); c.lineTo(-66, 160); c.closePath();
  fillStroke(c, '#37405a', 2.5);
  c.beginPath(); c.moveTo(-18, 56); c.lineTo(0, 110); c.lineTo(18, 56); c.closePath(); fillStroke(c, '#f2f2ee', 2);
  c.beginPath(); c.moveTo(-18, 56); c.lineTo(-8, 76); c.lineTo(-2, 62); c.closePath(); fillStroke(c, '#ffffff', 1.5);
  c.beginPath(); c.moveTo(18, 56); c.lineTo(8, 76); c.lineTo(2, 62); c.closePath(); fillStroke(c, '#ffffff', 1.5);
  c.strokeStyle = '#262d42'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(-20, 58); c.lineTo(-4, 120); c.lineTo(-10, 160); c.moveTo(20, 58); c.lineTo(4, 120); c.lineTo(10, 160); c.stroke();
  circle(c, 0, 132, 3); c.fillStyle = '#1b2033'; c.fill();
  circle(c, 0, 148, 3); c.fill();
  }

  // ---- kollar ----
  const th = o.throwA || 0; // 0 dinlenme, 1 fırlatma
  // arka kol (dizde)
  c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 22; c.beginPath(); c.moveTo(48, 76); c.lineTo(42, 140); c.stroke();
  c.strokeStyle = o.cave ? '#dba07a' : '#2f3750'; c.lineWidth = 17; c.beginPath(); c.moveTo(48, 76); c.lineTo(42, 140); c.stroke();
  circle(c, 40, 146, 9); fillStroke(c, '#dba07a', 2);
  // ön kol (atış yapan)
  const hx = -64 - th * 22, hy = 136 - th * 120;
  const ex = -66 - th * 6, ey = 104 - th * 46;
  c.strokeStyle = INK; c.lineWidth = 22; c.beginPath(); c.moveTo(-48, 76); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
  c.strokeStyle = o.cave ? '#dba07a' : '#37405a'; c.lineWidth = 17; c.beginPath(); c.moveTo(-48, 76); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
  c.lineCap = 'butt';
  circle(c, hx, hy, 10); fillStroke(c, '#dba07a', 2);
  if (o.holding) { if (o.cave) drawRock(c, hx - 4, hy - 14, 1.3, th); else drawSlipper(c, hx - 4, hy - 10, 0.9, -0.6 - th); }
  else if (o.cave) drawClub(c, hx, hy, th);

  // ---- boyun ----
  rr(c, -16, 34, 32, 26, 6); fillStroke(c, '#c98d68', 2);

  // ---- KAFA ----
  circle(c, 40, -2, 11); fillStroke(c, '#cf9470', 2);               // kulak
  c.beginPath(); c.ellipse(0, -4, 42, 52, 0, 0, Math.PI * 2); fillStroke(c, '#dba07a', 2.5);

  // saç (kır)
  c.save(); c.beginPath(); c.ellipse(0, -4, 44, 54, 0, 0, Math.PI * 2); c.clip();
  c.beginPath(); c.moveTo(-60, -80); c.lineTo(60, -80); c.lineTo(60, 4);
  c.quadraticCurveTo(46, -10, 40, -30); c.quadraticCurveTo(14, -48, -8, -46); c.quadraticCurveTo(-30, -44, -44, -30); c.lineTo(-60, -26); c.closePath();
  c.fillStyle = '#8f8a85'; c.fill();
  c.save(); c.clip(); strands(c, ETO_HAIR, 1.8); c.restore();
  c.restore();
  if (o.cave) drawBone(c, 10, -60, 0.9, -0.35);
  // saç tutamı üstte
  c.beginPath(); c.moveTo(-14, -54); c.quadraticCurveTo(-4, -70 + Math.sin(t * 5) * 3, 8, -58); c.quadraticCurveTo(0, -60, -14, -54); fillStroke(c, '#a19c96', 1.8);

  // sakal (kirli sakaldan uzun, kır)
  c.save();
  c.beginPath();
  c.moveTo(42, -12); c.bezierCurveTo(50, 32, 36, 76, 0, 80); c.bezierCurveTo(-32, 80, -46, 50, -42, 12);
  c.quadraticCurveTo(-30, 26, -12, 24); c.quadraticCurveTo(12, 28, 26, 6); c.quadraticCurveTo(34, -6, 42, -12); c.closePath();
  c.fillStyle = '#7f7a75'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  c.clip(); strands(c, ETO_BEARD, 1.8);
  c.restore();

  // ağız (alaycı sırıtış)
  const mo = o.mouth || 0;
  if (mo > 0.05) {
    c.beginPath(); c.ellipse(-12, 38, 13, 3 + mo * 9, -0.1, 0, Math.PI * 2); fillStroke(c, '#5a1f22', 2);
    c.beginPath(); c.ellipse(-12, 42 + mo * 3, 7, 3 * mo, 0, 0, Math.PI * 2); c.fillStyle = '#e06470'; c.fill();
    c.fillStyle = '#fff'; c.fillRect(-20, 34 - mo * 5, 14, 3);
  } else {
    c.strokeStyle = '#4a1d20'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-26, 36); c.quadraticCurveTo(-10, 42, 6, 30); c.stroke();
    c.lineCap = 'butt';
  }
  // bıyık
  c.beginPath(); c.moveTo(-36, 22); c.quadraticCurveTo(-20, 8, -4, 14); c.quadraticCurveTo(8, 8, 18, 18);
  c.quadraticCurveTo(6, 28, -10, 24); c.quadraticCurveTo(-26, 30, -36, 22); c.closePath();
  fillStroke(c, '#6c6762', 2);
  c.save(); c.clip(); strands(c, ETO_BEARD.slice(0, 40).map(p => ({ ...p, y: p.y * 0.25 + 10, x: p.x * 0.6 - 8 })), 1.5); c.restore();

  // göz altları
  c.strokeStyle = 'rgba(120,70,50,.5)'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(-22, -8, 10, 0.3, Math.PI - 0.3); c.stroke();
  c.beginPath(); c.arc(10, -8, 10, 0.3, Math.PI - 0.3); c.stroke();

  // gözler — ŞAŞI
  const eyes = [[-22, -16, 1], [10, -16, -1]];
  eyes.forEach(([ex, ey, dir]) => {
    circle(c, ex, ey, 11); fillStroke(c, '#fff', 2.2);
    let px, py;
    if (o.dizzy) { const a = t * 14 * dir; px = ex + Math.cos(a) * 5; py = ey + Math.sin(a) * 5; }
    else { px = ex + dir * 5.5 + Math.sin(t * 3) * 0.8; py = ey + 1.5 + (o.laser ? 0 : Math.sin(t * 2.3) * 1); }
    circle(c, px, py, 4.8); c.fillStyle = o.laser ? '#ff2a2a' : INK; c.fill();
    circle(c, px - 1.4, py - 1.6, 1.4); c.fillStyle = '#fff'; c.fill();
    if (o.laser) { circle(c, ex, ey, 15); c.fillStyle = 'rgba(255,40,40,.25)'; c.fill(); }
  });
  // kaşlar (gür, kır) — biri alaycı şekilde yukarıda
  c.lineCap = 'round';
  const ang = o.angry ? 1 : 0;
  c.strokeStyle = INK; c.lineWidth = 9;
  c.beginPath(); c.moveTo(-36, -34 + ang * 6); c.quadraticCurveTo(-24, -44 + ang * 8, -10, -32 + ang * 10); c.stroke();
  c.beginPath(); c.moveTo(-2, -32 + ang * 10); c.quadraticCurveTo(12, -34 - ang * 2, 24, -30 - ang * 4); c.stroke();
  c.strokeStyle = '#b5b0aa'; c.lineWidth = 6;
  c.beginPath(); c.moveTo(-36, -34 + ang * 6); c.quadraticCurveTo(-24, -44 + ang * 8, -10, -32 + ang * 10); c.stroke();
  c.beginPath(); c.moveTo(-2, -32 + ang * 10); c.quadraticCurveTo(12, -34 - ang * 2, 24, -30 - ang * 4); c.stroke();
  c.lineCap = 'butt';

  // UZUN, kemerli burun
  c.save();
  const nb = o.nose || 0;
  const ns = 1 + Math.sin(nb * 30) * 0.22 * nb;
  c.translate(-6, -18); c.scale(ns, 2 - ns); c.translate(6, 18);
  c.beginPath();
  c.moveTo(-4, -20);
  c.bezierCurveTo(-14, -8, -40, 8, -50, 24);
  c.quadraticCurveTo(-54, 34, -42, 33);
  c.quadraticCurveTo(-32, 32, -26, 26);
  c.quadraticCurveTo(-16, 30, -8, 22);
  c.quadraticCurveTo(-2, 10, -4, -20);
  c.closePath();
  fillStroke(c, nb > 0.05 ? '#ec8f7a' : '#d4977a', 2.5);
  c.beginPath(); c.ellipse(-36, 28, 3.5, 2, 0.4, 0, Math.PI * 2); c.fillStyle = '#7a4030'; c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-30, 6, 3, 8, 0.8, 0, Math.PI * 2); c.fill();
  c.restore();

  if (o.dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + i * 2.1;
      drawStar(c, Math.cos(a) * 46, -70 + Math.sin(a) * 10, 7, '#ffd23f');
    }
  }
  c.restore();
}

function drawStar(c, x, y, r, col) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
  c.closePath(); fillStroke(c, col, 1.5);
}

function drawSlipper(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.beginPath(); c.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); fillStroke(c, '#2f7bd6', 2);
  c.beginPath(); c.ellipse(1, 0, 13, 4.5, 0, 0, Math.PI * 2); c.fillStyle = '#7fb4f0'; c.fill();
  c.beginPath(); c.moveTo(-4, -8); c.quadraticCurveTo(4, -15, 10, -7); c.lineTo(10, 7); c.quadraticCurveTo(4, 15, -4, 8); c.closePath();
  fillStroke(c, '#1f5fb0', 2);
  c.restore();
}

function drawRock(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.beginPath(); c.moveTo(-12, -4); c.lineTo(-6, -12); c.lineTo(6, -11); c.lineTo(13, -2); c.lineTo(9, 9); c.lineTo(-4, 12); c.lineTo(-12, 6); c.closePath();
  fillStroke(c, '#8a7d72', 2 / s);
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(-6, -8); c.lineTo(4, -8); c.lineTo(-2, -2); c.closePath(); c.fill();
  c.restore();
}
function drawBone(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.fillStyle = '#f3ecdc'; c.strokeStyle = INK; c.lineWidth = 2;
  [[-16, -4], [-16, 4], [16, -4], [16, 4]].forEach(([bx, by]) => { circle(c, bx, by, 5); c.fill(); c.stroke(); });
  c.fillRect(-16, -3.5, 32, 7); c.beginPath(); c.moveTo(-14, -3.5); c.lineTo(14, -3.5); c.moveTo(-14, 3.5); c.lineTo(14, 3.5); c.stroke();
  c.restore();
}
function drawClub(c, hx, hy, th) {
  c.save(); c.translate(hx, hy); c.rotate(-0.5 - th * 0.8);
  c.beginPath(); c.moveTo(-5, 10); c.lineTo(-13, -62); c.quadraticCurveTo(0, -86, 13, -62); c.lineTo(5, 10); c.closePath();
  fillStroke(c, '#8b5a2b', 2.5);
  c.fillStyle = '#6b4220'; circle(c, -4, -50, 3); c.fill(); circle(c, 5, -64, 2.5); c.fill(); circle(c, 2, -30, 2); c.fill();
  c.restore();
}
function drawRockSeat(c, t) {
  const fl = 14 + Math.sin(t * 40) * 6;
  [-40, 40].forEach(lx => {
    c.beginPath(); c.moveTo(lx - 10, 200); c.quadraticCurveTo(lx, 200 + fl * 2.4, lx + 10, 200); c.closePath(); c.fillStyle = '#ff7a2a'; c.fill();
    c.beginPath(); c.moveTo(lx - 5, 200); c.quadraticCurveTo(lx, 200 + fl * 1.3, lx + 5, 200); c.closePath(); c.fillStyle = '#ffe27a'; c.fill();
  });
  c.beginPath(); c.moveTo(-84, 162); c.lineTo(-60, 148); c.lineTo(-10, 152); c.lineTo(58, 146); c.lineTo(86, 164); c.lineTo(72, 202); c.lineTo(-20, 210); c.lineTo(-70, 200); c.closePath();
  fillStroke(c, '#7a6a5e', 3);
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-40, 160); c.lineTo(-30, 180); c.lineTo(-38, 196); c.moveTo(30, 156); c.lineTo(40, 176); c.stroke();
  c.fillStyle = '#5f8a3a'; circle(c, -56, 154, 6); c.fill(); circle(c, 52, 150, 5); c.fill();
}
const PELT_SPOTS = [[-40, 80], [-18, 100], [10, 84], [34, 104], [-30, 128], [2, 126], [36, 140], [-50, 148], [20, 152], [46, 76]];
function drawPelt(c) {
  c.beginPath(); c.moveTo(-58, 66); c.quadraticCurveTo(0, 44, 58, 66); c.lineTo(66, 160); c.lineTo(-66, 160); c.closePath();
  fillStroke(c, '#e0a84a', 2.5);
  c.save(); c.clip();
  c.fillStyle = '#7a4a1c';
  PELT_SPOTS.forEach(([sx, sy], i) => { c.beginPath(); c.ellipse(sx, sy, 7 + (i % 3), 5, i, 0, Math.PI * 2); c.fill(); });
  c.restore();
  // çıplak omuz
  c.beginPath(); c.moveTo(-58, 66); c.quadraticCurveTo(-30, 50, -4, 54); c.lineTo(-44, 104); c.closePath(); fillStroke(c, '#dba07a', 2);
  // tırtıklı etek
  c.beginPath(); c.moveTo(-66, 160); for (let i = 0; i <= 11; i++) c.lineTo(-66 + i * 12, i % 2 ? 170 : 160); c.closePath(); fillStroke(c, '#e0a84a', 2);
}
function drawSugar(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  rr(c, -8, -8, 16, 16, 3); fillStroke(c, '#ffffff', 2);
  c.fillStyle = '#dcd6cc'; [[-4, -3], [3, -5], [0, 2], [-3, 5], [5, 4]].forEach(([a, b]) => c.fillRect(a, b, 2, 2));
  c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-6, -6, 4, 2);
  c.restore();
}

function drawWord(c, x, y, text, bg, fg, rot = 0, size = 17) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `${size}px "Lilita One", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(text).width + 16, h = size + 10;
  rr(c, -w / 2, -h / 2, w, h, 7); fillStroke(c, bg, 2.5);
  c.fillStyle = fg; c.fillText(text, 0, 1);
  c.restore();
}

function drawTea(c, x, y, t) {
  c.save(); c.translate(x, y);
  circle(c, 0, 0, 27 + Math.sin(t * 6) * 3); c.fillStyle = 'rgba(78,205,196,.35)'; c.fill();
  c.beginPath(); c.ellipse(0, 14, 18, 5, 0, 0, Math.PI * 2); fillStroke(c, '#d42a2a', 2);
  c.beginPath(); c.moveTo(-9, -14); c.quadraticCurveTo(-4, -2, -8, 6); c.quadraticCurveTo(-8, 12, 0, 12);
  c.quadraticCurveTo(8, 12, 8, 6); c.quadraticCurveTo(4, -2, 9, -14); c.closePath();
  c.save(); c.clip(); c.fillStyle = '#b4321c'; c.fillRect(-12, -9, 24, 24); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-6, -9, 3, 20); c.restore();
  c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
  for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(-3 + i * 6, -18); c.quadraticCurveTo(-7 + i * 6, -24 + Math.sin(t * 5 + i) * 2, -2 + i * 6, -30); c.stroke(); }
  c.restore();
}

// ---------- Diğer karakterler ----------
function drawGuyHead(c, g, o = {}) {
  const t = o.t || 0;
  circle(c, -40, -2, 9); fillStroke(c, g.skin, 3); circle(c, 40, -2, 9); fillStroke(c, g.skin, 3);
  circle(c, 0, -6, 40); fillStroke(c, g.skin, 3);
  c.save(); circle(c, 0, -6, 41); c.clip();
  c.fillStyle = g.hair;
  if (g.style === 'swoop') {
    c.beginPath(); c.moveTo(-50, -60); c.lineTo(50, -60); c.lineTo(50, -22); c.quadraticCurveTo(10, -36, -20, -20); c.quadraticCurveTo(-40, -16, -50, -10); c.closePath(); c.fill();
  } else c.fillRect(-50, -60, 100, 32 + (g.hairLen || 0));
  if (g.streaks) {
    // kır saç: açık ve koyu teller
    c.lineWidth = 2.5; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      c.strokeStyle = i % 3 ? '#f2efea' : '#6e6964';
      const sx = -42 + i * 6.5, sy = -50 + (i % 4) * 5;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 5, sy + 12); c.stroke();
    }
    c.lineCap = 'butt';
  }
  if (g.stubble) {
    // kirli sakal: yarı saydam gölge + noktalar
    c.beginPath(); c.moveTo(-44, -10); c.quadraticCurveTo(-42, 42, 0, 44); c.quadraticCurveTo(42, 42, 44, -10); c.quadraticCurveTo(30, 6, 0, 8); c.quadraticCurveTo(-30, 6, -44, -10);
    c.fillStyle = 'rgba(30,22,22,.32)'; c.fill();
    c.fillStyle = 'rgba(20,14,14,.55)';
    for (let i = 0; i < 46; i++) { const a = 0.25 + (i / 46) * 2.65, rr2 = 26 + (i * 7 % 12); c.fillRect(Math.cos(a) * rr2 - 1, -4 + Math.sin(a) * rr2 - 1, 2, 2); }
  }
  if (g.beard === 'short') {
    // kısa, bakımlı genç sakalı
    c.beginPath(); c.moveTo(-41, -4); c.quadraticCurveTo(-36, 38, 0, 40); c.quadraticCurveTo(36, 38, 41, -4);
    c.lineTo(34, -4); c.quadraticCurveTo(26, 22, 0, 28); c.quadraticCurveTo(-26, 22, -34, -4); c.closePath(); c.fill();
  } else if (g.beard) { c.beginPath(); c.moveTo(-42, -6); c.quadraticCurveTo(-40, 40, 0, 42); c.quadraticCurveTo(40, 40, 42, -6); c.quadraticCurveTo(30, 18, 0, 22); c.quadraticCurveTo(-30, 18, -42, -6); c.fill(); }
  c.restore();
  if (g.curly) for (let i = 0; i < 9; i++) { circle(c, -40 + i * 10, -38 - Math.abs(Math.sin(i * 1.3)) * 8, 10); c.fillStyle = g.hair; c.fill(); }
  if (g.style === 'swoop') { c.beginPath(); c.moveTo(-34, -42); c.quadraticCurveTo(8, -70, 46, -28); c.quadraticCurveTo(8, -48, -34, -42); c.fillStyle = g.hair; c.fill(); }
  // kaşlar
  c.strokeStyle = g.hair; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-24, -22); c.lineTo(-9, -25); c.moveTo(9, -25); c.lineTo(24, -22); c.stroke();
  c.lineCap = 'butt';
  // gözler
  if (o.dead) {
    c.strokeStyle = INK; c.lineWidth = 4;
    [[-15, -8], [15, -8]].forEach(([ex, ey]) => { c.beginPath(); c.moveTo(ex - 6, ey - 6); c.lineTo(ex + 6, ey + 6); c.moveTo(ex + 6, ey - 6); c.lineTo(ex - 6, ey + 6); c.stroke(); });
  } else if ((t % 3.1) > 3.0) {
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(-22, -8); c.lineTo(-8, -8); c.moveTo(8, -8); c.lineTo(22, -8); c.stroke();
  } else {
    const big = o.scared ? 1.3 : 1;
    circle(c, -15, -8, 7.5 * big); fillStroke(c, '#fff', 2.5); circle(c, 15, -8, 7.5 * big); fillStroke(c, '#fff', 2.5);
    circle(c, -13, -8, 3.6); c.fillStyle = INK; c.fill(); circle(c, 17, -8, 3.6); c.fill();
  }
  if (g.glasses) { c.strokeStyle = INK; c.lineWidth = 3; circle(c, -15, -8, 12); c.stroke(); circle(c, 15, -8, 12); c.stroke(); c.beginPath(); c.moveTo(-3, -8); c.lineTo(3, -8); c.stroke(); }
  // burun
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(2, -4); c.quadraticCurveTo(9, 6, 1, 9); c.stroke();
  if (g.mustache) { c.fillStyle = g.hair; c.beginPath(); c.ellipse(0, 15, 15, 4.5, 0, 0, Math.PI * 2); c.fill(); }
  // ağız
  if (o.tongue) { c.beginPath(); c.ellipse(0, 22, 9, 8, 0, 0, Math.PI * 2); fillStroke(c, '#5a1f22', 2.5); circle(c, 0, 25, 5); c.fillStyle = '#ff7aa2'; c.fill(); }
  else if (o.dead) { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(0, 28, 7, Math.PI + 0.3, -0.3); c.stroke(); }
  else { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.arc(0, 18, o.happy ? 10 : 8, 0.25, Math.PI - 0.25); c.stroke(); }
  c.fillStyle = 'rgba(255,90,90,.22)'; circle(c, -25, 8, 6); c.fill(); circle(c, 25, 8, 6); c.fill();
  if (o.hurt) { c.fillStyle = 'rgba(255,60,60,.35)'; circle(c, 0, -6, 40); c.fill(); }
}
function drawGuy(c, cfg) {
  c.save();
  c.beginPath(); c.ellipse(0, 70, 58, 40, 0, 0, Math.PI * 2); fillStroke(c, cfg.shirt, 3);
  rr(c, -12, 20, 24, 24, 6); fillStroke(c, cfg.skin, 3);
  drawGuyHead(c, cfg, { happy: true });
  c.restore();
}
const GUYS = {
  yavuz:  { skin: '#e8b48f', hair: '#a8a39e', shirt: '#2a9d8f', sleeve: '#1d6f66', streaks: true },
  sirac:  { skin: '#d49a6f', hair: '#141010', shirt: '#e76f51', sleeve: '#a94a33', curly: true, stubble: true },
  efe:    { skin: '#f0c19c', hair: '#181313', shirt: '#6c5ce7', sleeve: '#4a3db3', style: 'swoop', beard: 'short' },
  selcuk: { skin: '#e2a982', hair: '#2a2420', shirt: '#d42a2a', sleeve: '#a81d1d', beard: true, glasses: true },
};

function renderPortrait(cv) {
  const c = cv.getContext('2d'), who = cv.dataset.who, mode = cv.dataset.mode;
  c.clearRect(0, 0, cv.width, cv.height); c.save();
  if (mode === 'head') {
    const sc = cv.width / 50;
    c.translate(cv.width / 2, cv.height / 2 + 2 * sc); c.scale(sc, sc);
    if (who === 'mustafa') { c.translate(-4, 16); drawKukiHead(c, { t: 0.5, happy: true }, 0.5); }
    else { c.scale(0.45, 0.45); c.translate(0, 6); drawGuyHead(c, GUYS[who], { happy: true }); }
  } else if (CHARS[who]) {
    c.translate(cv.width * 0.5, cv.height * 0.64); c.scale(cv.width / 100, cv.width / 100);
    drawKuki(c, 0, 0, { t: 0.5, wing: 0.35, happy: true, who });
  } else { c.translate(cv.width / 2, cv.height * 0.5); c.scale(cv.width / 180, cv.width / 180); drawGuy(c, GUYS[who]); }
  c.restore();
}
function renderPortraits() {
  document.querySelectorAll('canvas[data-who]').forEach(renderPortrait);
  const ic = $('#etoIcon'), ic2 = ic.getContext('2d');
  ic2.clearRect(0, 0, 72, 72); ic2.save(); ic2.beginPath(); ic2.arc(36, 36, 36, 0, Math.PI * 2); ic2.clip();
  drawEto(ic2, 40, 34, { size: 0.5, t: 0, noChair: true, cave: L.cave }); ic2.restore();
}

// ============================================================
//  Arka plan (kantin / fabrika salonu)
// ============================================================
function drawCave(c, scroll) {
  const g = c.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#1e1622'); g.addColorStop(0.5, '#3a2a30'); g.addColorStop(1, '#4a3528');
  c.fillStyle = g; c.fillRect(0, 0, W, GROUND);
  const P = 520, off = -((scroll * 0.15) % P);
  for (let k = -1; k < 3; k++) {
    const ox = off + k * P;
    c.fillStyle = '#2c2128';
    c.beginPath(); c.moveTo(ox, GROUND);
    [[0, 520], [60, 430], [120, 470], [190, 380], [260, 440], [330, 400], [400, 480], [460, 420], [520, 520]].forEach(([px, py]) => c.lineTo(ox + px, py));
    c.lineTo(ox + P, GROUND); c.closePath(); c.fill();
    // mağara resmi: sopalı, uzun burunlu adam
    c.save(); c.strokeStyle = 'rgba(214,140,70,.5)'; c.fillStyle = 'rgba(214,140,70,.5)'; c.lineWidth = 4; c.lineCap = 'round';
    const px = ox + 180, py = 220;
    circle(c, px, py, 16); c.stroke();
    c.beginPath(); c.moveTo(px - 14, py); c.lineTo(px - 36, py + 12); c.lineTo(px - 14, py + 8); c.stroke();
    c.beginPath(); c.moveTo(px, py + 16); c.lineTo(px, py + 60); c.moveTo(px, py + 30); c.lineTo(px - 22, py + 44); c.moveTo(px, py + 30); c.lineTo(px + 22, py + 20); c.lineTo(px + 30, py - 12);
    c.moveTo(px, py + 60); c.lineTo(px - 14, py + 86); c.moveTo(px, py + 60); c.lineTo(px + 14, py + 86); c.stroke();
    c.font = '26px "Lilita One", sans-serif'; c.fillText('ETO', px - 24, py - 28);
    for (let i = 0; i < 3; i++) { circle(c, ox + 330 + i * 26, 250 + (i % 2) * 16, 8); c.fill(); }
    c.restore();
  }
  c.fillStyle = '#241a20'; c.fillRect(0, 0, W, 40);
  const P2 = 300, off2 = -((scroll * 0.35) % P2);
  for (let k = -1; k < 3; k++) {
    const ox = off2 + k * P2;
    [[20, 70], [70, 40], [120, 110], [180, 55], [240, 90]].forEach(([dx, len]) => { c.beginPath(); c.moveTo(ox + dx - 16, 38); c.lineTo(ox + dx, 38 + len); c.lineTo(ox + dx + 16, 38); c.closePath(); c.fill(); });
  }
  const P3 = 360, off3 = -((scroll * 0.5) % P3);
  for (let k = -1; k < 3; k++) {
    const tx = off3 + k * P3 + 200, ty = 330, fl = Math.sin(G.t * 18 + k) * 3;
    const rg = c.createRadialGradient(tx, ty - 20, 5, tx, ty - 20, 120);
    rg.addColorStop(0, 'rgba(255,170,60,.45)'); rg.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = rg; c.fillRect(tx - 120, ty - 140, 240, 240);
    c.fillStyle = '#5a3a22'; c.fillRect(tx - 4, ty - 10, 8, 40);
    c.beginPath(); c.moveTo(tx - 9, ty - 10); c.quadraticCurveTo(tx + fl, ty - 50, tx + 9, ty - 10); c.closePath(); c.fillStyle = '#ff9a2a'; c.fill();
    c.beginPath(); c.moveTo(tx - 5, ty - 10); c.quadraticCurveTo(tx - fl, ty - 32, tx + 5, ty - 10); c.closePath(); c.fillStyle = '#ffe27a'; c.fill();
  }
  const P4 = 420, off4 = -((scroll * 0.6) % P4);
  for (let k = -1; k < 3; k++) {
    const ox = off4 + k * P4;
    c.fillStyle = '#3d2d2a';
    c.beginPath(); c.moveTo(ox, GROUND); c.lineTo(ox + 30, 640); c.lineTo(ox + 90, 610); c.lineTo(ox + 140, 650); c.lineTo(ox + 170, GROUND); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(ox + 250, GROUND); c.lineTo(ox + 280, 660); c.lineTo(ox + 330, 670); c.lineTo(ox + 350, GROUND); c.closePath(); c.fill();
    drawBone(c, ox + 210, GROUND - 8, 0.8, 0.2);
  }
}

function drawBackground(c, scroll) {
  if (L.cave) { drawCave(c, scroll); return; }
  // duvar
  const g = c.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#d8d1c5'); g.addColorStop(0.2, '#ece6dc'); g.addColorStop(1, '#e4ddd1');
  c.fillStyle = g; c.fillRect(0, 0, W, GROUND);

  // uzak katman
  const P = 600, off = -((scroll * 0.18) % P);
  for (let k = -1; k < 2; k++) {
    const ox = off + k * P;
    // cam cephe
    const wx = ox + 20, wy = 150, ww = 230, wh = 420;
    const wg = c.createLinearGradient(wx, wy, wx, wy + wh);
    wg.addColorStop(0, '#f7e3a0'); wg.addColorStop(0.5, '#f2c64c'); wg.addColorStop(1, '#e7a93a');
    c.fillStyle = wg; c.fillRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.moveTo(wx + 30, wy); c.lineTo(wx + 70, wy); c.lineTo(wx + 10, wy + wh); c.lineTo(wx - 30 < wx ? wx : wx - 30, wy + wh); c.closePath(); c.fill();
    c.strokeStyle = '#8b939b'; c.lineWidth = 6;
    c.strokeRect(wx, wy, ww, wh);
    c.lineWidth = 4;
    for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(wx, wy + i * wh / 6); c.lineTo(wx + ww, wy + i * wh / 6); c.stroke(); }
    c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
    // kolon
    c.fillStyle = '#f4f1ea'; c.fillRect(ox + 270, 110, 56, GROUND - 110);
    c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(ox + 312, 110, 14, GROUND - 110);
    // bölme duvar + kapı
    c.fillStyle = '#f7f5f0'; c.fillRect(ox + 380, 330, 200, GROUND - 330);
    c.fillStyle = '#d9d3c8'; c.fillRect(ox + 500, 420, 48, GROUND - 420);
    c.fillStyle = '#3cb371'; c.fillRect(ox + 510, 404, 22, 8);
    c.strokeStyle = '#c9c2b6'; c.lineWidth = 3; c.strokeRect(ox + 410, 400, 50, 70);
  }
  // tavan
  c.fillStyle = '#cfc8bc'; c.fillRect(0, 0, W, 112);
  const P2 = 480, off2 = -((scroll * 0.3) % P2);
  for (let k = -1; k < 2; k++) {
    const ox = off2 + k * P2;
    c.fillStyle = '#9ea5ab'; rr(c, ox, 72, P2, 22, 4); c.fill();
    c.strokeStyle = '#7d858c'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(ox + i * 80, 72); c.lineTo(ox + i * 80, 94); c.stroke(); }
    c.strokeStyle = '#c0392b'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(ox, 34); c.lineTo(ox + P2, 34); c.stroke();
    c.beginPath(); c.moveTo(ox, 52); c.lineTo(ox + P2, 52); c.stroke();
    c.beginPath(); c.moveTo(ox + 120, 34); c.lineTo(ox + 120, 108); c.lineTo(ox + 132, 108); c.stroke();
    c.beginPath(); c.moveTo(ox + 360, 52); c.lineTo(ox + 360, 104); c.stroke();
    // floresan
    c.fillStyle = 'rgba(255,255,240,.35)'; rr(c, ox + 200, 100, 140, 18, 9); c.fill();
    c.fillStyle = '#ffffff'; rr(c, ox + 215, 104, 110, 7, 3); c.fill();
  }
  // orta katman: masalar & turuncu sandalyeler
  const P3 = 380, off3 = -((scroll * 0.5) % P3);
  for (let k = -1; k < 3; k++) {
    const ox = off3 + k * P3;
    c.globalAlpha = 0.9;
    // sandalye arka
    c.fillStyle = '#e9622e'; rr(c, ox + 30, 600, 40, 50, 8); c.fill(); rr(c, ox + 20, 640, 60, 12, 5); c.fill();
    c.fillStyle = '#9aa0a6'; c.fillRect(ox + 26, 652, 4, 60); c.fillRect(ox + 70, 652, 4, 60);
    // masa
    c.fillStyle = '#fafaf7'; rr(c, ox + 90, 620, 150, 14, 4); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(ox + 90, 632, 150, 4);
    c.fillStyle = '#7e868d'; c.fillRect(ox + 110, 634, 6, 78); c.fillRect(ox + 214, 634, 6, 78);
    // sandalye ön
    c.fillStyle = '#f26b2a'; rr(c, ox + 260, 610, 40, 50, 8); c.fill(); rr(c, ox + 250, 648, 60, 12, 5); c.fill();
    c.fillStyle = '#9aa0a6'; c.fillRect(ox + 256, 660, 4, 52); c.fillRect(ox + 300, 660, 4, 52);
    c.globalAlpha = 1;
  }
}

function drawFloor(c, scroll) {
  if (L.cave) {
    c.fillStyle = '#2e221d'; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = '#4a372c'; c.fillRect(0, GROUND, W, 6);
    const sp = 90, off = -(scroll % sp);
    c.fillStyle = '#3c2c24';
    for (let x = off - sp; x < W + sp; x += sp) { c.beginPath(); c.ellipse(x + 30, GROUND + 30, 26, 9, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x + 70, GROUND + 62, 18, 6, 0, 0, Math.PI * 2); c.fill(); }
    return;
  }
  const g = c.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, '#ece2d2'); g.addColorStop(1, '#d6c8b4');
  c.fillStyle = g; c.fillRect(0, GROUND, W, H - GROUND);
  c.fillStyle = '#b8ab98'; c.fillRect(0, GROUND, W, 5);
  c.strokeStyle = 'rgba(120,100,80,.25)'; c.lineWidth = 2;
  [GROUND + 24, GROUND + 52].forEach(yy => { c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); });
  const sp = 64, off = -(scroll % sp);
  for (let x = off - sp; x < W + sp * 2; x += sp) {
    c.beginPath(); c.moveTo(x, GROUND + 5); c.lineTo(x + (x - W / 2) * 0.35, H); c.stroke();
  }
}

// ---------- Engeller: tavandan sarkan kanal & üst üste kantin sandalyeleri ----------
const OB_W = 76;
function drawObstacle(c, ob) {
  const x = ob.x, top = ob.gapY - ob.gap / 2, bot = ob.gapY + ob.gap / 2;
  if (L.cave) {
    c.beginPath(); c.moveTo(x - 6, -10); c.lineTo(x + OB_W + 6, -10); c.lineTo(x + OB_W + 4, top - 30); c.lineTo(x + OB_W - 10, top - 12); c.lineTo(x + OB_W / 2 + 6, top - 26);
    c.lineTo(x + OB_W / 2 - 4, top); c.lineTo(x + 14, top - 22); c.lineTo(x - 4, top - 34); c.closePath();
    fillStroke(c, '#6b5a50', 3);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3;
    for (let yy = top - 70; yy > 0; yy -= 50) { c.beginPath(); c.moveTo(x + 4, yy); c.lineTo(x + OB_W - 4, yy + 8); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 8, -10, 10, Math.max(0, top - 50));
    c.beginPath(); c.moveTo(x - 6, GROUND); c.lineTo(x - 2, bot + 34); c.lineTo(x + 12, bot + 16); c.lineTo(x + 26, bot + 26); c.lineTo(x + OB_W / 2 + 4, bot);
    c.lineTo(x + OB_W - 14, bot + 22); c.lineTo(x + OB_W + 4, bot + 30); c.lineTo(x + OB_W + 6, GROUND); c.closePath();
    fillStroke(c, '#7a665a', 3);
    c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 3;
    for (let yy = bot + 60; yy < GROUND; yy += 46) { c.beginPath(); c.moveTo(x + 2, yy + 6); c.lineTo(x + OB_W - 2, yy); c.stroke(); }
    drawBone(c, x + OB_W / 2, bot + 52, 0.7, 0.5);
    return;
  }
  // üst: havalandırma kanalı + kırmızı boru
  c.fillStyle = '#a9b1b8'; c.fillRect(x, -10, OB_W, top - 8);
  c.fillStyle = '#c9d0d6'; c.fillRect(x + 6, -10, 12, top - 8);
  c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(x, -10, OB_W, top - 8 + 10);
  c.strokeStyle = '#7d868e'; c.lineWidth = 2;
  for (let yy = top - 48; yy > 0; yy -= 44) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + OB_W, yy); c.stroke(); }
  c.strokeStyle = INK; c.lineWidth = 11; c.beginPath(); c.moveTo(x + OB_W - 12, -10); c.lineTo(x + OB_W - 12, top - 14); c.stroke();
  c.strokeStyle = '#c8372d'; c.lineWidth = 7; c.beginPath(); c.moveTo(x + OB_W - 12, -10); c.lineTo(x + OB_W - 12, top - 14); c.stroke();
  rr(c, x - 7, top - 22, OB_W + 14, 22, 4); fillStroke(c, '#8d969e', 3);
  c.strokeStyle = '#5f676e'; c.lineWidth = 2;
  for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x + 2 + i * 13, top - 17); c.lineTo(x + 2 + i * 13, top - 5); c.stroke(); }

  // alt: üst üste dizilmiş turuncu kantin sandalyeleri
  c.strokeStyle = '#6e767d'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(x + 8, bot + 30); c.lineTo(x + 4, GROUND); c.moveTo(x + OB_W - 8, bot + 30); c.lineTo(x + OB_W - 4, GROUND); c.stroke();
  rr(c, x + 6, bot, OB_W - 12, 40, 10); fillStroke(c, '#f26b2a', 3);
  rr(c, x + 22, bot + 10, OB_W - 44, 8, 4); c.fillStyle = '#c4501b'; c.fill();
  for (let yy = bot + 34; yy < GROUND; yy += 20) {
    rr(c, x - 4, yy, OB_W + 8, 12, 6); fillStroke(c, '#f26b2a', 2.5);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 4, yy + 2, OB_W - 20, 3);
  }
}

// ============================================================
//  Oyun durumu
// ============================================================
const G = { state: 'menu', paused: false, t: 0, scroll: 0, speed: 165, score: 0, best: +(store('kuki_best') || 0),
  passed: 0, spawned: 0, spawnT: 0, obstacles: [], cups: [], shots: [], lasers: [], parts: [], pops: [],
  shake: 0, flash: 0, introT: 0, endT: 0, bossHintT: 0 };
const K = { y: 420, vy: 0, rot: 0, flapT: 9, hp: KUKI_HP, inv: 0, squash: 0, throwCd: 0, hurtT: 0 };
const E = { x: 640, y: 330, hp: 80, max: 80, kuki: 0, t: 0, atkT: 2, hit: 0, nose: 0, mouth: 0, say: '', sayT: 0, throwA: 0,
  volley: 0, volleyT: 0, phase2: false, dead: false, vy: 0, rot: 0, tauntT: 4, lockY: null };

const TAUNTS = ['Şaşı bakıyorum ama seni görüyorum!', 'Bu ay izin yok Kuki!', 'Mola bitti, işbaşı!', 'Tutanak tutacağım!', 'Fazla mesaiye kalıyorsun!', 'Kartını bastın mı sen?', 'Vardiya değişti, haberin yok mu?', 'Zam mı? Hahaha!', 'Uga buga! Çalış!', 'Raporu masama bırak!', 'Bu daha bitmedi Kuki!'];
const HIT_SAYS = ['UGH!', 'UGA BUGA!', 'HRRR!', 'AY BURNUM!', 'Zam yok dedim!', 'Tutanak!', 'OOGA!', 'Gözüm kaydı!'];
const KUKI_WORDS = ['ZAM!', 'İZİN!', 'MOLA!', 'PRİM!', 'HAFTA SONU!', 'İKRAMİYE!', 'SERVİS!', 'YEMEK!', 'HAKKIM!'];
const ETO_WORDS = ['TUTANAK!', 'FAZLA MESAİ!', 'İZİN YOK!', 'RAPOR?', 'VARDİYA!', 'KART BAS!', 'TOPLANTI!'];
const KUKI_SAYS = ['ZAM İSTİYORUZ!', 'Hakkımı helal etmiyorum!', 'Mola hakkım bu!', 'Bugün erken çıkıyorum!', 'Al sana izin dilekçesi!'];
const BOSS_WIN_LINES = ['“Hah! Yarın sabah 7\'de işbaşı.” — Eto', '“Islık yetmedi Kuki!” — Eto', '“Şaşıyım ama nişancıyım!” — Eto', '“Tutanağını imzala, çık.” — Eto'];
const TAUNTS2 = ['UGA BUGA! Mağarama hoş geldin!', 'Burada zam yok, taş var!', 'Bu daha bitmedi demiştim Kuki!', 'Ateşi ben buldum, mesaiyi de!', 'Tutanağı taşa kazıdım!', 'HRRR! Kartını bas!', 'Şaşıyım ama taşım isabetli!'];
const ETO2_WORDS = ['UGA!', 'TAŞ!', 'HRRR!', 'MESAİ!', 'TUTANAK!', 'OOGA!'];
const CHARS = {
  mustafa: { name: 'MUSTAFA', short: 'Kuki', tag: 'namıdiğer Kuki', ability: 'LAF FIRLATMA', pitch: 1, hint: 'DOKUN = LAF FIRLAT!',
    desc: 'Her dokunuşta ZAM!, İZİN!, MOLA! gibi laflar fırlatır. Hızlı ve isabetli.',
    says: KUKI_SAYS, pops: ['BONK!', 'ŞAK!', 'POF!'] },
  efe: { name: 'EFE', short: 'Efe', tag: 'Dili Kemiksiz', ability: 'DİL DARBESİ', pitch: 1.25, hint: 'DOKUN = DİL DARBESİ!',
    desc: 'Dilini şak diye uzatıp önündekine vurur. Gelen lafları ve terlikleri de yalayıp yok eder!',
    says: ['Dilimin kemiği yok!', 'Şlaaap!', 'Tadın tuzun yok Eto!', 'Dil darbesi geliyor!'], pops: ['ŞLAP!', 'ŞAP!', 'LIK!'] },
  sirac: { name: 'SIRAÇ', short: 'Sıraç', tag: 'Erzurumlu Şekerci', ability: 'KITLAMA ŞEKER', pitch: 0.82, hint: 'DOKUN = ŞEKER FIRLAT!',
    desc: 'Erzurum kıtlama şekerini üçlü yaylım halinde fırlatır. Biri kaçsa ikisi tutar.',
    says: ["Erzurum'dan selam olsun!", 'Kıtlama şeker, acı çay!', 'Şekerim bitmez dadaş!', 'Ağzın tatlansın Eto!'], pops: ['ÇITIR!', 'TIK!', 'KITIR!'] },
  yavuz: { name: 'YAVUZ', short: 'Yavuz', tag: 'Baş Kukileyici', ability: 'KUKİLEME', pitch: 1.1, hint: 'DOKUN = KUKİLE!',
    desc: 'Kuki enerjisi fırlatır. ' + KUKILE_AT + ' isabette Eto kukilenir: 4 saniye donar, ıslık çalar ve çift hasar alır.',
    says: ['Seni de kukileyeceğim!', 'Kukilenmeye hazır mısın?', 'Herkes Kuki olacak!', 'Kuki enerjisi yükleniyor!'], pops: ['KUKİ!', 'PIUV!', 'HOP!'] },
};
function nick() { return CHARS[CH].short; }
function unlocked() { return Math.max(1, +(store('kuki_unlocked') || 1)); }
const FLY_DIE_LINES = ['Eto\'ya ulaşamadın bile! Eto uzaktan gülüyor…', 'Kantin sandalyeleri kazandı.', 'Islık güzeldi, uçuş değil.', 'Servisi kaçırdın Kuki!'];

function resetGame() {
  Object.assign(G, { t: 0, speed: L.speed, score: 0, passed: 0, spawned: 0, spawnT: 0.6, obstacles: [], cups: [], shots: [], lasers: [], parts: [], pops: [], shake: 0, flash: 0, introT: 0, endT: 0 });
  Object.assign(K, { y: 400, vy: 0, rot: 0, flapT: 9, hp: KUKI_HP, inv: 0, squash: 0, throwCd: 0, hurtT: 0 });
  Object.assign(E, { x: 640, y: 330, hp: L.hp, t: 0, atkT: 2, hit: 0, nose: 0, mouth: 0, say: '', sayT: 0, throwA: 0, volley: 0, volleyT: 0, phase2: false, dead: false, vy: 0, rot: 0, tauntT: 4, lockY: null });
  Object.assign(G, { ult: null, ultUsed: false, teaT: 14, teas: [], kSay: '', kSayT: 0, kSayCd: 5 });
  E.phase3 = false; E.stun = 0; E.max = L.hp; E.kuki = 0;
  Object.assign(G, { falls: [], tongue: null, scoreAcc: 0, kukiMeter: 0 });
  $('#support').classList.add('hidden');
}

// ============================================================
//  Parçacık & popup
// ============================================================
function burst(x, y, n, type, opts = {}) {
  for (let i = 0; i < n; i++) {
    const a = opts.dir != null ? opts.dir + rand(-opts.spread || -0.6, opts.spread || 0.6) : rand(0, Math.PI * 2);
    const sp = rand(opts.min || 60, opts.max || 260);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 1), max: 1, type,
      size: rand(opts.smin || 3, opts.smax || 7), rot: rand(0, 6), vr: rand(-8, 8), col: opts.col || pick(['#5b3a1e', '#7a4f2a', '#a06a3c']) });
  }
}
function pop(x, y, text, col = '#fff', size = 30) { G.pops.push({ x, y, text, col, size, t: 0 }); }
function etoSay(text, dur = 2) {
  text = text.replace(/Kuki/g, nick());
  E.say = text; E.sayT = dur; E.mouth = 1;
  if (/uga|ugh|hrr|ooga/i.test(text)) Sound.grunt(2); else if (Math.random() < 0.4) Sound.grunt(1);
}

// ============================================================
//  Akış / ekranlar
// ============================================================
const screens = ['menu', 'select', 'pause', 'over', 'win'];
function show(name) { screens.forEach(s => $('#scr-' + s).classList.toggle('hidden', s !== name)); }
function hideScreens() { show(null); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1400); }

function goMenu() {
  G.state = 'menu'; G.paused = false; resetGame();
  $('#bestMenu').textContent = G.best;
  $('#hud').classList.add('hidden'); $('#hint').classList.add('hidden'); $('#banner').classList.add('hidden');
  show('menu');
  Sound.playMusic(L.music);
}
function goSelect() { G.state = 'select'; refreshSelect(); show('select'); }
function startGame() {
  resetGame();
  G.state = 'ready'; G.paused = false;
  hideScreens();
  $('#hud').classList.remove('hidden');
  $('#score').classList.remove('hidden'); $('#score').textContent = '0';
  $('#progress').classList.remove('hidden'); $('#progress .fill').style.width = '0%';
  $('#bossbar').classList.add('hidden'); $('#bossbar').classList.remove('rage'); $('#hearts').classList.add('hidden');
  $('#hintText').textContent = 'DOKUN & UÇ'; $('#hint').classList.remove('hidden');
  $('#progress .lbl').textContent = L.title;
  renderPortraits();
  Sound.playMusic(L.music);
}
function setPaused(p) {
  if (!['play', 'boss', 'bossIntro', 'ready'].includes(G.state)) return;
  G.paused = p; show(p ? 'pause' : null);
}
function renderHearts() {
  $('#hearts').innerHTML = Array.from({ length: KUKI_HP }, (_, i) => i).map(i => `<span class="${i < K.hp ? '' : 'lost'}">❤️</span>`).join('');
}
function updateBossBar() {
  $('#bossbar .fill').style.width = Math.max(0, E.hp / E.max * 100) + '%';
  $('#bossbar').classList.toggle('rage', E.phase2);
}
function addScore(n) {
  G.score += n; const el = $('#score'); el.textContent = G.score;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function saveBest() {
  const isNew = G.score > G.best;
  if (isNew) { G.best = G.score; store('kuki_best', G.best); }
  return isNew;
}
function gameOver() {
  const isNew = saveBest();
  const boss = E.x < 600;
  $('#overTitle').textContent = boss ? L.boss + ' KAZANDI 😏' : 'OYUN BİTTİ';
  $('#overQuote').textContent = (boss ? pick(BOSS_WIN_LINES) : pick(FLY_DIE_LINES)).replace(/Kuki/g, nick());
  $('#overScore').textContent = G.score; $('#overBest').textContent = G.best;
  $('#overNew').classList.toggle('hidden', !isNew);
  $('#hud').classList.add('hidden');
  show('over');
}
function victory() {
  const isNew = saveBest();
  $('#winScore').textContent = G.score; $('#winBest').textContent = G.best;
  $('#winNew').classList.toggle('hidden', !isNew);
  const next = LEVELS[LV + 1];
  if (next) store('kuki_unlocked', String(Math.max(LV + 1, unlocked())));
  $('#winTitle').textContent = next ? L.title + ' TAMAM!' : 'TÜM BÖLÜMLER BİTTİ!';
  $('#winQuote').textContent = next ? `“Bu daha bitmedi ${nick()}… Mağarada görüşürüz!” — Eto` : `“Bu daha da bitmedi ${nick()}… UGA!” — Mağara Eto`;
  $('#btnNext').classList.toggle('hidden', !next);
  $('#winSoon').classList.toggle('hidden', !!next);
  $('#hud').classList.add('hidden');
  show('win');
}

// ============================================================
//  Girdi
// ============================================================
function flap() {
  if (G.paused) return;
  if (G.state === 'ready') { G.state = 'play'; $('#hint').classList.add('hidden'); }
  if (G.state !== 'play' && G.state !== 'boss') return;
  K.vy = FLAP; K.flapT = 0; K.squash = 1;
  Sound.whistle();
  burst(KUKI_X - 18, K.y + 10, 2, 'feather', { dir: Math.PI * 0.75, spread: 0.5, min: 40, max: 120, col: '#ffffff', smin: 4, smax: 6 });
  if (G.state === 'boss' && K.throwCd <= 0) attack();
}
function attack() {
  const x0 = KUKI_X + 26, y0 = K.y + 4;
  if (CH === 'mustafa') {
    K.throwCd = 0.14;
    G.cups.push({ kind: 'word', x: x0, y: y0, vx: 540, vy: -40, r: 0, w: pick(KUKI_WORDS), dmg: 1 });
    Sound.sfxThrow();
  } else if (CH === 'sirac') {
    K.throwCd = 0.18;
    [-0.16, 0, 0.16].forEach(a => G.cups.push({ kind: 'sugar', x: x0, y: y0, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520 - 30, r: rand(0, 6), spin: 9, dmg: 0.38 }));
    Sound.sfxCrunch();
  } else if (CH === 'yavuz') {
    K.throwCd = 0.16;
    G.cups.push({ kind: 'kuki', x: x0, y: y0, vx: 500, vy: -30, r: 0, spin: 6, g: 60, dmg: 0.8 });
    Sound.tone(1200, 0.08, 'triangle', 0.15, 1800);
  } else if (CH === 'efe') {
    K.throwCd = 0.3;
    const mx = KUKI_X + 8, my = K.y - 6;
    const hitE = !E.dead && E.x < 600 && Math.abs(my - (E.y + 50)) < 110;
    const reach = hitE ? Math.max(60, E.x - 44 - mx) : 300;
    G.tongue = { t: 0, reach };
    for (const sh of G.shots) {
      if (sh.x > mx && sh.x < mx + reach + 24 && Math.abs(sh.y - my) < 30) {
        sh.dead = true; pop(sh.x, sh.y - 10, 'YALADI!', '#ff8fb1', 20);
        burst(sh.x, sh.y, 6, 'coffee', { col: '#ff8fb1', min: 60, max: 180 });
      }
    }
    Sound.sfxSlurp();
    if (hitE) etoHit(mx + reach, my, 1.1, 'tongue');
  }
}
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .card, .panel')) return;
  Sound.init();
  if (['ready', 'play', 'boss'].includes(G.state)) { e.preventDefault(); flap(); }
});
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault(); Sound.init();
    if (['ready', 'play', 'boss'].includes(G.state)) flap();
    else if (G.state === 'menu') goSelect();
    else if (G.state === 'select' || (G.state === 'over' && !$('#scr-over').classList.contains('hidden')) || (G.state === 'won' && !$('#scr-win').classList.contains('hidden'))) startGame();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') setPaused(!G.paused);
  if (e.code === 'KeyM') Sound.setMuted(!Sound.muted);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

function btn(id, fn) { $(id).addEventListener('click', e => { e.stopPropagation(); Sound.init(); Sound.sfxClick(); fn(); }); }
btn('#btnPlay', goSelect);
btn('#btnBack', goMenu);
btn('#btnStart', startGame);
btn('#btnResume', () => setPaused(false));
btn('#btnPauseMenu', goMenu);
btn('#btnRetry', startGame);
btn('#btnOverMenu', goMenu);
btn('#btnWinRetry', startGame);
btn('#btnWinMenu', goMenu);
btn('#btnPause', () => setPaused(true));
btn('#btnMute', () => Sound.setMuted(!Sound.muted));
document.querySelectorAll('.card.locked').forEach(cd => cd.addEventListener('click', e => {
  e.stopPropagation(); Sound.init(); Sound.tone(200, 0.15, 'square', 0.15);
  cd.classList.remove('shake'); void cd.offsetWidth; cd.classList.add('shake');
  toast(cd.querySelector('.cname').textContent + ' yakında geliyor! 🔒');
}));
btn('#btnNext', () => { setLevel(LV + 1); startGame(); });
function setLevel(lv) {
  LV = lv; L = LEVELS[lv]; store('kuki_lv', lv); G.speed = L.speed;
  refreshSelect(); renderPortraits(); Sound.playMusic(L.music);
}
function refreshSelect() {
  document.querySelectorAll('.card.pick').forEach(cd => cd.classList.toggle('selected', cd.dataset.id === CH));
  const ch = CHARS[CH];
  $('#dName').innerHTML = `${ch.name} <small>${ch.tag}</small>`;
  $('#dAbility').textContent = 'ÖZEL: ' + ch.ability;
  $('#dDesc').textContent = ch.desc;
  const un = unlocked();
  document.querySelectorAll('.lvl').forEach(b => { const lv = +b.dataset.lv; b.classList.toggle('selected', lv === LV); b.classList.toggle('locked', lv > un); });
}
document.querySelectorAll('.card.pick').forEach(cd => {
  cd.addEventListener('click', e => { e.stopPropagation(); Sound.init(); CH = cd.dataset.id; store('kuki_char', CH); Sound.whistle(); refreshSelect(); });
  cd.addEventListener('dblclick', () => startGame());
});
document.querySelectorAll('.lvl').forEach(b => b.addEventListener('click', e => {
  e.stopPropagation(); Sound.init();
  const lv = +b.dataset.lv;
  if (lv > unlocked()) { Sound.tone(200, 0.15, 'square', 0.15); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toast('Önce Bölüm ' + (lv - 1) + "'i bitir! 🔒"); return; }
  Sound.sfxClick(); setLevel(lv);
}));

function updateMuteIcon() {
  $('#btnMute').innerHTML = Sound.muted
    ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="#1a1320" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#1a1320" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
}
updateMuteIcon();

// ============================================================
//  Güncelleme
// ============================================================
function hurtKuki() {
  if (K.inv > 0 || G.state !== 'boss') return;
  K.hp--; K.inv = 1.4; K.hurtT = 0.3; G.shake = 12; G.flash = 0.25;
  Sound.sfxHurt(); renderHearts();
  pop(KUKI_X, K.y - 40, '-1 ❤', '#ff4d4d', 28);
  burst(KUKI_X, K.y, 10, 'feather', { col: '#fff', min: 80, max: 220 });
  if (K.hp <= 0) die();
  else if (Math.random() < 0.6) etoSay(pick(['Hehehe!', 'Tam isabet!', 'Tutanak yazıldı!', 'Uga buga!', 'Maaştan keserim!']), 1.4);
}
function die() {
  if (G.state === 'dying') return;
  const inBoss = G.state === 'boss';
  G.state = 'dying'; G.endT = 0;
  G.ult = null; $('#support').classList.add('hidden');
  K.vy = -380; G.shake = 16; G.flash = 0.4;
  Sound.sfxDie(); Sound.stopMusic();
  burst(KUKI_X, K.y, 16, 'feather', { col: '#fff', min: 80, max: 300 });
  if (inBoss) etoSay('Hah! Yarın sabah erken gel! UGA!', 3);
}
function startBossIntro() {
  G.state = 'bossIntro'; G.introT = 0;
  E.x = 660; E.y = 330;
  $('#progress').classList.add('hidden'); $('#score').classList.add('hidden');
  $('#banner .bt').textContent = L.boss; $('#banner .bs').textContent = L.bossSub;
  $('#bossbar .bname').innerHTML = `${L.boss} <small>${L.sub}</small>`;
  $('#banner').classList.remove('hidden');
  Sound.stopMusic(); Sound.sfxAlarm();
  G.shake = 6;
}
function startBoss() {
  G.state = 'boss';
  $('#banner').classList.add('hidden');
  $('#bossbar').classList.remove('hidden'); $('#hearts').classList.remove('hidden');
  renderHearts(); updateBossBar();
  $('#hintText').textContent = CHARS[CH].hint; $('#hint').classList.remove('hidden');
  G.bossHintT = 2.5;
  E.atkT = 1.6;
  Sound.playMusic('boss');
}
function etoHit(x, y, dmg = 1, kind = 'word') {
  if (E.kuki > 0) dmg *= 2;
  E.hp -= dmg; E.hit = 0.22; E.nose = 1; G.shake = Math.max(G.shake, kind === 'sugar' ? 2 : 4);
  if (kind === 'sugar') Sound.sfxCrunch(); else Sound.sfxBoing();
  const col = kind === 'sugar' ? '#ffffff' : kind === 'kuki' || kind === 'tongue' ? '#ff8fd1' : '#ffd23f';
  burst(x, y, kind === 'sugar' ? 4 : 10, 'coffee', { dir: Math.PI, spread: 1.1, min: 80, max: 280, col });
  if (Math.random() < 0.3 && E.sayT <= 0.3 && E.kuki <= 0) etoSay(pick(HIT_SAYS), 1.1);
  else if (kind !== 'sugar' || Math.random() < 0.35) pop(x - 10, y - 20, E.kuki > 0 ? 'x2!' : pick(CHARS[CH].pops), '#ffd23f', 26);
  G.scoreAcc += dmg; while (G.scoreAcc >= 1) { G.scoreAcc -= 1; addScore(1); }
  if (kind === 'kuki' && E.kuki <= 0) {
    G.kukiMeter++;
    if (G.kukiMeter >= KUKILE_AT) { G.kukiMeter = 0; kukile(); }
    else pop(E.x, E.y - 110, `KUKİ ${G.kukiMeter}/${KUKILE_AT}`, '#ff8fd1', 22);
  }
  updateBossBar();
  if (!G.ultUsed && E.hp <= E.max * ULT_AT && E.hp > 0) startUlt();
  if (!E.phase2 && E.hp <= E.max / 2) {
    E.phase2 = true; G.shake = 14; etoSay('Yeter! Artık ciddiyim!', 2.2);
    updateBossBar(); Sound.sfxAlarm();
  }
  if (!E.phase3 && E.hp <= E.max / 4) {
    E.phase3 = true; G.shake = 16; etoSay('UGA BUGAAA! Mağara modu!', 2.4); Sound.grunt(3);
  }
  if (E.hp <= 0) {
    E.dead = true; E.vy = -420; G.state = 'won'; G.endT = 0; G.shake = 22; G.flash = 0.5;
    G.shots = []; G.lasers = []; G.cups = [];
    addScore(50);
    E.kuki = 0; G.falls = []; G.tongue = null;
    etoSay(L.cave ? 'Bu daha da bitmedi Kuki… UGAAA!' : 'Bu daha bitmedi Kuki…', 3); Sound.grunt(3);
    Sound.stopMusic(); Sound.sfxWin();
    burst(E.x, E.y, 30, 'star', { col: '#ffd23f', min: 120, max: 420, smin: 6, smax: 11 });
    $('#bossbar').classList.add('hidden');
  }
}

function kukile() {
  E.kuki = 4; E.stun = Math.max(E.stun, 4); E.volley = 0; G.lasers = []; G.falls = [];
  pop(W / 2 + 30, E.y - 130, 'KUKİLENDİ!', '#ff8fd1', 40); G.shake = 14; G.flash = 0.3;
  burst(E.x, E.y, 24, 'star', { col: '#ff8fd1', min: 100, max: 360, smin: 5, smax: 10 });
  Sound.sfxKuki(); setTimeout(() => Sound.whistle(), 200);
  E.say = 'Fiyuuu~ 🎵 (Eto ıslık çalıyor)'; E.sayT = 2.4;
}
function spawnBoulders() {
  const slots = [170, 290, 410, 530, 640].sort(() => Math.random() - 0.5);
  const n = E.phase3 ? 3 : 2;
  for (let i = 0; i < n; i++) G.falls.push({ x: W + 50, y: slots[i], t: 0, warn: 0.9 + i * 0.35, vx: -(E.phase2 ? 470 : 410), r: 0 });
  E.throwA = 1; G.shake = 12; Sound.sfxRumble();
  etoSay('SOPA DEPREMİ! UGA!', 1.4);
}
function startUlt() {
  G.ultUsed = true; G.ult = { t: 0, origins: [] };
  G.shots = []; G.lasers = []; G.falls = []; E.volley = 0;
  const others = Object.keys(CHARS).filter(k => k !== CH);
  document.querySelectorAll('#support .sup').forEach((el, i) => {
    const cv = el.querySelector('canvas'); cv.dataset.who = others[i];
    el.querySelector('span').textContent = CHARS[others[i]].name; renderPortrait(cv);
  });
  const el = $('#support'); el.classList.remove('hidden', 'out', 'charge'); void el.offsetWidth;
  $('#supUlt').textContent = 'DESTEK GELDİ!';
  Sound.sfxSupport();
  setTimeout(() => etoSay('Ne?! Bunlar da kim?! HRRR!', 1.6), 50);
}
function updateUlt(dt) {
  const u = G.ult; if (!u) return;
  u.t += dt;
  if (u.t > 1.3 && !u.charge) {
    u.charge = true; $('#support').classList.add('charge'); $('#supUlt').textContent = 'ULTİ: TOPLU DİLEKÇE!'; Sound.sfxUlt();
    const sr = stage.getBoundingClientRect();
    u.origins = [...document.querySelectorAll('#support canvas')].map(cv => {
      const r = cv.getBoundingClientRect();
      return { x: (r.left + r.width / 2 - sr.left) / scale, y: (r.top + r.height / 2 - sr.top) / scale };
    });
  }
  if (u.t > 2.1 && !u.fired) {
    u.fired = true;
    E.hp = Math.max(1, E.hp - ULT_DMG); E.hit = 0.8; E.nose = 1; E.stun = 1.8; G.shake = 24; G.flash = 0.5;
    updateBossBar(); addScore(10);
    pop(W / 2 + 40, E.y - 100, '-' + ULT_DMG + ' ULTİ!', '#ffd23f', 40);
    burst(E.x, E.y + 20, 30, 'star', { col: '#ffd23f', min: 120, max: 420, smin: 6, smax: 11 });
    Sound.sfxBoing(); Sound.grunt(3);
    etoSay('UGHHH! Toplu dilekçe olmaz!', 2.2);
  }
  if (u.t > 3.1 && !u.out) { u.out = true; $('#support').classList.add('out'); }
  if (u.t > 3.6) { G.ult = null; $('#support').classList.add('hidden'); }
}
function updateExtras(dt) {
  // çay molası (can verir) — nadiren ve sadece can eksikse
  G.teaT -= dt;
  if (G.teaT <= 0) { G.teaT = rand(16, 22); if (K.hp < KUKI_HP) G.teas.push({ x: W + 30, y: rand(170, 600), t: 0 }); }
  for (const tp of G.teas) {
    tp.t += dt; tp.x -= 150 * dt;
    if (Math.hypot(tp.x - KUKI_X, tp.y + Math.sin(tp.t * 3) * 20 - K.y) < 36) {
      tp.dead = true; K.hp = Math.min(KUKI_HP, K.hp + 1); renderHearts();
      pop(KUKI_X + 40, K.y - 50, '+1 ❤ ÇAY MOLASI!', '#4ecdc4', 24); Sound.sfxScore();
    }
  }
  G.teas = G.teas.filter(tp => !tp.dead && tp.x > -40);
  // Kuki de laf sokar
  G.kSayT -= dt; G.kSayCd -= dt;
  if (G.kSayCd <= 0 && !G.ult) { G.kSay = pick(CHARS[CH].says); G.kSayT = 1.7; G.kSayCd = rand(7, 11); }
}

function etoHandPos() { return { x: E.x - 70 * 0.9, y: E.y + 30 }; }
function etoEyes() { return [{ x: E.x - 22 * 0.9, y: E.y - 16 * 0.9 }, { x: E.x + 10 * 0.9, y: E.y - 16 * 0.9 }]; }

function updateEto(dt) {
  E.t += dt;
  E.hit = Math.max(0, E.hit - dt);
  E.nose = Math.max(0, E.nose - dt * 1.6);
  E.throwA = Math.max(0, E.throwA - dt * 4);
  E.kuki = Math.max(0, E.kuki - dt);
  if (E.sayT > 0) { E.sayT -= dt; E.mouth = (E.sayT > 0) ? 0.4 + Math.abs(Math.sin(E.t * 14)) * 0.6 : 0; } else E.mouth = Math.max(0, E.mouth - dt * 4);

  if (E.dead) {
    E.vy += 900 * dt; E.y += E.vy * dt; E.x += 60 * dt; E.rot += dt * 4;
    return;
  }
  // giriş / süzülme
  const targetX = 372;
  E.x += (targetX - E.x) * Math.min(1, dt * 2.2);
  if (G.lasers.length) { /* lazer sırasında sabit */ }
  else {
    const amp = E.phase3 ? 180 : E.phase2 ? 160 : 120, spd = E.phase3 ? 1.9 : E.phase2 ? 1.5 : 1.1;
    const ty = 345 + Math.sin(E.t * spd) * amp;
    E.y += (ty - E.y) * Math.min(1, dt * 3);
  }
  if (G.state !== 'boss') return;
  if (G.ult) return;
  if (E.stun > 0) { E.stun -= dt; return; }

  // sataşma
  E.tauntT -= dt;
  if (E.tauntT <= 0 && E.sayT <= 0) { etoSay(pick(L.cave ? TAUNTS2 : TAUNTS), 2); E.tauntT = rand(4, 7); }

  // terlik yağmuru
  if (E.volley > 0) {
    E.volleyT -= dt;
    if (E.volleyT <= 0) {
      E.volley--; E.volleyT = E.phase2 ? 0.2 : 0.28; E.throwA = 1;
      const h = etoHandPos();
      const tx = KUKI_X, ty = K.y + rand(-50, 50);
      const sp = (E.phase2 ? 400 : 330);
      const a = Math.atan2(ty - h.y, tx - h.x);
      G.shots.push({ x: h.x, y: h.y - 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, r: 0, vr: rand(-14, -8), w: Math.random() < 0.5 ? pick(L.cave ? ETO2_WORDS : ETO_WORDS) : null, rock: L.cave });
      Sound.sfxSlipper();
    }
  }
  E.atkT -= dt;
  if (E.atkT <= 0 && E.volley <= 0 && !G.lasers.length && !G.falls.length) {
    const roll = Math.random(), lp = L.cave ? (E.phase3 ? 0.36 : E.phase2 ? 0.3 : 0.22) : (E.phase3 ? 0.45 : E.phase2 ? 0.38 : 0.26);
    if (L.cave && roll >= lp && roll < lp + 0.3) {
      spawnBoulders();
      E.atkT = E.phase3 ? 1.8 : E.phase2 ? 2.2 : 2.8;
    } else if (roll < lp) {
      const cy = clamp(K.y + rand(-20, 20), 140, 640);
      G.lasers.push({ t: 0, warn: E.phase2 ? 0.75 : 0.95, fire: 0.55, cx: KUKI_X + rand(40, 120), cy });
      etoSay('ŞAŞI LAZER!', 1.4);
      Sound.sfxLaserWarn();
      E.atkT = E.phase3 ? 1.7 : E.phase2 ? 2.1 : 2.8;
    } else {
      E.volley = E.phase3 ? 5 : E.phase2 ? 3 : 2; E.volleyT = 0.15;
      E.atkT = E.phase3 ? 1.4 : E.phase2 ? 1.8 : 2.4;
    }
  }
}

function update(dt) {
  G.t += dt;
  const moving = ['menu', 'select', 'ready', 'play', 'bossIntro', 'boss', 'won'].includes(G.state);
  if (moving) G.scroll += G.speed * dt;
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt);
  K.squash = Math.max(0, K.squash - dt * 6);
  K.flapT += dt; K.inv = Math.max(0, K.inv - dt); K.throwCd -= dt; K.hurtT = Math.max(0, K.hurtT - dt);

  if (G.state === 'menu' || G.state === 'select') { E.t += dt; return; }

  if (G.state === 'ready') {
    K.y = 400 + Math.sin(G.t * 4) * 10; K.rot = 0;
  }

  if (G.state === 'play' || G.state === 'boss' || G.state === 'dying') {
    K.vy = Math.min(MAX_FALL, K.vy + GRAVITY * dt);
    K.y += K.vy * dt;
    K.rot = G.state === 'dying' ? K.rot + dt * 9 : clamp(K.vy / 650, -0.45, 1.1);
    if (K.y < 20) { K.y = 20; K.vy = 0; }
  }

  if (G.state === 'play') {
    // engel üret
    if (G.spawned < L.obstacles) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) {
        G.spawnT = 1.55 * 165 / L.speed;
        const gap = Math.max(L.gapMin, L.gap0 - G.spawned * 3.5);
        const prev = G.obstacles.length ? G.obstacles[G.obstacles.length - 1].gapY : 400;
        const gapY = clamp(prev + rand(-190, 190), 150 + gap / 2, GROUND - 60 - gap / 2);
        G.obstacles.push({ x: W + 20, gapY, gap, scored: false });
        G.spawned++;
      }
    }
    for (const ob of G.obstacles) {
      ob.x -= G.speed * dt;
      if (!ob.scored && ob.x + OB_W < KUKI_X - 10) {
        ob.scored = true; G.passed++; addScore(1); Sound.sfxScore();
        $('#progress .fill').style.width = (G.passed / L.obstacles * 100) + '%';
      }
      // çarpışma
      const cx = KUKI_X + 2, cy = K.y, r = 16;
      const top = ob.gapY - ob.gap / 2, bot = ob.gapY + ob.gap / 2;
      if (circleRect(cx, cy, r, ob.x - 7, -50, OB_W + 14, top + 50) || circleRect(cx, cy, r, ob.x - 4, bot, OB_W + 8, GROUND - bot)) { die(); break; }
    }
    G.obstacles = G.obstacles.filter(o => o.x > -OB_W - 30);
    if (K.y > GROUND - 22) { K.y = GROUND - 22; die(); }
    if (G.spawned >= L.obstacles && G.obstacles.length === 0 && G.state === 'play') startBossIntro();
  }

  if (G.state === 'bossIntro') {
    G.introT += dt;
    K.y += (380 - K.y) * Math.min(1, dt * 2.5); K.vy = 0; K.rot = Math.sin(G.t * 3) * 0.08;
    if (G.introT > 1.3 && !E.say) etoSay(L.cave ? 'Bu daha bitmedi demiştim Kuki! UGA!' : 'Kuki… Seni bekliyordum!', 2.2);
    updateEto(dt);
    if (G.introT > 3.4) startBoss();
  }

  if (G.state === 'boss') {
    if (G.bossHintT > 0) { G.bossHintT -= dt; if (G.bossHintT <= 0) $('#hint').classList.add('hidden'); }
    if (K.y > GROUND - 22) { K.y = GROUND - 22; K.vy = -560; hurtKuki(); }
    updateEto(dt);
    updateUlt(dt);
    updateExtras(dt);
  }

  if (G.state === 'won') {
    updateEto(dt);
    K.y += (360 - K.y) * Math.min(1, dt * 2); K.vy = 0; K.rot = Math.sin(G.t * 8) * 0.15;
    G.endT += dt;
    if (G.endT > 1.0 && Math.random() < dt * 8) burst(rand(40, W - 40), rand(100, 400), 8, 'star', { col: pick(['#ffd23f', '#ff6b6b', '#4ecdc4', '#fff']), min: 60, max: 200 });
    if (G.endT > 2.8 && $('#scr-win').classList.contains('hidden')) victory();
  }

  if (G.state === 'dying') {
    if (E.x < 600) updateEto(dt);
    if (K.y > GROUND - 20) { K.y = GROUND - 20; K.vy = 0; }
    G.endT += dt;
    if (G.endT > 1.3 && $('#scr-over').classList.contains('hidden')) gameOver();
  }

  // kahve bardakları
  for (const c of G.cups) {
    c.vy += (c.g != null ? c.g : 160) * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += dt * (c.spin || 1);
    if (!E.dead && E.x < 600) {
      const dx = (c.x - E.x) / 52, dy = (c.y - (E.y + 50)) / 120;
      if (dx * dx + dy * dy < 1) { c.dead = true; etoHit(c.x, c.y, c.dmg || 1, c.kind); if (G.state === 'won') break; }
    }
  }
  G.cups = G.cups.filter(c => !c.dead && c.x < W + 40 && c.y < H);

  // terlikler
  for (const s of G.shots) {
    s.vy += 140 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt;
    const dx = s.x - (KUKI_X + 2), dy = s.y - K.y;
    if (G.state === 'boss' && dx * dx + dy * dy < 24 * 24) { s.dead = true; hurtKuki(); }
  }
  G.shots = G.shots.filter(s => !s.dead && s.x > -60 && s.y < H + 40 && s.y > -80);

  // kaya yuvarlanması (Bölüm 2)
  for (const b of G.falls) {
    b.t += dt;
    if (b.t > b.warn) { b.x += b.vx * dt; b.r -= dt * 8; }
    if (G.state === 'boss' && b.t > b.warn && Math.hypot(b.x - KUKI_X - 2, b.y - K.y) < 40) { b.dead = true; hurtKuki(); }
  }
  G.falls = G.falls.filter(b => !b.dead && b.x > -60);
  if (G.tongue) { G.tongue.t += dt; if (G.tongue.t > 0.26) G.tongue = null; }

  // lazer
  for (const L of G.lasers) {
    L.t += dt;
    if (L.t > L.warn && !L.fired) { L.fired = true; Sound.sfxLaser(); G.shake = 8; }
    if (L.fired && L.t < L.warn + L.fire && G.state === 'boss') {
      for (const e of etoEyes()) {
        const dx = L.cx - e.x, dy = L.cy - e.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        const px = KUKI_X + 2 - e.x, py = K.y - e.y;
        const along = px * ux + py * uy;
        if (along > 0 && Math.abs(px * uy - py * ux) < 22) { hurtKuki(); break; }
      }
    }
  }
  G.lasers = G.lasers.filter(L => L.t < L.warn + L.fire);

  // parçacıklar
  for (const p of G.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.type === 'feather') { p.vx *= 0.96; p.vy = p.vy * 0.96 + 60 * dt; }
    else { p.vy += 600 * dt; }
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const p of G.pops) { p.t += dt; p.y -= 50 * dt; }
  G.pops = G.pops.filter(p => p.t < 1);
}

function circleRect(cx, cy, r, x, y, w, h) {
  const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

// ============================================================
//  Çizim
// ============================================================
function wrapText(c, text, maxW) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
  if (line) lines.push(line); return lines;
}
function drawBubble(c, x, y, text, side = 'right') {
  c.save();
  c.font = '800 17px Nunito, sans-serif';
  const lines = wrapText(c, text, 190);
  const w = Math.max(...lines.map(l => c.measureText(l).width)) + 26, h = lines.length * 21 + 16;
  const bx = side === 'right' ? clamp(x - w, 10, W - w - 10) : clamp(x, 10, W - w - 10), by = y - h;
  const t1 = side === 'right' ? bx + w - 40 : bx + 22, t2 = side === 'right' ? bx + w - 14 : bx + 8, t3 = side === 'right' ? bx + w - 22 : bx + 40;
  const bg = side === 'right' ? '#fff' : '#fff4d1';
  rr(c, bx, by, w, h, 12); fillStroke(c, bg, 3);
  c.beginPath(); c.moveTo(t1, by + h - 1.5); c.lineTo(t2, by + h + 18); c.lineTo(t3, by + h - 1.5); c.closePath(); fillStroke(c, bg, 0);
  c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(t1, by + h); c.lineTo(t2, by + h + 18); c.lineTo(t3, by + h); c.stroke();
  c.fillStyle = INK; c.textBaseline = 'top';
  lines.forEach((l, i) => c.fillText(l, bx + 13, by + 9 + i * 21));
  c.restore();
}

function render() {
  const c = ctx;
  c.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  c.save();
  if (G.shake > 0) c.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);

  drawBackground(c, G.scroll);
  for (const ob of G.obstacles) drawObstacle(c, ob);
  drawFloor(c, G.scroll);

  const inMenu = G.state === 'menu' || G.state === 'select';

  // Eto
  if (inMenu) {
    drawEto(c, 368, 420 + Math.sin(G.t * 1.6) * 12, { t: G.t, size: 0.8, cave: L.cave, mouth: G.state === 'menu' ? (Math.sin(G.t * 2) > 0.6 ? 0.6 : 0) : 0 });
  } else if (E.x < 640) {
    const inLaser = G.lasers.length > 0;
    drawEto(c, E.x, E.y, { t: E.t, size: 0.9, hit: E.hit, nose: E.nose, mouth: E.mouth, throwA: E.throwA, holding: E.volley > 0, angry: E.phase2, laser: inLaser, dizzy: E.dead || E.hit > 0.05 || E.stun > 0, rot: E.rot, cave: L.cave });
    if (E.kuki > 0 && !E.dead) {
      // kukilenmiş Eto: kafası Kuki'ye dönüşür
      c.save(); c.translate(E.x - 2, E.y - 6); c.rotate(Math.sin(E.t * 6) * 0.12); c.scale(-2.9, 2.9); c.translate(-4, 16);
      drawKukiHead(c, { t: E.t, happy: true }, E.t); c.restore();
      for (let i = 0; i < 3; i++) { const a = E.t * 4 + i * 2.1; drawStar(c, E.x + Math.cos(a) * 60, E.y - 60 + Math.sin(a) * 14, 7, '#ff8fd1'); }
    }
  }

  // lazerler
  for (const L of G.lasers) {
    for (const e of etoEyes()) {
      const dx = L.cx - e.x, dy = L.cy - e.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      const ex = e.x + ux * 900, ey = e.y + uy * 900;
      c.save(); c.lineCap = 'round';
      if (!L.fired) {
        c.setLineDash([10, 10]); c.lineDashOffset = -G.t * 60;
        c.strokeStyle = `rgba(255,40,40,${0.4 + Math.sin(G.t * 30) * 0.3})`; c.lineWidth = 3;
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(ex, ey); c.stroke();
      } else {
        const k = 1 - (L.t - L.warn) / L.fire;
        c.strokeStyle = `rgba(255,60,40,${0.45 * k})`; c.lineWidth = 34 * k + 6;
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(ex, ey); c.stroke();
        c.strokeStyle = `rgba(255,240,150,${k})`; c.lineWidth = 10 * k + 2;
        c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(ex, ey); c.stroke();
      }
      c.restore();
    }
    if (!L.fired) { c.save(); c.fillStyle = 'rgba(255,40,40,.8)'; c.font = '28px "Lilita One", sans-serif'; c.textAlign = 'center'; c.fillText('✕', L.cx, L.cy + 10); c.restore(); }
  }

  for (const s of G.shots) {
    if (s.w) drawWord(c, s.x, s.y, s.w, L.cave ? '#7a4a1c' : '#d42a2a', '#fff', Math.sin(s.r) * 0.25, 15);
    else if (s.rock) drawRock(c, s.x, s.y, 1.5, s.r);
    else drawSlipper(c, s.x, s.y, 1, s.r);
  }
  for (const b of G.falls) {
    if (b.t <= b.warn) {
      if (Math.floor(G.t * 10) % 2) { c.save(); c.font = '34px "Lilita One", sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = INK; c.strokeText('◀!', W - 30, b.y + 12); c.fillStyle = '#ff4d4d'; c.fillText('◀!', W - 30, b.y + 12); c.restore(); }
    } else drawRock(c, b.x, b.y, 2.3, b.r);
  }
  for (const tp of G.teas) drawTea(c, tp.x, tp.y + Math.sin(tp.t * 3) * 20, tp.t);
  for (const cp of G.cups) {
    if (cp.kind === 'sugar') drawSugar(c, cp.x, cp.y, 1, cp.r);
    else if (cp.kind === 'kuki') {
      circle(c, cp.x, cp.y, 15 + Math.sin(G.t * 30) * 2); c.fillStyle = 'rgba(255,143,209,.45)'; c.fill();
      c.save(); c.translate(cp.x, cp.y); c.rotate(Math.sin(cp.r) * 0.4); c.scale(0.6, 0.6); c.translate(-4, 16); drawKukiHead(c, { t: G.t, happy: true }, G.t); c.restore();
    } else drawWord(c, cp.x, cp.y, cp.w, '#ffd23f', INK, Math.sin(cp.r * 12) * 0.15);
  }

  // Kuki
  if (inMenu) {
    drawKuki(c, 118, 470 + Math.sin(G.t * 3) * 14, { t: G.t, size: 1.6, wing: Math.sin(G.t * 10) * 0.5, happy: true, who: CH });
  } else if (!(K.inv > 0 && Math.floor(G.t * 16) % 2 === 0)) {
    const flapping = K.flapT < 0.35;
    drawKuki(c, KUKI_X, K.y, {
      t: G.t, rot: K.rot, squash: K.squash, size: 1.15,
      wing: flapping ? Math.sin(K.flapT * 40) * 0.8 : Math.sin(G.t * 5) * 0.25,
      dead: G.state === 'dying', hurt: K.hurtT > 0, scared: G.lasers.some(l => !l.fired) || G.falls.length > 0, happy: G.state === 'won',
      who: CH, tongue: !!G.tongue,
    });
  }
  // Efe'nin dil darbesi
  if (G.tongue && !(K.inv > 0 && Math.floor(G.t * 16) % 2 === 0)) {
    const tg = G.tongue, tt = tg.t;
    const len = tt < 0.08 ? tg.reach * tt / 0.08 : tt < 0.14 ? tg.reach : tg.reach * Math.max(0, 1 - (tt - 0.14) / 0.12);
    const mx = KUKI_X + 8, my = K.y - 6, ey = my + Math.sin(tt * 50) * 4;
    c.save(); c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 16; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + len, ey); c.stroke();
    c.strokeStyle = '#ff7aa2'; c.lineWidth = 11; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + len, ey); c.stroke();
    c.strokeStyle = '#ffb3c8'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(mx + 4, my); c.lineTo(mx + len - 6, ey); c.stroke();
    circle(c, mx + len, ey, 9); fillStroke(c, '#ff7aa2', 2.5);
    c.restore();
  }

  // parçacıklar
  for (const p of G.parts) {
    c.save(); c.globalAlpha = clamp(p.life / 0.5, 0, 1); c.translate(p.x, p.y); c.rotate(p.rot);
    if (p.type === 'feather') { c.beginPath(); c.ellipse(0, 0, p.size * 1.6, p.size * 0.6, 0, 0, Math.PI * 2); fillStroke(c, p.col, 1); }
    else if (p.type === 'star') drawStar(c, 0, 0, p.size, p.col);
    else { circle(c, 0, 0, p.size); c.fillStyle = p.col; c.fill(); }
    c.restore();
  }
  // yazılar
  for (const p of G.pops) {
    c.save(); c.globalAlpha = 1 - p.t; c.font = `${p.size}px "Lilita One", sans-serif`; c.textAlign = 'center';
    const sc = 1 + Math.max(0, 0.3 - p.t) * 2; c.translate(p.x, p.y); c.scale(sc, sc);
    c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(p.text, 0, 0); c.fillStyle = p.col; c.fillText(p.text, 0, 0);
    c.restore();
  }
  // konuşma balonu
  if (E.sayT > 0 && E.x < 640 && !inMenu) drawBubble(c, E.x - 30, E.y - 72, E.say);
  if (G.kSayT > 0 && G.state === 'boss') drawBubble(c, KUKI_X - 30, K.y - 44, G.kSay, 'left');
  // destek ultisi ışınları
  const u = G.ult;
  if (u && u.charge && !u.fired) {
    for (const o of u.origins) { circle(c, o.x, o.y, 30 + Math.sin(G.t * 40) * 8); c.fillStyle = 'rgba(255,210,63,.35)'; c.fill(); }
  }
  if (u && u.fired && u.t < 3.0) {
    const k = clamp(1 - (u.t - 2.1) / 0.9, 0, 1);
    c.save(); c.lineCap = 'round';
    for (const o of u.origins) {
      const tx = E.x + rand(-6, 6), ty = E.y + 20 + rand(-6, 6);
      c.strokeStyle = `rgba(255,140,30,${0.55 * k})`; c.lineWidth = 46 * k + 8; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(tx, ty); c.stroke();
      c.strokeStyle = `rgba(255,230,120,${k})`; c.lineWidth = 22 * k + 4; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(tx, ty); c.stroke();
      c.strokeStyle = `rgba(255,255,255,${k})`; c.lineWidth = 8 * k + 2; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(tx, ty); c.stroke();
    }
    c.restore();
  }
  if (inMenu && G.state === 'menu') {
    c.save(); c.font = '64px "Lilita One", sans-serif'; c.textAlign = 'center';
    const s = 1 + Math.sin(G.t * 4) * 0.06; c.translate(W / 2 + 4, 460); c.scale(s, s); c.rotate(-0.08);
    c.lineWidth = 10; c.strokeStyle = INK; c.strokeText('VS', 0, 0); c.fillStyle = '#ff4d4d'; c.fillText('VS', 0, 0);
    c.restore();
  }
  c.restore();
  if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash * 1.4})`; c.fillRect(0, 0, W, H); }
}

// ============================================================
//  Döngü
// ============================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (!G.paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

// başlat
const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
LV = Math.min(Math.max(1, +(store('kuki_lv') || 1)), unlocked()); L = LEVELS[LV] || LEVELS[1];
{ const sc = store('kuki_char'); if (sc && CHARS[sc]) CH = sc; }
fontsReady.then(() => { renderPortraits(); });
renderPortraits();
refreshSelect();
goMenu();
requestAnimationFrame(loop);

// test kancası (konsoldan): KUKI_DEBUG.boss()
window.KUKI_DEBUG = { setLevel, pick(c) { CH = c; refreshSelect(); }, boss() { startGame(); G.state = 'play'; G.spawned = L.obstacles; G.obstacles = []; $('#hint').classList.add('hidden'); }, G, K, E };
})();
