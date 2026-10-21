/* =====================================================================
   "Небо в день твоего рождения" — the real sky over her city on her
   birthday. Star positions come from js/skydata.js; the Sun, Moon and
   planets are calculated from their orbits (Paul Schlyter's method,
   accurate to a fraction of a degree). Drag to turn the sky, move the
   slider (or press ▶) to let the day pass, tap a bright dot to see
   what it is.
   ===================================================================== */
(function birthSky() {
  const cv = $("#bsky");
  if (!cv || typeof SKY_STARS === "undefined") return;
  const c = cv.getContext("2d");
  const B = Object.assign({ date: "2009-06-19", city: "Ташкент", lat: 41.31, lon: 69.28, utc: 5, time: "03:45" }, CONFIG.birthSky || {});
  if (CONFIG.birthSkyLead) $("#bsLead").textContent = CONFIG.birthSkyLead;

  /* ---------- astronomy ---------- */
  const RAD = Math.PI / 180, norm = (a) => ((a % 360) + 360) % 360;
  const sind = (a) => Math.sin(a * RAD), cosd = (a) => Math.cos(a * RAD);
  // N, dN, i, di, w, dw, a, e, de, M, dM  (degrees; d = days since 1999-12-31)
  const ELEMENTS = {
    Меркурий: [48.3313, 3.24587e-5, 7.0047, 5e-8, 29.1241, 1.01444e-5, 0.387098, 0.205635, 5.59e-10, 168.6562, 4.0923344368],
    Венера: [76.6799, 2.4659e-5, 3.3946, 2.75e-8, 54.891, 1.38374e-5, 0.72333, 0.006773, -1.302e-9, 48.0052, 1.6021302244],
    Марс: [49.5574, 2.11081e-5, 1.8497, -1.78e-8, 286.5016, 2.92961e-5, 1.523688, 0.093405, 2.516e-9, 18.6021, 0.5240207766],
    Юпитер: [100.4542, 2.76854e-5, 1.303, -1.557e-7, 273.8777, 1.64505e-5, 5.20256, 0.048498, 4.469e-9, 19.895, 0.0830853001],
    Сатурн: [113.6634, 2.3898e-5, 2.4886, -1.081e-7, 339.3939, 2.97661e-5, 9.55475, 0.055546, -9.499e-9, 316.967, 0.0334442282],
  };
  const PLANET_LOOK = { Меркурий: ["#e8d9c8", 2.2], Венера: ["#fff6e0", 4.2], Марс: ["#ff8a65", 3], Юпитер: ["#ffe9c4", 3.8], Сатурн: ["#f3dca0", 3.2] };
  function kepler(M, e) {
    let E = M + (180 / Math.PI) * e * sind(M) * (1 + e * cosd(M));
    for (let k = 0; k < 5; k++) E -= (E - (180 / Math.PI) * e * sind(E) - M) / (1 - e * cosd(E));
    return E;
  }
  function orbit(N, i, w, a, e, M) {
    const E = kepler(norm(M), e), xv = a * (cosd(E) - e), yv = a * Math.sqrt(1 - e * e) * sind(E);
    const v = Math.atan2(yv, xv) / RAD, r = Math.hypot(xv, yv), u = v + w;
    return [r * (cosd(N) * cosd(u) - sind(N) * sind(u) * cosd(i)), r * (sind(N) * cosd(u) + cosd(N) * sind(u) * cosd(i)), r * sind(u) * sind(i)];
  }
  function toEq([x, y, z], d) {
    const ecl = 23.4393 - 3.563e-7 * d, ye = y * cosd(ecl) - z * sind(ecl), ze = y * sind(ecl) + z * cosd(ecl);
    return [norm(Math.atan2(ye, x) / RAD), Math.atan2(ze, Math.hypot(x, ye)) / RAD];
  }
  function bodies(jd) {
    const d = jd - 2451543.5;
    const sun = orbit(0, 0, 282.9404 + 4.70935e-5 * d, 1, 0.016709 - 1.151e-9 * d, 356.047 + 0.9856002585 * d);
    const out = { Солнце: toEq(sun, d) };
    for (const k in ELEMENTS) {
      const p = ELEMENTS[k], h = orbit(p[0] + p[1] * d, p[2] + p[3] * d, p[4] + p[5] * d, p[6], p[7] + p[8] * d, p[9] + p[10] * d);
      out[k] = toEq([h[0] + sun[0], h[1] + sun[1], h[2]], d);
    }
    const moon = orbit(125.1228 - 0.0529538083 * d, 5.1454, 318.0634 + 0.1643573223 * d, 60.2666, 0.0549, 115.3654 + 13.0649929509 * d);
    out.Луна = toEq(moon, d);
    out.elong = norm(Math.atan2(moon[1], moon[0]) / RAD - Math.atan2(sun[1], sun[0]) / RAD);
    return out;
  }
  let lst = 0;
  function altAz(ra, dec) {
    const H = lst - ra;
    const alt = Math.asin(sind(B.lat) * sind(dec) + cosd(B.lat) * cosd(dec) * cosd(H)) / RAD;
    const az = Math.atan2(-sind(H) * cosd(dec), cosd(B.lat) * sind(dec) - sind(B.lat) * cosd(dec) * cosd(H)) / RAD;
    return [alt, az];
  }
  // galactic equator → a soft Milky Way band
  const MILKY = [];
  for (let l = 0; l < 360; l += 2) {
    for (let k = 0; k < 2; k++) {
      const b = (Math.random() - 0.5) * 14, gx = cosd(b) * cosd(l), gy = cosd(b) * sind(l), gz = sind(b);
      // galactic → equatorial (J2000 rotation matrix)
      const x = -0.0548755604 * gx + 0.4941094279 * gy - 0.867666149 * gz;
      const y = -0.8734370902 * gx - 0.4448296300 * gy - 0.1980763734 * gz;
      const z = -0.4838350155 * gx + 0.7469822445 * gy + 0.4559837762 * gz;
      const core = Math.exp(-Math.pow(((l + 180) % 360 - 180) / 60, 2));
      MILKY.push([norm(Math.atan2(y, x) / RAD), Math.asin(z) / RAD, 0.35 + core * 0.9, 10 + Math.random() * 14]);
    }
  }

  /* ---------- time ---------- */
  const [Y, MO, DA] = B.date.split("-").map(Number);
  const slider = $("#bsTime"), clock = $("#bsClock"), playBtn = $("#bsPlay");
  const [hh, mm] = B.time.split(":").map(Number);
  slider.value = hh * 60 + mm;
  let minutes = +slider.value, playing2 = false, rot = 0;
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function showClock() {
    const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
    clock.textContent = `${DA} ${MONTHS[MO - 1]} ${Y} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} · ${B.city}`;
  }
  slider.addEventListener("input", () => { minutes = +slider.value; playing2 = false; playBtn.textContent = "▶ время"; showClock(); dirty = true; });
  playBtn.addEventListener("click", () => {
    playing2 = !playing2;
    playBtn.textContent = playing2 ? "❚❚ пауза" : "▶ время";
    if (playing2) achieve("birthsky", "Увидела небо своего дня рождения 🌌");
  });
  showClock();

  /* ---------- drawing ---------- */
  let W = 0, R = 0, dpr = 1, dirty = true, objects = [];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth;
    cv.width = cv.height = W * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = W / 2 - 22;
    dirty = true;
  }
  addEventListener("resize", resize);
  // zenith in the middle, horizon on the rim; north up, east on the left (as when lying on your back)
  function proj(alt, az) {
    const r = R * Math.tan(((90 - alt) * RAD) / 2);
    return [W / 2 - r * Math.sin((az + rot) * RAD), W / 2 - r * Math.cos((az + rot) * RAD)];
  }
  const starColor = (bv) => bv < 0 ? "190,210,255" : bv < 0.4 ? "225,232,255" : bv < 0.8 ? "255,248,232" : bv < 1.2 ? "255,226,190" : "255,196,160";
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  function draw(time) {
    const jd = Date.UTC(Y, MO - 1, DA, 0, 0) / 864e5 + 2440587.5 + (minutes / 60 - B.utc) / 24;
    lst = norm(280.46061837 + 360.98564736629 * (jd - 2451545) + B.lon);
    const bd = bodies(jd);
    const [sunAlt, sunAz] = altAz(...bd.Солнце);
    const day = Math.max(0, Math.min(1, (sunAlt + 8) / 12));          // 0 night → 1 day
    const dusk = Math.max(0, 1 - Math.abs(sunAlt + 4) / 9);            // twilight glow
    const limMag = sunAlt > 0 ? -1.5 : sunAlt > -6 ? 1.6 + sunAlt * 0.5 : Math.min(5.3, 1.6 + (-6 - sunAlt) * 0.35);

    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, R, 0, 6.283); c.clip();
    const top = mix([12, 8, 34], [74, 140, 226], day), rim = mix([30, 18, 70], [170, 210, 255], day);
    const g = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, R);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${rim})`);
    c.fillStyle = g; c.fillRect(0, 0, W, W);
    if (dusk > 0) {                                                     // pink-orange glow where the sun is
      const [sx, sy] = proj(0, sunAz), gl = c.createRadialGradient(sx, sy, 0, sx, sy, R * 1.1);
      gl.addColorStop(0, `rgba(255,150,120,${0.55 * dusk})`); gl.addColorStop(0.4, `rgba(255,110,190,${0.25 * dusk})`); gl.addColorStop(1, "rgba(255,110,190,0)");
      c.fillStyle = gl; c.fillRect(0, 0, W, W);
    }

    // Milky Way
    if (day < 0.6) {
      c.globalCompositeOperation = "lighter";
      for (const [ra, de, br, size] of MILKY) {
        const [a, z] = altAz(ra, de);
        if (a < -5) continue;
        const [x, y] = proj(a, z), s = size * (W / 600);
        const mg = c.createRadialGradient(x, y, 0, x, y, s);
        mg.addColorStop(0, `rgba(170,150,255,${0.05 * br * (1 - day / 0.6)})`); mg.addColorStop(1, "rgba(170,150,255,0)");
        c.fillStyle = mg; c.fillRect(x - s, y - s, s * 2, s * 2);
      }
      c.globalCompositeOperation = "source-over";
    }

    // constellation lines + names
    const lineA = 0.28 * (1 - day);
    if (lineA > 0.02) {
      c.lineWidth = 1;
      c.strokeStyle = `rgba(200,170,255,${lineA})`;
      c.beginPath();
      for (const [, , , segs] of SKY_LINES) for (const s of segs) {
        let pen = false;
        for (let k = 0; k < s.length; k += 2) {
          const [a, z] = altAz(s[k], s[k + 1]);
          if (a < -2) { pen = false; continue; }
          const [x, y] = proj(a, z);
          pen ? c.lineTo(x, y) : c.moveTo(x, y);
          pen = true;
        }
      }
      c.stroke();
      c.font = `600 ${Math.max(9, W / 62)}px Nunito, sans-serif`;
      c.textAlign = "center";
      c.fillStyle = `rgba(220,200,255,${lineA * 1.6})`;
      for (const [name, ra, de] of SKY_LINES) {
        const [a, z] = altAz(ra, de);
        if (a < 8) continue;
        const [x, y] = proj(a, z);
        c.fillText(name, x, y);
      }
    }

    // stars
    objects = [];
    const tw = time / 1000;
    for (let i = 0; i < SKY_STARS.length; i += 4) {
      const mag = SKY_STARS[i + 2];
      if (mag > limMag) continue;
      const [a, z] = altAz(SKY_STARS[i], SKY_STARS[i + 1]);
      if (a < 0) continue;
      const [x, y] = proj(a, z);
      const r = Math.max(0.45, (5.6 - mag) * 0.42) * (W / 600);
      const fade = Math.min(1, (limMag - mag) / 1.2) * (0.75 + 0.25 * Math.sin(tw * 2 + i)) * Math.min(1, a / 4 + 0.3);
      c.fillStyle = `rgba(${starColor(SKY_STARS[i + 3])},${fade})`;
      if (r > 1.6) { c.shadowBlur = r * 3; c.shadowColor = `rgba(${starColor(SKY_STARS[i + 3])},.8)`; }
      c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();
      c.shadowBlur = 0;
    }
    // bright star names (Russian + Chinese)
    if (day < 0.5) {
      c.font = `700 ${Math.max(10, W / 52)}px Nunito, sans-serif`;
      c.textAlign = "left";
      for (const [ra, de, ru, zh] of SKY_NAMES) {
        const [a, z] = altAz(ra, de);
        if (a < 3) continue;
        const [x, y] = proj(a, z);
        objects.push([x, y, `⭐ ${ru}${zh ? " · " + zh : ""}`]);
      }
      c.fillStyle = `rgba(255,236,250,${0.75 * (1 - day * 2)})`;
      for (const [x, y, t] of objects.slice(0, 40)) {
        const label = t.replace("⭐ ", "").split(" · ")[0];
        if (["Вега", "Альтаир", "Денеб", "Арктур", "Антарес", "Капелла", "Альдебаран", "Спика", "Регул", "Полярная", "Сириус", "Бетельгейзе", "Ригель", "Поллукс", "Фомальгаут"].includes(label)) c.fillText(label, x + 5, y - 4);
      }
    }

    // Sun, planets, Moon
    // labels move aside when two bodies sit close together (Venus and Mars that morning)
    const placed = [], queue = [];
    const label = (...a) => queue.push(a);   // drawn after all the bodies so discs never cover text
    const drawLabel = (x, y, t, col) => {
      const fs = Math.max(11, W / 48);
      c.font = `800 ${fs}px Nunito, sans-serif`; c.textAlign = "left"; c.fillStyle = col;
      const w = c.measureText(t).width;
      for (const [ox, oy] of [[8, 4], [8, fs + 6], [8, -fs + 2], [-w - 8, 4], [-w - 8, fs + 6]]) {
        const r = [x + ox, y + oy - fs, w, fs + 2];
        if (placed.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3])) continue;
        placed.push(r);
        return c.fillText(t, x + ox, y + oy);
      }
    };
    const [sa, sz] = [sunAlt, sunAz];
    if (sa > -1) {
      const [x, y] = proj(Math.max(sa, 0.5), sz);
      c.shadowBlur = 30; c.shadowColor = "#ffd27a"; c.fillStyle = "#fff4d0";
      c.beginPath(); c.arc(x, y, 9 * (W / 600), 0, 6.283); c.fill(); c.shadowBlur = 0;
      label(x, y, "Солнце", "rgba(255,240,200,.95)");
      objects.push([x, y, "☀️ Солнце"]);
    }
    for (const k in PLANET_LOOK) {
      const [a, z] = altAz(...bd[k]);
      if (a < 0) continue;
      const [x, y] = proj(a, z), [col, rr] = PLANET_LOOK[k];
      if (k !== "Венера" && k !== "Юпитер" && sunAlt > -3) continue;
      c.shadowBlur = 14; c.shadowColor = col; c.fillStyle = col;
      c.beginPath(); c.arc(x, y, rr * (W / 600), 0, 6.283); c.fill(); c.shadowBlur = 0;
      label(x, y, k, "rgba(255,228,170,.95)");
      objects.push([x, y, `🪐 ${k}`]);
    }
    {
      const [a, z] = altAz(...bd.Луна);
      if (a > -1) {
        const [x, y] = proj(Math.max(a, 0.5), z), r = 10 * (W / 600);
        const lit = (1 - cosd(bd.elong)) / 2, waxing = bd.elong < 180;
        c.save();
        c.translate(x, y);
        // point the lit side toward the Sun
        const [sx, sy] = proj(Math.max(sunAlt, -30), sunAz);
        c.rotate(Math.atan2(sy - y, sx - x));
        c.fillStyle = "rgba(90,80,130,.9)";
        c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill();
        c.shadowBlur = 12; c.shadowColor = "#fff6dc"; c.fillStyle = "#fff6dc";
        c.beginPath();
        c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
        c.ellipse(0, 0, Math.abs(1 - 2 * lit) * r, r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5);
        c.fill();
        c.restore();
        label(x, y, "Луна", "rgba(255,246,220,.95)");
        objects.push([x, y, `🌙 Луна · ${waxing ? "растущая" : "убывающая"}, освещена на ${Math.round(lit * 100)}%`]);
      }
    }
    queue.forEach((a) => drawLabel(...a));
    c.restore();

    // horizon ring + directions
    c.strokeStyle = "rgba(232,220,255,.35)"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(W / 2, W / 2, R, 0, 6.283); c.stroke();
    c.font = `800 ${Math.max(11, W / 44)}px Nunito, sans-serif`; c.textAlign = "center"; c.fillStyle = "rgba(255,200,240,.9)";
    for (const [t, az] of [["С", 0], ["В", 90], ["Ю", 180], ["З", 270]]) {
      const x = W / 2 - (R + 12) * Math.sin((az + rot) * RAD), y = W / 2 - (R + 12) * Math.cos((az + rot) * RAD) + 4;
      c.fillText(t, x, y);
    }
  }

  /* ---------- interaction ---------- */
  const tip = $("#bsTip");
  let drag = false, lx = 0, ly = 0, moved = 0, tipTimer;
  cv.addEventListener("pointerdown", (e) => { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a1 = Math.atan2(ly - cy, lx - cx), a2 = Math.atan2(e.clientY - cy, e.clientX - cx);
    rot -= ((a2 - a1) / RAD);
    moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
  });
  cv.addEventListener("pointerup", (e) => {
    drag = false;
    if (moved > 8) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (W / r.width);
    let best = null, bd = 22;
    for (const o of objects) { const d = Math.hypot(o[0] - x, o[1] - y); if (d < bd) { bd = d; best = o; } }
    if (!best) return;
    tip.textContent = best[2];
    tip.style.left = (best[0] / W) * 100 + "%";
    tip.style.top = (best[1] / W) * 100 + "%";
    tip.classList.add("show");
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove("show"), 2600);
    achieve("birthsky", "Увидела небо своего дня рождения 🌌");
  });

  let running = false, last = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (playing2) {
      minutes = (minutes + Math.min(0.05, (now - last) / 1000) * 40) % 1440;
      slider.value = Math.floor(minutes);
      showClock();
    }
    last = now;
    draw(now);
  }
  new IntersectionObserver((es) => {
    const vis = es[0].isIntersecting;
    if (vis && !running) { if (!W) resize(); running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!vis) running = false;
  }).observe(cv);
})();
