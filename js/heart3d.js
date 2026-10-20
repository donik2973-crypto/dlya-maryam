/* =====================================================================
   A real 3D heart made of particles.
   The points sit on the surface of the "Taubin heart" equation:
   (x² + 9/4·z² + y² − 1)³ − x²·y³ − 9/80·z²·y³ = 0
   Drag to spin it, tap to make it beat.
   ===================================================================== */
(function heart3D() {
  const cv = $("#heart3d");
  if (!cv) return;
  const c = cv.getContext("2d");
  const F = (x, y, z) => { const a = x * x + 2.25 * z * z + y * y - 1; return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y; };

  // find surface points: shoot random rays from the middle and binary-search the edge
  const N = innerWidth < 600 ? 1500 : 2600;
  const pts = [];
  while (pts.length < N) {
    let dx = rand(-1, 1), dy = rand(-1, 1), dz = rand(-1, 1);
    const l = Math.hypot(dx, dy, dz);
    if (l < 0.1 || l > 1) continue;
    dx /= l; dy /= l; dz /= l;
    let lo = 0, hi = 2;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (F(dx * mid, dy * mid, dz * mid) < 0) lo = mid; else hi = mid; }
    const r = Math.random() < 0.88 ? lo : lo * rand(0.35, 0.95);
    const h = (dy * r + 1.2) / 2.4;
    pts.push({ x: dx * r, y: dy * r, z: dz * r, col: h > 0.6 ? 0 : h > 0.35 ? 1 : 2, tw: Math.random() * 6.28 });
  }
  // a ring orbiting the heart, with little friends riding on it
  const ringPts = [];
  for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; ringPts.push({ a, r: 1.75 + rand(-0.04, 0.04) }); }
  const riders = ["🐰", "🌸", "🎹", "🐴", "🐶", "🎮"];
  const palette = ["255,120,175", "240,82,143", "200,110,230"];

  let W = 0, H = 0, visible = false, rotY = 0, rotX = -0.15, velY = 0.008, velX = 0, kick = 0;
  let dragging = false, lastX = 0, lastY = 0, moved = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);

  cv.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    velY = dx * 0.006; velX = dy * 0.004;
    rotY += dx * 0.01; rotX = Math.max(-0.9, Math.min(0.9, rotX + dy * 0.006));
    lastX = e.clientX; lastY = e.clientY;
  });
  cv.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved < 8) {
      kick = 1;
      burst(e.clientX, e.clientY, 14, ["💗", "💖", "✨"]);
      ring(e.clientX, e.clientY, { size: 260, width: 3 });
      if (typeof buzz === "function") buzz(25);
      achieve("heart3d", "Held Cooper's heart 💗");
    }
  });

  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
    if (visible) { resize(); requestAnimationFrame(draw); }
  }).observe(cv);

  function draw(t) {
    if (!visible) return;
    const time = t / 1000;
    if (!dragging) { velY += (0.008 - velY) * 0.02; velX *= 0.95; rotY += velY; rotX += velX; rotX += (-0.15 - rotX) * 0.01; }
    kick *= 0.94;
    const beat = 1 + 0.07 * Math.pow(Math.max(0, Math.sin(time * 3.2)), 10) + kick * 0.25;
    const R = Math.min(W, H) * 0.3 * beat;
    const cx = W / 2, cy = H / 2;
    const cyR = Math.cos(rotY), syR = Math.sin(rotY), cxR = Math.cos(rotX), sxR = Math.sin(rotX);
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";

    // project 3D → 2D with perspective
    const project = (x, y, z) => {
      const x1 = x * cyR - z * syR, z1 = x * syR + z * cyR;
      const y2 = y * cxR - z1 * sxR, z2 = y * sxR + z1 * cxR;
      const pz = 3.2 / (3.2 + z2);
      return [cx + x1 * R * pz, cy - y2 * R * pz, z2, pz];
    };

    const buckets = [[], [], []];
    for (const p of pts) {
      const s = project(p.x, p.y, p.z);
      buckets[p.col].push(s);
    }
    buckets.forEach((list, i) => {
      for (const [x, y, z, pz] of list) {
        const depth = (1.3 - z) / 2.6;
        c.fillStyle = `rgba(${palette[i]},${0.25 + depth * 0.6})`;
        const r = (0.9 + depth * 1.6) * pz;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });

    // orbit ring (tilted)
    const tilt = 0.45;
    for (const q of ringPts) {
      const a = q.a + time * 0.4;
      const x = Math.cos(a) * q.r, z = Math.sin(a) * q.r;
      const [sx, sy, sz, pz] = project(x, z * Math.sin(tilt) * 0.5 - 0.05, z * Math.cos(tilt));
      const depth = (2 - sz) / 4;
      c.fillStyle = `rgba(255,255,255,${0.2 + depth * 0.6})`;
      c.fillRect(sx - pz, sy - pz, pz * 2, pz * 2);
    }
    c.globalCompositeOperation = "source-over";
    riders.forEach((em, i) => {
      const a = (i / riders.length) * Math.PI * 2 + time * 0.4;
      const x = Math.cos(a) * 1.75, z = Math.sin(a) * 1.75;
      const [sx, sy, sz, pz] = project(x, z * Math.sin(tilt) * 0.5 - 0.05, z * Math.cos(tilt));
      c.globalAlpha = 0.45 + ((2 - sz) / 4) * 0.55;
      c.font = `${Math.round(22 * pz)}px serif`;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(em, sx, sy);
    });
    c.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
})();
