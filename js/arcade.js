/* =====================================================================
   Arcade: Piano Hero (rhythm game on the real piano), a memory match
   game, and a spin-the-wheel date picker.
   ===================================================================== */

/* ---------- 🎹 Piano Hero: notes fall onto the keys, play them on time ---------- */
const Hero = (() => {
  const piano = $("#piano"), lane = $("#lane"), btn = $("#heroBtn"), hud = $("#heroHud");
  if (!lane) return { active: false };
  const c = lane.getContext("2d");
  const TRAVEL = 1.9, BEAT = 0.42, PERFECT = 0.1, GOOD = 0.25;
  let active = false, notes = [], t0 = 0, score = 0, combo = 0, maxCombo = 0, perfects = 0, musicWas = false, judge = null;

  function chart() {
    const out = [];
    let t = 2.4;
    for (let rep = 0; rep < 2; rep++) {
      for (const [n, beats] of MELODY) { if (n) out.push({ n, t, state: "live" }); t += beats * BEAT; }
      t += 0.8;
    }
    return out;
  }
  function setHud(html) { hud.innerHTML = html; }
  function showJudge(text, cls) {
    const el = document.createElement("div");
    el.className = "judge " + cls; el.textContent = text;
    hud.querySelectorAll(".judge").forEach((j) => j.remove());
    hud.appendChild(el);
  }
  function hudStats() {
    let s = hud.querySelector(".h-stats");
    if (!s) { s = document.createElement("div"); s.className = "h-stats"; hud.prepend(s); }
    s.textContent = `${score.toLocaleString("ru-RU")} очков${combo > 2 ? ` · 🔥 ${combo}` : ""}`;
  }

  function start() {
    if (active) return stop(true);
    active = true;
    notes = chart(); score = combo = maxCombo = perfects = 0;
    piano.classList.add("ph-on");
    btn.textContent = "✕ стоп";
    $("#melodyBtn").disabled = true;
    musicWas = typeof Music !== "undefined" && Music.on;
    if (musicWas) Music.stop();
    setHud(""); hudStats();
    showJudge("ПРИГОТОВЬСЯ", "ready");
    setTimeout(() => piano.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    t0 = performance.now() / 1000;
    requestAnimationFrame(frame);
  }
  function stop(cancelled) {
    active = false;
    piano.classList.remove("ph-on");
    btn.textContent = "🎮 Piano Hero";
    $("#melodyBtn").disabled = false;
    if (musicWas) { Music.start(); musicWas = false; }
    if (cancelled) setHud("");
  }
  function finish() {
    const total = notes.length, hit = notes.filter((n) => n.state === "hit").length;
    const acc = Math.round((hit / total) * 100);
    const rank = acc >= 95 && perfects / total > 0.6 ? "S" : acc >= 85 ? "A" : acc >= 65 ? "B" : "C";
    stop(false);
    setHud(`<div class="h-result"><div class="h-rank r-${rank}">${rank}</div>
      <div>${score.toLocaleString("ru-RU")} очков · попаданий ${acc}% · макс. серия ${maxCombo}</div>
      <div class="h-note">${rank === "S" ? "безупречно, пианистка 👑" : rank === "A" ? "очень круто!! 🎹" : rank === "B" ? "неплохо! ещё разок? ✨" : "разминка пройдена 😄 ещё раз!"}</div></div>`);
    const [x, y] = center(piano);
    burst(x, y - 60, 24, ["🎹", "♪", "⭐", "✨"]);
    achieve("hero", "Сыграла в Piano Hero 🎮");
    if (rank === "S" || rank === "A") { achieve("heroS", "Легенда пианино 👑"); Fireworks.show(5); }
  }
  function hit(el) {
    if (!active) return;
    const now = performance.now() / 1000 - t0;
    let best = null, bestD = 9;
    for (const n of notes) {
      if (n.state !== "live" || noteMap[n.n] !== el) continue;
      const d = Math.abs(n.t - now);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best || bestD > GOOD) return;
    best.state = "hit";
    combo++; maxCombo = Math.max(maxCombo, combo);
    const r = el.getBoundingClientRect();
    if (bestD <= PERFECT) {
      perfects++;
      score += Math.round(100 * (1 + combo / 10));
      showJudge("ИДЕАЛЬНО!", "perfect");
      burst(r.left + r.width / 2, r.top, 6, ["✨", "⭐"]);
    } else {
      score += Math.round(50 * (1 + combo / 10));
      showJudge("ХОРОШО", "good");
    }
    ring(r.left + r.width / 2, r.top, { size: 120, width: 3, color: bestD <= PERFECT ? "#ffffff" : "#ffb3d1", dur: 500 });
    hudStats();
  }
  function frame() {
    if (!active) return;
    const now = performance.now() / 1000 - t0;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = lane.clientWidth, H = lane.clientHeight;
    if (lane.width !== Math.round(W * dpr) || lane.height !== Math.round(H * dpr)) { lane.width = Math.round(W * dpr); lane.height = Math.round(H * dpr); }
    if (!W || !H) { requestAnimationFrame(frame); return; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const lr = lane.getBoundingClientRect();
    // hit line
    const g = c.createLinearGradient(0, H - 10, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.9)");
    c.fillStyle = g; c.fillRect(0, H - 10, W, 10);
    for (const n of notes) {
      if (n.state === "live" && now - n.t > GOOD) { n.state = "miss"; combo = 0; showJudge("МИМО", "miss"); hudStats(); }
      if (n.state !== "live") continue;
      const y = H - ((n.t - now) / TRAVEL) * H;
      if (y < -30) continue;
      const k = noteMap[n.n].getBoundingClientRect();
      const x = k.left - lr.left + k.width / 2, w = Math.max(14, k.width * 0.72);
      const black = n.n.includes("#");
      c.fillStyle = black ? "#6f9bff" : "#ffffff";
      c.shadowColor = black ? "#8f7bff" : "#ff7aac"; c.shadowBlur = 14;
      c.beginPath();
      if (c.roundRect) c.roundRect(x - w / 2, y - 22, w, 22, 11); else c.rect(x - w / 2, y - 22, w, 22);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = black ? "#fff" : "#f0528f";
      c.font = "14px serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("★", x, y - 11);
    }
    if (notes.every((n) => n.state !== "live") && now > notes[notes.length - 1].t + 0.8) return finish();
    requestAnimationFrame(frame);
  }
  btn.addEventListener("click", start);
  return { get active() { return active; }, hit };
})();
{
  // every key press also counts for Piano Hero
  const originalPress = press;
  press = (el) => { originalPress(el); if (Hero.active) Hero.hit(el); };
}

/* ---------- 🧠 memory match ---------- */
(function memory() {
  const grid = $("#memory");
  if (!grid) return;
  const ICONS = ["📚", "⭐", "🎹", "🀄", "🌙", "☕", "🍫", "🪐"];
  const movesEl = $("#memMoves"), timeEl = $("#memTime"), msg = $("#memMsg");
  let first = null, lock = false, moves = 0, matched = 0, tStart = 0, timer = null, best = 0;
  try { best = +localStorage.getItem("maryam-mem-best") || 0; } catch (e) {}

  function deal() {
    grid.innerHTML = "";
    first = null; lock = false; moves = 0; matched = 0; tStart = 0;
    clearInterval(timer);
    movesEl.textContent = "0"; timeEl.textContent = "0.0";
    msg.textContent = best ? `рекорд: ${best.toFixed(1)} с` : "найди все 8 пар";
    const deck = [...ICONS, ...ICONS].sort(() => Math.random() - 0.5);
    deck.forEach((ic, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "mcard"; b.dataset.ic = ic;
      b.style.animationDelay = i * 0.04 + "s";
      b.innerHTML = `<span class="mc-in"><span class="mc-face mc-back">✦</span><span class="mc-face mc-front"></span></span>`;
      b.querySelector(".mc-front").textContent = ic;
      b.setAttribute("aria-label", "закрытая карта");
      b.addEventListener("click", () => flip(b));
      grid.appendChild(b);
    });
  }
  function flip(b) {
    if (lock || b === first || b.classList.contains("up")) return;
    if (!tStart) {
      tStart = performance.now();
      timer = setInterval(() => { timeEl.textContent = ((performance.now() - tStart) / 1000).toFixed(1); }, 100);
    }
    b.classList.add("up");
    b.setAttribute("aria-label", b.dataset.ic);
    if (!first) { first = b; return; }
    moves++; movesEl.textContent = moves;
    const a = first; first = null;
    if (a.dataset.ic === b.dataset.ic) {
      a.classList.add("match"); b.classList.add("match");
      matched++;
      const [x, y] = center(b);
      burst(x, y, 8, [b.dataset.ic, "⭐", "✨"]);
      if (typeof sound === "function") sound(659 + matched * 40);
      if (matched === ICONS.length) win();
    } else {
      lock = true;
      setTimeout(() => {
        a.classList.add("nope"); b.classList.add("nope");
        setTimeout(() => { a.classList.remove("up", "nope"); b.classList.remove("up", "nope"); lock = false; }, 450);
      }, 650);
    }
  }
  function win() {
    clearInterval(timer);
    const secs = (performance.now() - tStart) / 1000;
    const isBest = !best || secs < best;
    if (isBest) { best = secs; try { localStorage.setItem("maryam-mem-best", secs.toFixed(2)); } catch (e) {} }
    msg.textContent = `${secs.toFixed(1)} с за ${moves} ходов${isBest ? " — новый рекорд! ✨" : ""} · отличная память ✨`;
    const [x, y] = center(grid);
    burst(x, y, 30);
    Fireworks.show(4);
    achieve("memory", "Отличная память 🧠");
    if (moves <= 12) achieve("memory12", "Мастер памяти — 12 ходов или меньше 🏆");
  }
  $("#memReset").addEventListener("click", deal);
  deal();
})();

/* ---------- 🎡 spin-the-wheel date picker ---------- */
(function dateWheel() {
  const cv = $("#wheel");
  if (!cv) return;
  const c = cv.getContext("2d"), btn = $("#spinBtn"), out = $("#wheelResult"), pointer = $("#wheelPointer");
  const ideas = CONFIG.dateIdeas || [];
  const N = ideas.length, SEG = (Math.PI * 2) / N;
  const COLORS = ["#ff9ccf", "#e8dcff", "#9d7bff", "#cfe3ff", "#ff7eb6", "#f3e8ff", "#6f8dff", "#ffc6e6"];
  let rot = 0, vel = 0, spinning = false, lastSeg = -1, size = 0;

  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), S = cv.clientWidth;
    if (size !== S) { size = S; cv.width = S * dpr; cv.height = S * dpr; }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = S / 2;
    c.clearRect(0, 0, S, S);
    c.save(); c.translate(r, r); c.rotate(rot);
    for (let i = 0; i < N; i++) {
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r - 6, i * SEG, (i + 1) * SEG); c.closePath();
      c.fillStyle = COLORS[i % COLORS.length]; c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 3; c.stroke();
      c.save();
      c.rotate(i * SEG + SEG / 2);
      c.textAlign = "right"; c.textBaseline = "middle";
      const dark = [2, 4, 6].includes(i % COLORS.length);
      c.fillStyle = dark ? "#fff" : "#2b2252";
      const fs = Math.max(10, Math.min(15, S / 26));
      c.font = `700 ${fs}px Nunito, sans-serif`;
      let label = ideas[i];
      while (c.measureText(label).width > r * 0.68 && label.length > 4) label = label.slice(0, -2) + "…";
      c.fillText(label, r - 18, 0);
      c.restore();
    }
    c.restore();
    c.beginPath(); c.arc(r, r, r - 3, 0, Math.PI * 2); c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 6; c.stroke();
    for (let i = 0; i < 24; i++) {     // little marquee lights around the edge
      const a = (i / 24) * Math.PI * 2;
      const on = spinning ? (Math.floor(performance.now() / 90) + i) % 2 : i % 2;
      c.beginPath(); c.arc(r + Math.cos(a) * (r - 3), r + Math.sin(a) * (r - 3), 3.2, 0, 6.28);
      c.fillStyle = on ? "#fff8b0" : "#ffffff"; c.fill();
    }
  }
  const segAtPointer = () => {
    const a = ((-Math.PI / 2 - rot) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
    return Math.floor(a / SEG);
  };
  function spin(v) {
    if (spinning) return;
    spinning = true; vel = v ?? rand(15, 22);
    out.classList.remove("show");
    btn.disabled = true;
    let last = performance.now();
    (function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      rot += vel * dt;
      vel -= (vel * 0.55 + 0.7) * dt;
      const s = segAtPointer();
      if (s !== lastSeg) {
        lastSeg = s;
        pointer.classList.remove("tick"); void pointer.offsetWidth; pointer.classList.add("tick");
        try { SFX.pop(); } catch (e) {}
      }
      draw();
      if (vel > 0.05) requestAnimationFrame(step);
      else land();
    })(last);
  }
  function land() {
    spinning = false; btn.disabled = false;
    draw();
    const idea = ideas[segAtPointer()];
    out.innerHTML = "";
    const small = document.createElement("small"); small.textContent = "ПЛАН НА ВСТРЕЧУ";
    const b = document.createElement("b"); b.textContent = idea;
    const p = document.createElement("span"); p.textContent = `сделай скрин и покажи ${CONFIG.fromNameTo} 📸`;
    out.append(small, b, p);
    out.classList.add("show");
    const [x, y] = center(cv);
    burst(x, y, 24);
    ring(x, y, { size: 420, width: 4 });
    achieve("wheel", "План на встречу готов 🎡");
  }
  btn.addEventListener("click", () => spin());
  // flick the wheel with a finger / mouse
  let dragA = null, dragT = 0, flick = 0;
  const angleOf = (e) => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  cv.addEventListener("pointerdown", (e) => { if (spinning) return; dragA = angleOf(e); dragT = performance.now(); flick = 0; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (dragA === null) return;
    const a = angleOf(e), now = performance.now();
    let d = a - dragA; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    rot += d; flick = d / Math.max(0.008, (now - dragT) / 1000);
    dragA = a; dragT = now; draw();
  });
  cv.addEventListener("pointerup", () => {
    if (dragA === null) return;
    dragA = null;
    if (Math.abs(flick) > 3) spin(Math.min(30, Math.abs(flick) * 1.2));
  });
  new IntersectionObserver((en) => { if (en[0].isIntersecting) draw(); }).observe(cv);
  addEventListener("resize", () => { size = 0; draw(); });
})();
