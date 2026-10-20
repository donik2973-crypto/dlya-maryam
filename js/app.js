/* ================= helpers ================= */
const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;
const pad = (n) => String(n).padStart(2, "0");
const [sy, sm, sd] = CONFIG.startDate.split("-").map(Number);
const START = new Date(sy, sm - 1, sd, 0, 0, 0);
const PINKS = ["#ff6fb5", "#ff9ccf", "#b18cff", "#8a7bff", "#6fa8ff", "#a8d4ff"];
const mouse = { x: -9999, y: -9999 };
addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

function fx(char, x, y, size, keyframes, duration, easing = "cubic-bezier(.2,.7,.3,1)") {
  const el = document.createElement("span");
  el.className = "fx";
  el.textContent = char;
  el.style.fontSize = size + "px";
  document.body.appendChild(el);
  el.animate(keyframes.map((k) => ({
    opacity: k.o,
    transform: `translate(${x + (k.x || 0)}px, ${y + (k.y || 0)}px) translate(-50%,-50%) scale(${k.s ?? 1}) rotate(${k.r || 0}deg)`,
  })), { duration, easing, fill: "forwards" }).onfinish = () => el.remove();
}

function burst(x, y, n = 18, set = ["✨", "⭐", "💫", "💜", "🩵", "🌟"]) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(70, 200);
    fx(set[i % set.length], x, y, rand(16, 32),
      [{ o: 1, s: 0.3 }, { o: 1, s: 1.1, x: Math.cos(a) * r * 0.7, y: Math.sin(a) * r * 0.7, r: rand(-30, 30) },
       { o: 0, s: 0.9, x: Math.cos(a) * r, y: Math.sin(a) * r + 30, r: rand(-60, 60) }], rand(900, 1500));
  }
}

function ring(x, y, { size = 300, color = "#ff7aac", width = 3, dur = 900, delay = 0 } = {}) {
  const el = document.createElement("span");
  el.className = "ring";
  el.style.cssText = `width:${size}px;height:${size}px;border-width:${width}px;border-color:${color};opacity:0`;
  document.body.appendChild(el);
  el.animate([
    { opacity: 1, transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(0)` },
    { opacity: 0, transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(1)` },
  ], { duration: dur, delay, easing: "cubic-bezier(.1,.7,.3,1)", fill: "forwards" }).onfinish = () => el.remove();
}

function flash(peak = 0.75, dur = 700) {
  $("#flash").animate([{ opacity: 0 }, { opacity: peak, offset: 0.25 }, { opacity: 0 }], { duration: dur, easing: "ease-out" });
}

function heartRain(n = 50) {
  const set = ["⭐", "✨", "🌟", "💫", "📚", "💜", "🩵"];
  for (let i = 0; i < n; i++) {
    const x = Math.random() * innerWidth, drift = rand(-80, 80);
    setTimeout(() => {
      fx(set[Math.floor(Math.random() * set.length)], x, -40, rand(18, 40),
        [{ o: 1, r: 0 }, { o: 1, x: drift * 0.6, y: innerHeight * 0.6, r: 180 }, { o: 0, x: drift, y: innerHeight + 80, r: 340 }],
        rand(3000, 5500), "linear");
    }, Math.random() * 1800);
  }
}

