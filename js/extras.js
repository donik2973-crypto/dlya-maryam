/* =====================================================================
   Extras: phone vibration, phone-tilt parallax, scrambled-text titles,
   scratch-off love coupons, the love meter, the orchid bouquet,
   draggable photos and the end credits.
   ===================================================================== */

/* ---------- phone vibration (Android phones) ---------- */
function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}
document.addEventListener("ella:unlock", () => buzz([20, 40, 60]));
document.addEventListener("ella:wrong", () => buzz([50, 40, 50]));
document.addEventListener("ella:yes", () => buzz([30, 50, 30, 50, 160]));

/* ---------- tilt the phone → the flowers move ---------- */
(function gyro() {
  if (finePointer) return;
  const listen = () => addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    mouse.x = innerWidth * (0.5 + Math.max(-30, Math.min(30, e.gamma)) / 60);
    mouse.y = innerHeight * (0.5 + Math.max(-30, Math.min(30, e.beta - 45)) / 60);
    if (typeof queueParallax === "function") queueParallax();
  });
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    // iPhone asks for permission — do it at the moment she unlocks (that counts as a tap)
    document.addEventListener("ella:unlock", () => { D.requestPermission().then((r) => { if (r === "granted") listen(); }).catch(() => {}); });
  } else if (D) listen();
})();

/* ---------- small titles "decode" themselves like a hacker screen ---------- */
(function scrambleKickers() {
  const glyphs = "✦★☆✧*#%&@+=?";
  function scramble(el) {
    const final = el.textContent;
    let frame = 0;
    const total = 22;
    (function step() {
      const reveal = Math.floor((frame / total) * final.length);
      el.textContent = Array.from(final).map((ch, i) =>
        i < reveal || ch === " " ? ch : glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
      if (frame++ < total) setTimeout(step, 40); else el.textContent = final;
    })();
  }
  const obs = new IntersectionObserver((en) => {
    for (const e of en) if (e.isIntersecting) { obs.unobserve(e.target); setTimeout(() => scramble(e.target), 150); }
  }, { threshold: 0.6 });
  document.querySelectorAll(".kicker").forEach((k) => obs.observe(k));
})();

/* ---------- scratch-off love coupons ---------- */
(function coupons() {
  const wrap = $("#coupons");
  let redeemed = 0;
  CONFIG.coupons.forEach((cp, i) => {
    const el = document.createElement("div");
    el.className = "coupon reveal";
    el.dataset.a = "pop";
    el.style.transitionDelay = i * 0.12 + "s";
    el.innerHTML = `
      <div class="c-inner">
        <small>КУПОН ДРУЖБЫ №${i + 1}</small>
        <span class="c-ico"></span>
        <h4></h4>
        <span class="c-valid">бессрочно · подпись: ${CONFIG.fromName}</span>
      </div>
      <canvas class="scratch"></canvas>`;
    el.querySelector(".c-ico").textContent = cp.icon;
    el.querySelector("h4").textContent = cp.title;
    wrap.appendChild(el);
    io.observe(el);

    const cv = el.querySelector("canvas"), c = cv.getContext("2d");
    let done = false, drawn = false, down = false, lastP = null, moves = 0;
    function paint() {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = w * dpr; cv.height = h * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#ff9ccf"); g.addColorStop(0.5, "#a98bff"); g.addColorStop(1, "#7fb2ff");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 140; k++) {               // glitter
        c.fillStyle = `rgba(255,255,255,${rand(0.15, 0.7)})`;
        c.beginPath(); c.arc(rand(0, w), rand(0, h), rand(0.5, 2), 0, 6.28); c.fill();
      }
      c.fillStyle = "rgba(255,255,255,.95)";
      c.font = "700 20px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText("сотри меня ✨", w / 2, h / 2 - 6);
      c.font = "600 13px Nunito, sans-serif";
      c.fillText("✦ ✦ ✦", w / 2, h / 2 + 20);
      drawn = true;
    }
    new IntersectionObserver((en, o) => { if (en[0].isIntersecting && !drawn) { paint(); o.disconnect(); } }).observe(el);
    addEventListener("resize", () => { if (!done && drawn) paint(); });

    function scratchAt(e) {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      c.globalCompositeOperation = "destination-out";
      c.lineWidth = 38; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath();
      if (lastP) c.moveTo(lastP[0], lastP[1]); else c.moveTo(x - 0.1, y);
      c.lineTo(x, y); c.stroke();
      c.globalCompositeOperation = "source-over";
      lastP = [x, y];
      if (Math.random() < 0.3) fx(["✨", "💗", "·"][Math.floor(Math.random() * 3)], e.clientX, e.clientY, rand(10, 16),
        [{ o: 1, s: 1 }, { o: 0, s: 0.4, y: rand(20, 50), x: rand(-20, 20) }], 700);
      if (++moves % 8 === 0) check();
    }
    function check() {
      const d = c.getImageData(0, 0, cv.width, cv.height).data;
      let clear = 0, total = 0;
      for (let k = 3; k < d.length; k += 4 * 24) { total++; if (d[k] < 100) clear++; }
      if (clear / total > 0.5) reveal();
    }
    function reveal() {
      if (done) return;
      done = true;
      cv.classList.add("gone");
      el.classList.add("won");
      const [x, y] = center(el);
      burst(x, y, 20, [cp.icon, "⭐", "✨", "🎟️"]);
      ring(x, y, { size: 320, width: 3 });
      buzz(30);
      redeemed++;
      achieve("coupon", "Купон получен 🎟️");
      if (redeemed === CONFIG.coupons.length) achieve("coupons", "Все купоны собраны 💝");
    }
    cv.addEventListener("pointerdown", (e) => { if (done) return; down = true; lastP = null; cv.setPointerCapture(e.pointerId); scratchAt(e); });
    cv.addEventListener("pointermove", (e) => { if (down && !done) scratchAt(e); });
    cv.addEventListener("pointerup", () => { down = false; if (!done) check(); });
  });
})();

