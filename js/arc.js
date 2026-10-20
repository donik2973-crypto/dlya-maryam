/* =====================================================================
   Arc Warden ⚡ — Doniyor's favorite Dota hero.
   The hero is the official animated render from the Dota 2 website
   (loaded from Valve's servers), the ability icons are the real ones too.
   The effects around him are drawn by code:
     Q Flux           — lightning jumps from him to the stars
     W Magnetic Field — a glowing field on the ground
     E Spark Wraith   — a spark appears, waits, then flies off
     R Tempest Double — his purple copy appears next to him
   ===================================================================== */
(function arcWarden() {
  const stage = $("#arcStage");
  if (!stage) return;
  const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2";
  const ICONS = { "Flux": "arc_warden_flux", "Magnetic Field": "arc_warden_magnetic_field", "Spark Wraith": "arc_warden_spark_wraith", "Tempest Double": "arc_warden_tempest_double" };
  const bgCv = $("#arcBg"), fxCv = $("#arcFx"), bg = bgCv.getContext("2d"), fx2 = fxCv.getContext("2d");
  const hero = $("#arcHero"), dbl = $("#arcDouble");
  $("#arcIntro").textContent = CONFIG.arcIntro;

  /* ---------- the hero video (Safari needs the .mov version, others the .webm) ---------- */
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const src = `${CDN}/videos/dota_react/heroes/renders/arc_warden.${isSafari ? "mov" : "webm"}`;
  let loaded = false;
  function loadHero() {
    if (loaded) return;
    loaded = true;
    for (const box of [hero, dbl]) {
      const v = box.querySelector("video");
      v.src = src;
      v.addEventListener("loadeddata", () => box.classList.add("ready"), { once: true });
      v.addEventListener("error", () => { stage.classList.add("offline"); }, { once: true });
      v.play().catch(() => {});
    }
  }

  let W = 0, H = 0, visible = false, last = 0, doubled = false, field = 0, flash = 0;
  const flux = [], wraiths = [], parts = [];
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.8, r: rand(0.4, 1.6), ph: rand(0, 6.28) }));
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    for (const cv of [bgCv, fxCv]) { cv.width = W * dpr; cv.height = H * dpr; cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0); }
  }
  addEventListener("resize", resize);
  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
    if (visible) { loadHero(); resize(); last = performance.now(); requestAnimationFrame(draw); }
    for (const v of stage.querySelectorAll("video")) { if (visible) v.play().catch(() => {}); else v.pause(); }
  }, { rootMargin: "200px" }).observe(stage);

  /* where the hero (and his copy) stand on the stage */
  function spot(box) {
    const s = stage.getBoundingClientRect(), r = box.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, chest: r.top - s.top + r.height * 0.42, feet: r.top - s.top + r.height * 0.93, w: r.width };
  }

  function bolt(x1, y1, x2, y2, disp) {
    let pts = [[x1, y1], [x2, y2]];
    for (let k = 0; k < 5; k++) {
      const np = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        np.push([(ax + bx) / 2 + rand(-1, 1) * disp, (ay + by) / 2 + rand(-1, 1) * disp], [bx, by]);
      }
      pts = np; disp *= 0.55;
    }
    return pts;
  }
  function drawBolt(c, pts, color, width, alpha) {
    c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round";
    c.shadowColor = color; c.shadowBlur = 18;
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    c.lineWidth = width * 0.35; c.strokeStyle = "#fff"; c.stroke();
    c.shadowBlur = 0; c.globalAlpha = 1;
  }
  function pop(x, y, col, n = 18, speed = 200) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), v = rand(40, speed); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 1, col }); }
  }
  function zap(high) {
    try {
      const ctx = audio(), t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(high ? 1500 : 800, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.32);
    } catch (e) {}
  }

  /* ---------- abilities ---------- */
  const SKILLS = {
    "Flux"() {
      const casters = doubled ? [hero, dbl] : [hero];
      for (let i = 0; i < 7; i++) {
        const s = stars[Math.floor(Math.random() * stars.length)], from = spot(casters[i % casters.length]);
        flux.push({ x1: from.x, y1: from.chest, x2: s.x * W, y2: s.y * H, life: 1 });
      }
      flash = 0.6; zap(true);
    },
    "Magnetic Field"() { field = 1; zap(false); },
    "Spark Wraith"() {
      for (let i = 0; i < 3; i++) wraiths.push({ x: rand(0.12, 0.88) * W, y: rand(0.2, 0.7) * H, t: -i * 0.25, hold: 1.4, vx: 0, vy: 0 });
      try { SFX.twinkle(); } catch (e) {}
    },
    "Tempest Double"() {
      doubled = !doubled;
      stage.classList.toggle("doubled", doubled);
      const p = spot(hero);
      pop(p.x, p.chest, "200,160,255", 40, 260);
      flash = 1; zap(true); setTimeout(() => zap(false), 140);
      if (doubled) achieve("tempest", "Tempest Double ⚡");
    },
  };

  const tipIcon = $("#arcTipIcon"), tipName = $("#arcTipName"), tipKey = $("#arcTipKey"), tipText = $("#arcTipText"), tip = $("#arcTip");
  function showTip(sk) {
    tipIcon.src = `${CDN}/images/dota_react/abilities/${ICONS[sk.name] || ICONS.Flux}.png`;
    tipName.textContent = sk.name; tipKey.textContent = sk.key; tipText.textContent = sk.text;
    tip.classList.remove("show"); void tip.offsetWidth; tip.classList.add("show");
  }
  const used = new Set();
  CONFIG.arcSkills.forEach((sk, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "arc-skill";
    b.innerHTML = `<img alt="" draggable="false"><span class="ak"></span><span class="cd"></span>`;
    b.querySelector("img").src = `${CDN}/images/dota_react/abilities/${ICONS[sk.name] || ICONS.Flux}.png`;
    b.querySelector(".ak").textContent = sk.key;
    b.setAttribute("aria-label", sk.name);
    b.addEventListener("pointerenter", () => showTip(sk));
    let cooling = false;
    b.addEventListener("click", () => {
      showTip(sk);
      if (cooling) { b.classList.remove("nope"); void b.offsetWidth; b.classList.add("nope"); return; }
      (SKILLS[sk.name] || SKILLS.Flux)();
      b.classList.remove("cast"); void b.offsetWidth; b.classList.add("cast");
      used.add(sk.name);
      if (used.size === CONFIG.arcSkills.length) achieve("arc", "Прокастовала все умения Арка ⚡");
      cooling = true;
      const t0 = performance.now(), dur = sk.name === "Tempest Double" ? 2200 : 1200, cd = b.querySelector(".cd");
      (function tick(now) {
        const k = Math.min(1, (now - t0) / dur);
        cd.style.setProperty("--p", (1 - k) * 360 + "deg");
        if (k < 1) requestAnimationFrame(tick); else { cooling = false; b.classList.add("ready"); setTimeout(() => b.classList.remove("ready"), 400); }
      })(t0);
    });
    $("#arcSkills").appendChild(b);
    if (i === 0) showTip(sk);
  });

  /* ---------- drawing ---------- */
  function draw(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = now / 1000;
    field = Math.max(0, field - dt * 0.2);
    flash = Math.max(0, flash - dt * 2.4);
    const casters = doubled ? [hero, dbl] : [hero];
    const spots = casters.map(spot);

    // background layer: stars + magnetic field on the ground
    bg.clearRect(0, 0, W, H);
    for (const s of stars) {
      bg.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.4 + s.ph));
      bg.fillStyle = "#fff"; bg.beginPath(); bg.arc(s.x * W, s.y * H, s.r, 0, 6.28); bg.fill();
    }
    bg.globalAlpha = 1;
    for (const p of spots) {   // a soft glow under his feet
      const g = bg.createRadialGradient(p.x, p.feet, 0, p.x, p.feet, p.w * 0.45);
      g.addColorStop(0, "rgba(120,190,255,.35)"); g.addColorStop(1, "rgba(120,190,255,0)");
      bg.fillStyle = g; bg.beginPath(); bg.ellipse(p.x, p.feet, p.w * 0.45, p.w * 0.1, 0, 0, 6.28); bg.fill();
    }
    if (field > 0) {
      const fx = doubled ? (spots[0].x + spots[1].x) / 2 : spots[0].x, fy = spots[0].feet;
      const rx = Math.min(W * 0.42, doubled ? 260 : 190) * (0.9 + 0.1 * Math.min(1, (1 - field) * 8)), ry = rx * 0.24;
      const a = Math.min(1, field * 2.5);
      const g = bg.createRadialGradient(fx, fy, 0, fx, fy, rx);
      g.addColorStop(0, `rgba(255,214,120,${0.08 * a})`); g.addColorStop(0.8, `rgba(120,190,255,${0.22 * a})`); g.addColorStop(1, `rgba(200,235,255,${0.6 * a})`);
      bg.fillStyle = g; bg.beginPath(); bg.ellipse(fx, fy, rx, ry, 0, 0, 6.28); bg.fill();
      bg.strokeStyle = `rgba(210,240,255,${0.8 * a})`; bg.lineWidth = 2;
      bg.setLineDash([12, 7]); bg.lineDashOffset = -time * 40;
      bg.beginPath(); bg.ellipse(fx, fy, rx, ry, 0, 0, 6.28); bg.stroke(); bg.setLineDash([]);
      // the dome
      bg.strokeStyle = `rgba(160,210,255,${0.35 * a})`; bg.lineWidth = 1.5;
      bg.beginPath(); bg.ellipse(fx, fy, rx, rx * 0.95, 0, Math.PI, 0); bg.stroke();
      if (Math.random() < 0.5) parts.push({ x: fx + rand(-rx, rx) * 0.9, y: fy + rand(-ry, ry) * 0.6, vx: 0, vy: -rand(30, 70), life: 0.8, col: "200,230,255" });
    }

    // front layer: lightning, sparks, particles
    fx2.clearRect(0, 0, W, H);
    for (let i = flux.length - 1; i >= 0; i--) {
      const f = flux[i];
      f.life -= dt * 1.5;
      if (f.life <= 0) { flux.splice(i, 1); continue; }
      drawBolt(fx2, bolt(f.x1, f.y1, f.x2, f.y2, 34), "#7fd4ff", 2.4, f.life);
    }
    if (Math.random() < dt * 2.2) {   // little idle crackles around him
      const p = spots[Math.floor(Math.random() * spots.length)], a = rand(0, 6.28), r = p.w * rand(0.12, 0.22);
      flux.push({ x1: p.x + Math.cos(a) * r * 0.4, y1: p.chest + Math.sin(a) * r * 0.4, x2: p.x + Math.cos(a) * r * 1.6, y2: p.chest + Math.sin(a) * r * 1.6, life: 0.45 });
    }
    if (doubled && Math.random() < dt * 3) {   // the link between Arc and his double
      flux.push({ x1: spots[0].x, y1: spots[0].chest, x2: spots[1].x, y2: spots[1].chest, life: 0.35 });
    }
    for (let i = wraiths.length - 1; i >= 0; i--) {
      const w = wraiths[i];
      w.t += dt;
      if (w.t < 0) continue;
      if (w.t > w.hold) {
        if (!w.vx) { const a = rand(0, 6.28); w.vx = Math.cos(a) * 520; w.vy = Math.sin(a) * 520; zap(true); }
        w.x += w.vx * dt; w.y += w.vy * dt;
        parts.push({ x: w.x, y: w.y, vx: 0, vy: 0, life: 0.5, col: "190,150,255" });
        if (w.x < -20 || w.x > W + 20 || w.y < -20 || w.y > H + 20) { wraiths.splice(i, 1); continue; }
      }
      const s = Math.min(1, w.t * 3), yy = w.y + (w.vx ? 0 : Math.sin(time * 5 + i) * 4);
      const g = fx2.createRadialGradient(w.x, yy, 0, w.x, yy, 22 * s);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(190,150,255,.9)"); g.addColorStop(1, "rgba(120,90,255,0)");
      fx2.fillStyle = g; fx2.beginPath(); fx2.arc(w.x, yy, 22 * s, 0, 6.28); fx2.fill();
      if (Math.random() < 0.3) drawBolt(fx2, bolt(w.x, yy, w.x + rand(-22, 22), yy + rand(-22, 22), 6), "#c9a7ff", 1.2, 0.8);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; p.life -= dt * 1.5;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      fx2.globalAlpha = p.life; fx2.fillStyle = `rgb(${p.col})`;
      fx2.beginPath(); fx2.arc(p.x, p.y, 2, 0, 6.28); fx2.fill();
    }
    fx2.globalAlpha = 1;
    if (flash > 0) { fx2.fillStyle = `rgba(190,225,255,${flash * 0.35})`; fx2.fillRect(0, 0, W, H); }
    requestAnimationFrame(draw);
  }
})();