/* split text into animated letters; colors fade pink → purple across the word */
function splitLetters(el, text, { colors = null, wrapWords = true } = {}) {
  el.textContent = "";
  const words = text.split(" ");
  const total = text.replace(/ /g, "").length;
  let i = 0;
  const mix = (t) => {
    const stops = colors, seg = (stops.length - 1) * t, k = Math.min(Math.floor(seg), stops.length - 2), f = seg - k;
    const a = stops[k].match(/\w\w/g).map((h) => parseInt(h, 16)), b = stops[k + 1].match(/\w\w/g).map((h) => parseInt(h, 16));
    return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`;
  };
  words.forEach((word, wi) => {
    const w = document.createElement("span");
    if (wrapWords) w.className = "w";
    for (const ch of Array.from(word)) {
      const c = document.createElement("span");
      c.className = "c";
      c.textContent = ch;
      c.style.setProperty("--i", i);
      if (colors) c.style.color = mix(total > 1 ? i / (total - 1) : 0);
      w.appendChild(c);
      i++;
    }
    el.appendChild(w);
    if (wi < words.length - 1) el.appendChild(document.createTextNode(" "));
  });
}

async function typeText(el, text, speed = 60) {
  el.classList.add("caret");
  for (const ch of Array.from(text)) {
    el.textContent += ch;
    await sleep(ch === "." || ch === "," || ch === "…" ? speed * 4 : speed);
  }
  el.classList.remove("caret");
}

/* achievements (gamer touch) */
const toast = $("#toast"), toastTitle = $("#toastTitle");
const toastQueue = [], unlocked = new Set();
let toastBusy = false;
function achieve(id, title) {
  if (unlocked.has(id)) return;
  unlocked.add(id);
  toastQueue.push(title);
  if (!toastBusy) nextToast();
}
async function nextToast() {
  const t = toastQueue.shift();
  if (!t) { toastBusy = false; return; }
  toastBusy = true;
  toastTitle.textContent = t;
  toast.classList.add("show");
  await sleep(2900);
  toast.classList.remove("show");
  await sleep(600);
  nextToast();
}

/* tab title when she switches away */
document.addEventListener("visibilitychange", () => {
  document.title = document.hidden ? `вернись, ${CONFIG.herName} 🥺` : `Для ${CONFIG.herName} ✨`;
});

/* ================= custom cursor ================= */
(function cursor() {
  if (!finePointer || reduceMotion) return;
  const ringEl = $("#cRing"), dot = $("#cDot");
  let rx = innerWidth / 2, ry = innerHeight / 2, shown = false;
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!shown) { shown = true; document.body.classList.add("has-cursor"); rx = e.clientX; ry = e.clientY; }
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
  document.addEventListener("pointerover", (e) => {
    ringEl.classList.toggle("hover", !!e.target.closest("button, input, .flip, .wk, .bk, .envelope, .crew span"));
  });
  document.addEventListener("mouseleave", () => { document.body.classList.remove("has-cursor"); shown = false; });
  (function loop() {
    rx += (mouse.x - rx) * 0.18; ry += (mouse.y - ry) * 0.18;
    ringEl.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  })();
})();

/* little heart trail behind the mouse */
let trailOn = false, lastTrail = 0;
addEventListener("pointermove", (e) => {
  if (!trailOn || reduceMotion || e.pointerType !== "mouse") return;
  const now = performance.now();
  if (now - lastTrail < 60) return;
  lastTrail = now;
  fx(Math.random() < 0.6 ? "✦" : "⭐", e.clientX, e.clientY, rand(9, 17),
    [{ o: 0.9, s: 1 }, { o: 0, s: 0.3, y: rand(26, 46), x: rand(-12, 12), r: rand(-40, 40) }], 900);
});

/* ================= background: petals, hearts & twinkling stars ================= */
(function background() {
  const cv = $("#bg"), c = cv.getContext("2d");
  let W = 0, H = 0;
  const P = [], S = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function make(randomY) {
    return {
      x: Math.random() * W, y: randomY ? Math.random() * H : -30, s: rand(8, 22), vy: rand(0.25, 0.85),
      sway: Math.random() * 6.28, swaySpeed: rand(0.005, 0.017), rot: Math.random() * 6.28, vr: rand(-0.01, 0.01),
      heart: Math.random() < 0.45, color: PINKS[Math.floor(Math.random() * PINKS.length)], a: rand(0.3, 0.75), px: 0, py: 0,
    };
  }
  function seed() {
    P.length = 0; S.length = 0;
    const count = reduceMotion ? 12 : Math.min(48, Math.round((W * H) / 26000) + 14);
    for (let i = 0; i < count; i++) P.push(make(true));
    for (let i = 0; i < 22; i++) S.push({ x: Math.random() * W, y: Math.random() * H, s: rand(3, 7), ph: Math.random() * 6.28, sp: rand(0.8, 2) });
  }
  function heart(s) {
    c.beginPath();
    c.moveTo(0, s * 0.3);
    c.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
    c.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
    c.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3);
    c.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.3);
    c.fill();
  }
  function star(x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
    c.fill();
  }
  resize(); seed();
  addEventListener("resize", () => { const tiny = W < 50 || H < 50; resize(); if (tiny) seed(); });
  function frame(t) {
    c.clearRect(0, 0, W, H);
    for (const p of P) {
      p.sway += p.swaySpeed; p.y += p.vy; p.x += Math.sin(p.sway) * 0.5; p.rot += p.vr;
      // gently push away from the mouse
      const dx = p.x + p.px - mouse.x, dy = p.y + p.py - mouse.y, d = Math.hypot(dx, dy);
      if (d < 130 && d > 0.1) { const f = (1 - d / 130) * 3; p.px += (dx / d) * f; p.py += (dy / d) * f; }
      p.px *= 0.95; p.py *= 0.95;
      if (p.y > H + 30) Object.assign(p, make(false));
      c.save();
      c.globalAlpha = p.a; c.fillStyle = p.color;
      c.translate(p.x + p.px, p.y + p.py); c.rotate(p.rot);
      if (p.heart) { star(0, 0, p.s * 0.55); }
      else { c.beginPath(); c.ellipse(0, 0, p.s * 0.32, p.s * 0.6, 0, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    c.fillStyle = "#fff";
    const time = (t || 0) / 1000;
    for (const s of S) {
      const a = Math.max(0, Math.sin(time * s.sp + s.ph));
      if (a < 0.02) continue;
      c.globalAlpha = a * 0.9;
      star(s.x, s.y, s.s * (0.6 + a * 0.6));
    }
    c.globalAlpha = 1;
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  frame(0);
})();

/* ================= fireworks (heart-shaped!) ================= */
const Fireworks = (() => {
  const cv = $("#fw"), c = cv.getContext("2d");
  let W = 0, H = 0, running = false;
  const rockets = [], parts = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  function explode(x, y) {
    const color = PINKS[Math.floor(Math.random() * PINKS.length)];
    const sp = (Math.min(W, H) * 0.22) / 1067;
    const heartShape = Math.random() < 0.7;
    const n = heartShape ? 90 : 70;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      let vx, vy;
      if (heartShape) {
        vx = 16 * Math.sin(t) ** 3 * sp;
        vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * sp;
      } else {
        const v = rand(0.6, 1) * 15 * sp;
        vx = Math.cos(t) * v; vy = Math.sin(t) * v;
      }
      parts.push({ x, y, vx, vy, life: 1, color: Math.random() < 0.15 ? "#ffffff" : color, s: rand(1.6, 3) });
    }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * 6.28, v = rand(1, 6);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8, color: "#fff", s: rand(0.8, 1.6) });
    }
  }
  function launch(x) {
    const ty = H * rand(0.15, 0.42);
    rockets.push({ x, y: H + 10, vx: rand(-1, 1), vy: -Math.sqrt(2 * 0.14 * (H + 10 - ty)) });
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function loop() {
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.x += r.vx; r.y += r.vy; r.vy += 0.14;
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(r.x, r.y, 2.4, 0, 6.28); c.fill();
      c.fillStyle = "rgba(255,156,194,.6)";
      c.beginPath(); c.arc(r.x - r.vx, r.y - r.vy * 1.5, 1.6, 0, 6.28); c.fill();
      if (r.vy >= -0.5) { explode(r.x, r.y); rockets.splice(i, 1); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.035;
      p.x += p.vx; p.y += p.vy; p.life -= 0.011;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      c.globalAlpha = Math.min(1, p.life * 1.4);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.28); c.fill();
    }
    c.globalAlpha = 1;
    if (rockets.length || parts.length) requestAnimationFrame(loop);
    else { running = false; c.clearRect(0, 0, W, H); }
  }
  resize();
  return {
    show(n = 7) { for (let i = 0; i < n; i++) setTimeout(() => launch(rand(W * 0.12, W * 0.88)), i * 380); },
    at(x, y) { explode(x, y); if (!running) { running = true; requestAnimationFrame(loop); } },
  };
})();

/* ================= 1. LOADER ================= */
(function loader() {
  const path = $("#ldPath");
  try { $("#ldHeart").style.setProperty("--len", Math.ceil(path.getTotalLength())); } catch (e) {}
  const text = CONFIG.loaderText;
  Array.from(text).forEach((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? " " : ch;
    s.style.setProperty("--i", i);
    $("#ldText").appendChild(s);
  });
})();

async function runLoader() {
  const heart = $("#ldHeart");
  await sleep(1900);
  heart.classList.add("beat");
  await sleep(950);
  heart.classList.remove("beat");
  await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), sleep(1200)]);
  $("#loader").classList.add("exit");
  await sleep(450);
  const lock = $("#lock");
  lock.classList.remove("waiting");
  lock.classList.add("on");
  await sleep(700);
  $("#loader").remove();
  setTimeout(autoUnlock, 2200);
}

/* a soft music-box "plink": quiet sine notes that walk up a gentle scale */
const TYPE_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // C major pentatonic, rising
function softTick(i, vol = 0.035) {
  try {
    const ctx = audio(), t = ctx.currentTime;
    const f = TYPE_NOTES[i % TYPE_NOTES.length];
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.value = f;
    lp.type = "lowpass"; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(lp).connect(g).connect(master);
    o.start(t); o.stop(t + 0.5);
  } catch (e) {}
}
function softChord() {   // a calm C-major chord when the lock opens
  [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => setTimeout(() => {
    try {
      const ctx = audio(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1.5);
    } catch (e) {}
  }, k * 70));
}

/* the password types itself — no need to know it */
async function autoUnlock() {
  const pw = $("#pw"), btn = $("#lockForm button");
  pw.readOnly = true;
  pw.classList.add("auto");
  let i = 0;
  for (const ch of CONFIG.autoPassword) {
    pw.value += ch;
    pw.dispatchEvent(new Event("input"));
    softTick(Math.floor(i++ / 2));        // every 2 letters the note steps up — sounds like a tiny melody
    await sleep(rand(150, 230));
  }
  await sleep(450);
  btn.classList.add("pressed");
  softChord();
  await sleep(250);
  $("#lockForm").requestSubmit();
}
runLoader();

/* ================= 2. LOCK SCREEN ================= */
const lockCard = $("#lockCard"), pw = $("#pw"), err = $("#err"), lockSvg = $("#lockSvg");
Array.from(`Привет, ${CONFIG.herName}`).forEach((ch, i) => {
  const s = document.createElement("span");
  s.textContent = ch === " " ? " " : ch;
  s.style.setProperty("--i", i);
  $("#lockTitle").appendChild(s);
});
$("#hint").textContent = CONFIG.hint;
const wrongMsgs = ["Хм, не то 🙈", "Попробуй ещё ✨"];
let wrongCount = 0;

/* 3D tilt that follows the mouse */
$("#lock").addEventListener("pointermove", (e) => {
  if (reduceMotion || e.pointerType !== "mouse") return;
  const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
  $("#lockTilt").style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
});
$("#lock").addEventListener("pointerleave", () => { $("#lockTilt").style.transform = ""; });

/* a heart pops out of the box on every key press */
let lastLen = 0;
pw.addEventListener("input", () => {
  if (pw.value.length > lastLen) {
    const r = pw.getBoundingClientRect();
    const x = r.left + Math.min(r.width - 20, 22 + pw.value.length * 11);
    fx(["⭐", "✨", "💫", "🌟"][pw.value.length % 4], x, r.top + r.height / 2, 16,
      [{ o: 1, s: 0.3 }, { o: 1, s: 1.2, y: -36, x: rand(-10, 10) }, { o: 0, s: 0.7, y: -80, x: rand(-30, 30), r: rand(-60, 60) }], 900);
    lockSvg.classList.add("bump");
    setTimeout(() => lockSvg.classList.remove("bump"), 120);
  }
  lastLen = pw.value.length;
});

function isRight(value) {
  const raw = value.trim().toLowerCase();
  const digits = raw.replace(/\D/g, "");
  return CONFIG.passwords.some((p) => {
    const q = String(p).trim().toLowerCase();
    return q === raw || (digits && q === digits);
  });
}

function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

let unlocking = false;
$("#lockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (unlocking) return;
  const [cx, cy] = center(lockSvg);
  if (isRight(pw.value)) {
    unlocking = true;
    document.dispatchEvent(new CustomEvent("ella:unlock"));
    err.textContent = "";
    pw.blur();
    lockCard.classList.add("unlocked");
    burst(cx, cy, 14, ["✨", "⭐"]);
    await sleep(500);
    ring(cx, cy, { size: 260, width: 4 });
    ring(cx, cy, { size: 520, width: 3, color: "#8f7bff", delay: 120 });
    ring(cx, cy, { size: 900, width: 2, color: "#ffffff", delay: 240, dur: 1200 });
    await sleep(700);
    flash(0.8, 800);
    burst(cx, cy, 30);
    $("#lock").classList.add("gone");
    runIntro(cx, cy);
  } else {
    document.dispatchEvent(new CustomEvent("ella:wrong"));
    err.textContent = wrongMsgs[wrongCount++ % wrongMsgs.length];
    err.classList.remove("pop"); void err.offsetWidth; err.classList.add("pop");
    lockCard.classList.remove("shake"); void lockCard.offsetWidth;
    lockCard.classList.add("shake", "wrong");
    setTimeout(() => lockCard.classList.remove("wrong"), 700);
    ring(cx, cy, { size: 180, color: "#ff3d7f", width: 3, dur: 600 });
    fx("💔", cx, cy - 30, 34, [{ o: 0, s: 0.3 }, { o: 1, s: 1.3, y: -40 }, { o: 0, s: 1, y: -90, r: 20 }], 1100);
    pw.select();
  }
});

/* ================= 3. INTRO: particles that become a heart → her name → the date ================= */
const Morph = (() => {
  const cv = $("#morph"), c = cv.getContext("2d");
  let W = 0, H = 0, parts = [], shape = null, mode = "form", running = false, MAX = 1500;
  const local = { x: -9999, y: -9999 };
  cv.addEventListener("pointermove", (e) => { local.x = e.clientX; local.y = e.clientY; });
  cv.addEventListener("pointerdown", (e) => { local.x = e.clientX; local.y = e.clientY; });
  cv.addEventListener("pointerleave", () => { local.x = local.y = -9999; });
  cv.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") local.x = local.y = -9999; });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    MAX = W < 600 ? 1000 : 1700;
  }
  function box() { return { cx: W / 2, cy: H * 0.47, bw: Math.min(W * 0.86, 1000), bh: H * 0.32 }; }

  function draw(o, s) {
    const { cx, cy, bw, bh } = box();
    o.fillStyle = "#000";
    if (s === "star") {
      const R = Math.min(bw, bh) * 0.62, r = R * 0.45;
      o.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr + R * 0.08;
        i ? o.lineTo(px, py) : o.moveTo(px, py);
      }
      o.closePath(); o.fill();
    } else if (s === "heart") {
      const k = Math.min(bw / 32, bh / 29) * 1.05;
      o.beginPath();
      for (let i = 0; i <= 240; i++) {
        const t = (i / 240) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const px = cx + x * k, py = cy + (y - 2.5) * k;
        i ? o.lineTo(px, py) : o.moveTo(px, py);
      }
      o.fill();
    } else {
      let size = bh * s.scale;
      o.font = s.font.replace("SIZE", size);
      const w = o.measureText(s.text).width;
      if (w > bw) { size *= bw / w; o.font = s.font.replace("SIZE", size); }
      o.textAlign = "center"; o.textBaseline = "middle";
      o.fillText(s.text, cx, cy);
    }
  }
  function sample(s) {
    const oc = document.createElement("canvas");
    oc.width = W; oc.height = H;
    const o = oc.getContext("2d");
    draw(o, s);
    const d = o.getImageData(0, 0, W, H).data, pts = [];
    const step = W < 600 ? 4 : 5;
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step)
        if (d[(y * W + x) * 4 + 3] > 128) pts.push([x + rand(-1, 1), y + rand(-1, 1)]);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    return pts.length ? pts.slice(0, MAX) : [[W / 2, H / 2]];
  }
  function to(s) {
    shape = s; mode = "form";
    const pts = sample(s);
    parts.forEach((p, i) => { const q = pts[i % pts.length]; p.tx = q[0]; p.ty = q[1]; });
  }
  function start(ox, oy) {
    resize();
    parts = [];
    for (let i = 0; i < MAX; i++) {
      const a = Math.random() * 6.28, v = rand(2, 22);
      const white = Math.random() < 0.08;
      parts.push({
        x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, tx: ox, ty: oy,
        k: rand(0.018, 0.05), r: white ? rand(1.4, 2.6) : rand(1.2, 2.5), ci: white ? 6 : Math.floor(Math.random() * 6),
        ph: Math.random() * 6.28, a: 1,
      });
    }
    if (!running) { running = true; requestAnimationFrame(loop); }
  }
  function explode() {
    mode = "free";
    const { cx, cy } = box();
    for (const p of parts) {
      const a = Math.atan2(p.y - cy, p.x - cx) + rand(-0.4, 0.4), v = rand(6, 24);
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 4;
    }
  }
  const colors = [...PINKS, "#ffffff"];
  function loop(t) {
    const time = t / 1000;
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = "rgba(0,0,0,0.32)";
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    const { cx, cy } = box();
    const beat = shape === "heart" || shape === "star" ? 1 + 0.07 * Math.pow(Math.max(0, Math.sin(time * 5.2)), 6) : 1 + 0.012 * Math.sin(time * 2);
    const buckets = colors.map(() => []);
    let alive = 0;
    for (const p of parts) {
      if (mode === "form") {
        const tx = cx + (p.tx - cx) * beat, ty = cy + (p.ty - cy) * beat;
        p.vx = (p.vx + (tx - p.x) * p.k) * 0.86;
        p.vy = (p.vy + (ty - p.y) * p.k) * 0.86;
      } else {
        p.vy += 0.25; p.vx *= 0.985; p.a -= 0.014;
      }
      const dx = p.x - local.x, dy = p.y - local.y, d2 = dx * dx + dy * dy;
      if (d2 < 9000 && d2 > 0.5) { const d = Math.sqrt(d2), f = (1 - d / 95) * 6; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      p.x += p.vx; p.y += p.vy;
      if (p.a > 0) { alive++; buckets[p.ci].push(p); }
    }
    buckets.forEach((list, i) => {
      if (!list.length) return;
      c.fillStyle = colors[i];
      c.globalAlpha = mode === "free" ? Math.max(0, list[0].a) : i === 6 ? 0.6 + 0.4 * Math.sin(time * 4) : 0.95;
      c.beginPath();
      for (const p of list) { c.moveTo(p.x + p.r, p.y); c.arc(p.x, p.y, p.r, 0, 6.28); }
      c.fill();
    });
    c.globalAlpha = 1;
    if (alive) requestAnimationFrame(loop);
    else { running = false; c.clearRect(0, 0, W, H); }
  }
  addEventListener("resize", () => { if (running && mode === "form") { const n = parts.length; resize(); MAX = n; to(shape); } });
  return { start, to, explode };
})();

async function setCap(text) {
  const cap = $("#cap");
  cap.classList.add("out");
  await sleep(350);
  cap.textContent = "";
  cap.classList.remove("out");
  await typeText(cap, text, 55);
}

async function runIntro(ox, oy) {
  $("#intro").classList.remove("waiting");
  const lines = CONFIG.introLines;
  try {
    await document.fonts.load(`700 100px "Caveat"`, CONFIG.herName);
    await document.fonts.load(`400 100px "Ma Shan Zheng"`, CONFIG.introChinese);
  } catch (e) {}
  Morph.start(ox, oy);
  Morph.to("star");
  await sleep(500);
  setCap(lines[0]);
  await sleep(3000);
  Morph.to({ text: CONFIG.herName, font: `700 SIZEpx "Caveat", cursive`, scale: 1.35 });
  setCap(lines[1]);
  await sleep(3300);
  Morph.to({ text: CONFIG.introChinese, font: `400 SIZEpx "Ma Shan Zheng", "KaiTi", serif`, scale: 1.1 });
  setCap(lines[2]);
  await sleep(2200);
  $("#since").textContent = CONFIG.sinceText;
  $("#since").classList.add("show");
  await sleep(900);
  $("#enterBtn").classList.add("show");
}

$("#enterBtn").addEventListener("click", async (e) => {
  const x = e.clientX || innerWidth / 2, y = e.clientY || innerHeight / 2;
  $("#enterBtn").classList.remove("show");
  Morph.explode();
  burst(x, y, 26);
  ring(x, y, { size: 400, width: 4 });
  ring(x, y, { size: 800, color: "#6fa8ff", width: 3, delay: 150 });
  await sleep(500);
  heartRain(40);
  $("#intro").classList.add("gone");
  document.body.classList.remove("locked");
  document.body.classList.add("entered");
  window.scrollTo(0, 0);
  const main = $("#main");
  main.removeAttribute("aria-hidden");
  main.classList.add("show");
  if (!reduceMotion && main.animate) {
    const R = Math.hypot(innerWidth, innerHeight);
    main.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }],
      { duration: 1400, easing: "cubic-bezier(.6,0,.2,1)" });
  }
  trailOn = true;
  document.dispatchEvent(new CustomEvent("ella:enter"));
  setTimeout(() => achieve("enter", "Сюрприз открыт ✨"), 2200);
});

/* ================= 4. MAIN PAGE ================= */
$("#madeBy").textContent = `кое-что маленькое — от ${CONFIG.fromNameFrom} для`;
Array.from(CONFIG.herName).forEach((ch, i) => {
  const s = document.createElement("span");
  s.className = "ch"; s.textContent = ch; s.style.setProperty("--i", i);
  $("#heroName").appendChild(s);
});
$("#heroSub").textContent = CONFIG.heroSubtitle;
$("#qText").textContent = CONFIG.question;
$("#pianoBrand").textContent = `Пианино ${CONFIG.herName}`;
$("#envPaper").textContent = `для ${CONFIG.herName} ✨`;
splitLetters($("#footBig"), CONFIG.footer);
$("#footLine").textContent = `с заботой от ${CONFIG.fromNameFrom} · ${new Date().getFullYear()}`;
document.querySelectorAll("h2").forEach((h) => splitLetters(h, h.textContent, { colors: ["ff7ec0", "b48cff", "7fb2ff"] }));

/* twinkling sparkles in the hero */
for (let i = 0; i < 14; i++) {
  const s = document.createElement("span");
  s.className = "spark";
  s.textContent = "✦";
  s.style.cssText = `left:${rand(3, 95)}%;top:${rand(5, 92)}%;font-size:${rand(10, 22)}px;--t:${rand(2, 4)}s;--d:${rand(0, 3)}s`;
  $("#sparks").appendChild(s);
}

/* parallax: orchids drift with scroll + mouse */
const pars = [...document.querySelectorAll(".par")];
let parTick = false;
function parallax() {
  parTick = false;
  const mx = mouse.x > -1 ? mouse.x / innerWidth - 0.5 : 0, my = mouse.y > -1 ? mouse.y / innerHeight - 0.5 : 0;
  for (const el of pars) {
    const d = +el.dataset.d;
    el.style.transform = `translate(${mx * d * 50}px, ${scrollY * d * 0.5 + my * d * 50}px)`;
  }
  const max = document.documentElement.scrollHeight - innerHeight;
  $("#progress i").style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
}
const queueParallax = () => { if (!parTick) { parTick = true; requestAnimationFrame(parallax); } };
addEventListener("scroll", queueParallax, { passive: true });
addEventListener("pointermove", queueParallax, { passive: true });

/* tap empty space → ripple of love */
document.addEventListener("pointerdown", (e) => {
  if (!document.body.classList.contains("entered")) return;
  if (e.target.closest("button, input, .wk, .bk, .flip, .envelope, .modal, .crew, .q-box, .game, .coupon, #galaxy3d, .bouquet, .polaroid, .meter-box, #credits, .shelf, .poem, .dossier, .cheer, #sky, .hz-box, .sphere, .book-modal, .arc")) return;
  ring(e.clientX, e.clientY, { size: 130, width: 2, dur: 700 });
  burst(e.clientX, e.clientY, 6, ["✨", "⭐", "💫"]);
});

/* live counter (counts up from zero the first time you see it) */
let counting = true, countStarted = false;
const prev = {};
function diffParts() {
  let diff = Math.max(0, Date.now() - START.getTime());
  const d = Math.floor(diff / 864e5); diff -= d * 864e5;
  const h = Math.floor(diff / 36e5); diff -= h * 36e5;
  const m = Math.floor(diff / 6e4); diff -= m * 6e4;
  return { d, h, m, s: Math.floor(diff / 1e3) };
}
function setNum(id, val, bump) {
  const el = $(id);
  if (el.textContent === val) return;
  el.textContent = val;
  if (bump) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
}
function tick() {
  if (counting) return;
  const p = diffParts();
  setNum("#cD", p.d.toLocaleString("en-US"), true);
  setNum("#cH", pad(p.h), true);
  setNum("#cM", pad(p.m), true);
  setNum("#cS", pad(p.s), true);
}
function countUp() {
  const target = diffParts(), t0 = performance.now(), dur = 2400;
  (function step(now) {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    $("#cD").textContent = Math.round(target.d * e).toLocaleString("en-US");
    $("#cH").textContent = pad(Math.round(target.h * e));
    $("#cM").textContent = pad(Math.round(target.m * e));
    $("#cS").textContent = pad(Math.round(target.s * e));
    if (k < 1) requestAnimationFrame(step);
    else { counting = false; tick(); const [x, y] = center($("#cD")); burst(x, y, 10, ["✨", "💗"]); }
  })(t0);
}
setInterval(tick, 1000);

/* the crew does a flip when tapped */
document.querySelectorAll("#crew span").forEach((s) => s.addEventListener("click", (e) => {
  s.classList.remove("spin"); void s.offsetWidth; s.classList.add("spin");
  setTimeout(() => s.classList.remove("spin"), 800);
  burst(e.clientX, e.clientY, 8, [s.textContent, "💗", "✨"]);
}));

/* flip cards with 3D tilt + shine */
const cardsEl = $("#cards");
const flippedCards = new Set();
(cardsEl ? CONFIG.cards || [] : []).forEach((card, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "flip reveal";
  b.dataset.a = "deal";
  b.style.setProperty("--rz", (i % 2 ? 8 : -8) + "deg");
  b.style.transitionDelay = (i % 4) * 0.12 + "s";
  b.setAttribute("aria-label", card.title);
  b.innerHTML = `
    <div class="tilt">
      <div class="flip-inner">
        <div class="face front" style="--bgc:${card.bg}">
          <div class="ico">${card.icon}</div>
          <div><h3></h3><div class="tap" style="margin-top:10px">tap to open ↻</div></div>
        </div>
        <div class="face back"><p></p><div class="sig">— ${CONFIG.fromName}</div></div>
      </div>
    </div>`;
  b.querySelector("h3").textContent = card.title;
  b.querySelector(".back p").textContent = card.text;
  const tilt = b.querySelector(".tilt");
  b.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || reduceMotion) return;
    const r = b.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    tilt.style.transform = `rotateX(${(0.5 - py) * 16}deg) rotateY(${(px - 0.5) * 18}deg) scale(1.03)`;
    b.style.setProperty("--gx", px * 100 + "%");
    b.style.setProperty("--gy", py * 100 + "%");
  });
  b.addEventListener("pointerleave", () => { tilt.style.transform = ""; });
  b.addEventListener("click", (e) => {
    const opening = !b.classList.contains("flipped");
    b.classList.toggle("flipped");
    if (opening) {
      const [x, y] = center(b);
      burst(e.clientX || x, e.clientY || y, 14, [card.icon, "💗", "✨", "💕"]);
      ring(x, y, { size: 380, width: 3, dur: 800 });
      flippedCards.add(i);
      achieve("card1", "Opened your first letter 💌");
      if (flippedCards.size === CONFIG.cards.length) { achieve("allcards", "Collected every letter 🌸"); Fireworks.show(3); }
    }
  });
  cardsEl.appendChild(b);
});

/* traits */
($("#traits") ? CONFIG.traits || [] : []).forEach((t, i) => {
  const d = document.createElement("div");
  d.className = "trait reveal";
  d.dataset.a = "pop";
  d.style.transitionDelay = i * 0.12 + "s";
  d.innerHTML = `<div class="inner"><span class="e"></span><h4></h4><p></p></div>`;
  d.querySelector(".e").textContent = t.icon;
  d.querySelector("h4").textContent = t.name;
  d.querySelector("p").textContent = t.text;
  d.addEventListener("click", (e) => burst(e.clientX, e.clientY, 8, [t.icon, "✨", "⭐"]));
  $("#traits").appendChild(d);
});

/* ================= piano + live sound visualizer ================= */
const WHITE = [["C4", 261.63, "a"], ["D4", 293.66, "s"], ["E4", 329.63, "d"], ["F4", 349.23, "f"], ["G4", 392.0, "g"],
               ["A4", 440.0, "h"], ["B4", 493.88, "j"], ["C5", 523.25, "k"], ["D5", 587.33, "l"], ["E5", 659.25, ";"]];
const BLACK = [["C#4", 277.18, "w", 0], ["D#4", 311.13, "e", 1], ["F#4", 369.99, "t", 3], ["G#4", 415.3, "y", 4],
               ["A#4", 466.16, "u", 5], ["C#5", 554.37, "o", 7], ["D#5", 622.25, "p", 8]];
const keysEl = $("#keys"), keyMap = {}, noteMap = {};
let actx, master, analyser, freqData;

function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.9;
    analyser = actx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    master.connect(analyser); analyser.connect(actx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}
function sound(freq) {
  const ctx = audio(), t = ctx.currentTime, g = ctx.createGain();
  g.connect(master);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.26, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  [[1, "triangle", 1], [2, "sine", 0.32], [3, "sine", 0.1]].forEach(([mult, type, vol]) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = type; o.frequency.value = freq * mult; og.gain.value = vol;
    o.connect(og).connect(g); o.start(t); o.stop(t + 2);
  });
}
function press(el) {
  sound(+el.dataset.f);
  el.classList.add("down");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("down"), 200);
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + 14;
  fx(["♪", "♫", "✨", "♩", "⭐"][Math.floor(Math.random() * 5)], x, y, rand(20, 30),
    [{ o: 0, s: 0.5 }, { o: 1, s: 1, y: -40 }, { o: 0, s: 1.3, y: -150, x: rand(-40, 40), r: rand(-40, 40) }], 1500);
  ring(x, y, { size: 90, width: 2, dur: 600, color: "#ffffff" });
  achieve("piano", "Дуэт открыт 🎹");
}
WHITE.forEach(([n, f, k]) => {
  const el = document.createElement("div");
  el.className = "wk"; el.dataset.f = f;
  el.innerHTML = `<small>${n.replace(/\d/, "")}</small>`;
  keysEl.appendChild(el); keyMap[k] = el; noteMap[n] = el;
});
BLACK.forEach(([n, f, k, after]) => {
  const el = document.createElement("div");
  el.className = "bk"; el.dataset.f = f;
  el.style.left = `calc(${(after + 1) * 10}% + ${(1.6 - 0.4 * after).toFixed(1)}px)`;
  keysEl.appendChild(el); keyMap[k] = el; noteMap[n] = el;
});
keysEl.addEventListener("pointerdown", (e) => {
  const k = e.target.closest(".wk, .bk");
  if (k) { e.preventDefault(); press(k); }
});
addEventListener("keydown", (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || !document.body.classList.contains("entered")) return;
  if ($("#modal").classList.contains("show")) return;
  const k = keyMap[e.key.toLowerCase()];
  if (k) press(k);
});

/* sound bars above the keys */
(function visualizer() {
  const cv = $("#viz"), c = cv.getContext("2d");
  let visible = false;
  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
    if (visible) requestAnimationFrame(draw);
  }).observe(cv);
  function draw(t) {
    if (!visible) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = W * dpr; cv.height = H * dpr; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (analyser) analyser.getByteFrequencyData(freqData);
    const bars = W < 500 ? 28 : 44, gap = 3, bw = (W - gap * (bars - 1)) / bars, time = t / 1000;
    for (let i = 0; i < bars; i++) {
      const mid = Math.abs(i - (bars - 1) / 2) / (bars / 2);
      const bin = Math.floor(2 + mid * 44);
      const v = analyser ? freqData[bin] / 255 : 0;
      const idle = 0.08 + 0.06 * Math.sin(time * 2.4 + i * 0.45);
      const h = Math.max(4, Math.max(v, idle) * H);
      c.fillStyle = `rgba(255,255,255,${0.45 + Math.max(v, idle) * 0.55})`;
      const x = i * (bw + gap), y = (H - h) / 2;
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, bw, h, Math.min(bw / 2, 4)); else c.rect(x, y, bw, h);
      c.fill();
    }
    requestAnimationFrame(draw);
  }
})();

/* a tiny original melody */
const MELODY = [["E4", .5], ["G4", .5], ["C5", 1], ["B4", .5], ["A4", .5], ["G4", 1], ["E4", .5], ["F4", .5], ["G4", .5], ["A4", .5], ["G4", 1.5],
                [null, .5], ["A4", .5], ["B4", .5], ["C5", .5], ["D5", .5], ["E5", 1], ["D5", .5], ["C5", .5], ["B4", .5], ["D5", .5], ["C5", 2]];
let playing = false;
$("#melodyBtn").addEventListener("click", async () => {
  if (playing) return;
  playing = true;
  $("#melodyBtn").textContent = "♪ играет…";
  for (const [n, beats] of MELODY) {
    if (n) press(noteMap[n]);
    await sleep(beats * 380);
  }
  $("#melodyBtn").textContent = "▶ Аве Мария";
  playing = false;
  const [x, y] = center($("#piano"));
  burst(x, y - 60, 16);
});

/* ================= envelope + letter ================= */
const envelope = $("#envelope"), modal = $("#modal"), letterBody = $("#letterBody");
function buildLetter() {
  letterBody.innerHTML = "";
  CONFIG.letter.forEach((line, i) => {
    const p = document.createElement("p");
    if (i === 0) p.className = "hi";
    p.textContent = line;
    letterBody.appendChild(p);
  });
  const s = document.createElement("p");
  s.className = "sign";
  s.textContent = CONFIG.signOff;
  letterBody.appendChild(s);
}
async function openLetter() {
  buildLetter();
  modal.classList.add("show");
  modal.removeAttribute("aria-hidden");
  for (const p of letterBody.querySelectorAll("p")) { await sleep(reduceMotion ? 0 : 700); p.classList.add("in"); }
  achieve("letter", "Прочитала секретное письмо 💌");
}
envelope.addEventListener("click", async () => {
  if (!envelope.classList.contains("open")) {
    envelope.classList.add("open");
    $("#envCap").textContent = "нажми ещё раз, чтобы прочитать ✨";
    const [x, y] = center(envelope);
    burst(x, y, 22);
    ring(x, y, { size: 420, width: 3 });
    await sleep(1300);
    heartRain(30);
  }
  openLetter();
});
function closeLetter() { modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true"); }
$("#closeLetter").addEventListener("click", closeLetter);
modal.addEventListener("click", (e) => { if (e.target === modal) closeLetter(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closeLetter(); });

/* ================= the question (the "No" button runs away) ================= */
const qBox = $("#qBox"), noBtn = $("#noBtn"), yesBtn = $("#yesBtn");
const noTexts = ["Нет", "неа 😝", "попробуй ещё", "не поймаешь", "жми «да» ✨", "хорошая попытка 🙈"];
let dodges = 0, saidYes = false;
function dodge(e) {
  if (e) e.preventDefault();
  if (saidYes) return;
  const box = qBox.getBoundingClientRect();
  noBtn.classList.add("run");
  const bw = noBtn.offsetWidth, bh = noBtn.offsetHeight;
  noBtn.style.left = 12 + Math.random() * Math.max(0, box.width - bw - 24) + "px";
  noBtn.style.top = 12 + Math.random() * Math.max(0, box.height - bh - 24) + "px";
  noBtn.style.transform = `rotate(${rand(-15, 15)}deg)`;
  noBtn.textContent = noTexts[++dodges % noTexts.length];
  yesBtn.style.transform = `scale(${Math.min(1 + dodges * 0.1, 1.7)})`;
}
noBtn.addEventListener("pointerenter", dodge);
noBtn.addEventListener("pointerdown", dodge);
noBtn.addEventListener("click", dodge);
yesBtn.addEventListener("click", (e) => {
  burst(e.clientX, e.clientY, 34);
  ring(e.clientX, e.clientY, { size: 500, width: 4 });
  ring(e.clientX, e.clientY, { size: 900, width: 3, color: "#8f7bff", delay: 150 });
  flash(0.4, 600);
  Fireworks.show(9);
  heartRain(70);
  if (!saidYes) splitLetters($("#yay"), CONFIG.yesAnswer, { wrapWords: true });
  if (!saidYes) document.dispatchEvent(new CustomEvent("ella:yes"));
  saidYes = true;
  noBtn.style.display = "none";
  yesBtn.style.transform = "";
  achieve("yes", "Настроение поднято ✨");
});

/* ================= scroll reveal ================= */
const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add("in");
    io.unobserve(en.target);
    if (en.target.classList.contains("count-box") && !countStarted) { countStarted = true; countUp(); }
  }
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