/* ---------- the love meter (it breaks) ---------- */
(function loveMeter() {
  const btn = $("#meterBtn"), num = $("#meterNum"), fill = $("#meterFill"), cap = $("#meterCap"), box = $("#meterBox");
  let busy = false;
  const setNum = (t) => { num.textContent = t; num.dataset.text = t; };
  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    box.classList.remove("broken", "glitch");
    num.classList.remove("glitch", "inf");
    cap.textContent = "измеряем…";
    const t0 = performance.now();
    await new Promise((done) => {
      (function step(now) {
        const k = Math.min(1, (now - t0) / 3400);
        let v;
        if (k < 0.45) v = (k / 0.45) * 100;                         // 0 → 100 %
        else v = 100 + Math.pow((k - 0.45) / 0.55, 3) * 99899;        // then it goes crazy
        setNum(Math.floor(v).toLocaleString("ru-RU") + "%");
        fill.style.width = Math.min(100, v) + "%";
        fill.style.filter = `hue-rotate(${Math.min(v, 2000) / 6}deg)`;
        box.style.transform = k > 0.45 ? `translate(${rand(-1, 1) * k * 7}px, ${rand(-1, 1) * k * 7}px) rotate(${rand(-1, 1) * k}deg)` : "";
        if (k > 0.5) cap.textContent = k > 0.8 ? "ОНО НЕ ОСТАНАВЛИВАЕТСЯ" : "погоди… что-то не так…";
        if (k < 1) requestAnimationFrame(step); else done();
      })(t0);
    });
    box.style.transform = "";
    setNum("ОШИБКА: СЛИШКОМ ХОРОШИЙ ДРУГ");
    num.classList.add("glitch");
    box.classList.add("glitch");
    flash(0.5, 500);
    const [x, y] = center(box);
    ring(x, y, { size: 500, width: 4, color: "#ff3d7f" });
    buzz([60, 40, 60, 40, 120]);
    await sleep(1700);
    num.classList.remove("glitch");
    box.classList.remove("glitch");
    box.classList.add("broken");
    setNum("∞");
    num.classList.add("inf");
    cap.textContent = "шкала сломалась. ответ: бесконечно";
    achieve("meter", "Сломала шкалу");
    btn.textContent = "ещё раз";
    btn.disabled = false;
    busy = false;
  });
})();

