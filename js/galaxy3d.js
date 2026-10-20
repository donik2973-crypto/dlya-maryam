/* =====================================================================
   "Галактика Марьям" — a 3D spiral galaxy made of particles.
   Drag to spin it, tap it for a supernova.
   ===================================================================== */
(function galaxy3D() {
  const cv = $("#galaxy3d");
  if (!cv) return;
  const c = cv.getContext("2d");
  const N = innerWidth < 600 ? 2200 : 3600, ARMS = 3;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const stars = [];
  for (let i = 0; i < N; i++) {
    const core = i < N * 0.14;
    const r = core ? Math.abs(gauss()) * 0.35 : Math.pow(Math.random(), 0.55) * 1.6;
    const arm = (i % ARMS) * ((Math.PI * 2) / ARMS);
    const spin = r * 3.1;
    const spread = 0.45 * (1 - r / 2.2);
    const a = arm + spin + gauss() * spread;
    // color: white-pink core → violet → blue edges
    const t = Math.min(1, r / 1.6);
    const col = core ? [255, 236, 248] : t < 0.45 ? [255, 140 + t * 60, 210] : t < 0.75 ? [180, 140, 255] : [120, 170, 255];
    stars.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: gauss() * 0.07 * (1.8 - r), col, s: core ? rand(0.8, 1.8) : rand(0.6, 1.6), tw: Math.random() * 6.28 });
  }
  // little "planets" orbiting inside her galaxy
  const planets = [["📚", 0.7], ["🎹", 1.05], ["🀄", 1.35], ["☕", 0.9], ["🌙", 1.5]].map(([e, r], i) => ({ e, r, a: i * 1.3 }));

  let W = 0, H = 0, visible = false, rotY = 0, tilt = 1.05, velY = 0.0035, drag = false, lx = 0, ly = 0, moved = 0, nova = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  cv.addEventListener("pointerdown", (e) => { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    moved += Math.abs(dx) + Math.abs(dy);
    rotY += dx * 0.008; velY = dx * 0.002;
    tilt = Math.max(0.15, Math.min(1.45, tilt + dy * 0.006));
    lx = e.clientX; ly = e.clientY;
  });
  cv.addEventListener("pointerup", (e) => {
    drag = false;
    if (moved < 8) {
      nova = 1;
      burst(e.clientX, e.clientY, 16, ["✨", "⭐", "💫", "🌟"]);
      ring(e.clientX, e.clientY, { size: 320, width: 3, color: "#b48cff" });
      try { SFX.twinkle(); } catch (err) {}
      achieve("galaxy", "Взорвала сверхновую в своей галактике 💥");
    }
  });
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) { resize(); requestAnimationFrame(draw); } }).observe(cv);

  function draw(t) {
    if (!visible) return;
    const time = t / 1000;
    if (!drag) { velY += (0.0035 - velY) * 0.02; rotY += velY; }
    nova *= 0.95;
    const R = Math.min(W, H) * 0.33 * (1 + nova * 0.15);
    const cx = W / 2, cy = H / 2, cY = Math.cos(rotY), sY = Math.sin(rotY), cT = Math.cos(tilt), sT = Math.sin(tilt);
    const project = (x, y, z) => {
      const x1 = x * cY - z * sY, z1 = x * sY + z * cY;
      const y2 = y * cT - z1 * sT, z2 = y * sT + z1 * cT;
      const p = 3.4 / (3.4 + z2);
      return [cx + x1 * R * p, cy + y2 * R * p, z2, p];
    };
    c.clearRect(0, 0, W, H);
    // soft glowing core
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
    g.addColorStop(0, `rgba(255,220,245,${0.55 + nova * 0.4})`); g.addColorStop(0.4, "rgba(180,140,255,.18)"); g.addColorStop(1, "rgba(120,170,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const [x, y, z, p] = project(s.x, s.y, s.z);
      const depth = (1.7 - z) / 3.4;
      const tw = 0.65 + 0.35 * Math.sin(time * 2 + s.tw);
      c.fillStyle = `rgba(${s.col[0]},${s.col[1]},${s.col[2]},${(0.25 + depth * 0.6) * tw})`;
      const r = s.s * p * (1 + nova);
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = "source-over";
    for (const pl of planets) {
      const a = pl.a + time * (0.5 / pl.r);
      const [x, y, z, p] = project(Math.cos(a) * pl.r, 0, Math.sin(a) * pl.r);
      c.globalAlpha = 0.5 + ((1.7 - z) / 3.4) * 0.5;
      c.font = `${Math.round(20 * p)}px serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(pl.e, x, y);
    }
    c.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
})();