/* ---------- bouquet: tap a flower ---------- */
document.querySelectorAll(".bloom").forEach((b) => {
  b.addEventListener("click", (e) => {
    b.classList.remove("twirl"); void b.getBoundingClientRect(); b.classList.add("twirl");
    burst(e.clientX, e.clientY, 12, ["🌸", "💮", "✿", "💗"]);
    buzz(15);
    achieve("flower", "Picked a forever orchid 🌸");
  });
});

/* ---------- optional photos (polaroids you can drag) ---------- */
(function photos() {
  if (!CONFIG.photos || !CONFIG.photos.length) return;
  const sec = $("#photoSec"), wrap = $("#polaroids");
  sec.hidden = false;
  let z = 10;
  CONFIG.photos.forEach((ph, i) => {
    const el = document.createElement("figure");
    el.className = "polaroid reveal";
    el.dataset.a = "pop";
    const rot = rand(-12, 12);
    el.style.setProperty("--rot", rot + "deg");
    el.style.left = `${8 + ((i * 29) % 62)}%`;
    el.style.top = `${10 + ((i * 37) % 50)}%`;
    el.style.transitionDelay = i * 0.12 + "s";
    el.innerHTML = `<img alt="" draggable="false"><figcaption></figcaption>`;
    el.querySelector("img").src = ph.src;
    el.querySelector("figcaption").textContent = ph.caption || "";
    wrap.appendChild(el);
    io.observe(el);
    let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
    el.addEventListener("pointerdown", (e) => {
      drag = true; el.setPointerCapture(e.pointerId); el.style.zIndex = ++z; el.classList.add("lift");
      sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      el.style.left = ox + e.clientX - sx + "px";
      el.style.top = oy + e.clientY - sy + "px";
    });
    el.addEventListener("pointerup", () => { drag = false; el.classList.remove("lift"); });
  });
  const h = sec.querySelector("h2");
  if (h && !h.querySelector(".c")) splitLetters(h, h.textContent, { colors: ["d63a78", "ff6fa8", "c56bd6"] });
})();

/* ---------- end credits (like finishing a game) ---------- */
(function credits() {
  const btn = $("#creditsBtn"), box = $("#credits"), roll = $("#creditsRoll"), stars = $("#creditStars");
  for (let i = 0; i < 70; i++) {
    const s = document.createElement("i");
    s.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 100)}%;--t:${rand(1.5, 4)}s;--d:${rand(0, 3)}s;width:${rand(1, 3)}px;height:${rand(1, 3)}px`;
    stars.appendChild(s);
  }
  function build() {
    roll.innerHTML = "";
    const add = (cls, text) => { const d = document.createElement("div"); d.className = cls; d.textContent = text; roll.appendChild(d); };
    add("cr-big", "✨ ИГРА ПРОЙДЕНА ✨");
    add("cr-sub", `${CONFIG.herName} & ${CONFIG.fromName}`);
    for (const [role, name] of CONFIG.credits) { add("cr-role", role); add("cr-name", name); }
    add("cr-role", "Сделано на");
    add("cr-name", "HTML · CSS · JavaScript · GLSL · Python · JSON");
    add("cr-role", "Достижений получено");
    add("cr-name", `${unlocked.size} 🏆`);
    add("cr-end", "КОНЕЦ");
    add("cr-sub", "…или только начало ✨");
  }
  let timer;
  function open() {
    build();
    box.classList.add("show");
    box.setAttribute("aria-hidden", "false");
    roll.style.animation = "none"; void roll.offsetWidth; roll.style.animation = "";
    clearTimeout(timer);
    timer = setTimeout(() => { Fireworks.show(10); achieve("credits", "Досмотрела титры 🎬"); }, 17000);
  }
  function close() { box.classList.remove("show"); box.setAttribute("aria-hidden", "true"); clearTimeout(timer); }
  btn.addEventListener("click", open);
  $("#closeCredits").addEventListener("click", close);
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("ella:yes", () => setTimeout(() => btn.classList.add("show"), 2600));
})();
