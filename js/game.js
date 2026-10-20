/* =====================================================================
   Mini game: "Catch my love"
   Move the bunny's basket to catch falling hearts. 💔 costs points,
   every 5 catches in a row gives a combo bonus. Best score is saved.
   ===================================================================== */
(function catchGame() {
  const box = $("#game"), cv = $("#gameCv"), c = cv.getContext("2d");
  if (!box) return;
  const overlay = $("#gOverlay"), startBtn = $("#gStart"), titleEl = $("#gTitle"), msgEl = $("#gMsg"), bestEl = $("#gBest");
  const scoreEl = $("#gScore"), timeEl = $("#gTime"), bar = $("#gBar"), comboEl = $("#gCombo");
  const SECONDS = 25;
  const ITEMS = [
    { ch: "⭐", pts: 1, w: 32 }, { ch: "🌟", pts: 2, w: 16 }, { ch: "✨", pts: 1, w: 14 }, { ch: "📚", pts: 2, w: 8 }, { ch: "☕", pts: 2, w: 7 }, { ch: "🍫", pts: 2, w: 7 },
    { ch: "🎹", pts: 3, w: 6 }, { ch: "🀄", pts: 3, w: 6 }, { ch: "🌧️", pts: -3, w: 18 },
  ];
  const TOTAL_W = ITEMS.reduce((a, b) => a + b.w, 0);

  let W = 0, H = 0, state = "idle", items = [], sparks = [], floats = [], clouds = [];
  let px = 0, ptx = 0, tilt = 0, score = 0, combo = 0, best = 0, tEnd = 0, lastSpawn = 0, shake = 0, last = 0;
  const keys = { left: false, right: false };
  try { best = +localStorage.getItem("maryam-best") || 0; } catch (e) {}
  bestEl.textContent = best ? `рекорд: ${best}` : "";

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!px) px = ptx = W / 2;
    if (!clouds.length) for (let i = 0; i < 5; i++) clouds.push({ x: rand(0, W), y: rand(20, H * 0.45), s: rand(0.6, 1.3), v: rand(6, 16) });
    if (state !== "play") drawScene(performance.now(), 0);
  }
  addEventListener("resize", resize);
  new IntersectionObserver((en) => { if (en[0].isIntersecting) resize(); }).observe(box);

  /* ---------- input ---------- */
  const aim = (e) => { if (state === "play") { const r = cv.getBoundingClientRect(); ptx = e.clientX - r.left; } };
  box.addEventListener("pointerdown", aim);
  box.addEventListener("pointermove", aim);
  addEventListener("keydown", (e) => {
    if (state !== "play") return;
    if (e.key === "ArrowLeft") { keys.left = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { keys.right = true; e.preventDefault(); }
  });
  addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  });

  /* ---------- drawing ---------- */
  function cloud(x, y, s) {
    c.beginPath();
    c.arc(x, y, 18 * s, 0, 6.28); c.arc(x + 20 * s, y - 10 * s, 22 * s, 0, 6.28);
    c.arc(x + 44 * s, y, 18 * s, 0, 6.28); c.rect(x, y, 44 * s, 18 * s);
    c.fill();
  }
  function emoji(ch, x, y, size, rot = 0) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.font = `${size}px serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(ch, 0, 0); c.restore();
  }
  function drawScene(now, dt) {
    c.save();
    if (shake > 0.01) c.translate(rand(-1, 1) * shake * 10, rand(-1, 1) * shake * 10);
    c.clearRect(-20, -20, W + 40, H + 40);
    c.fillStyle = "rgba(255,255,255,.18)";
    for (const cl of clouds) { cl.x += cl.v * dt; if (cl.x > W + 60) cl.x = -100; cloud(cl.x, cl.y, cl.s); }
    // grass
    c.fillStyle = "rgba(180,150,255,.55)";
    c.beginPath(); c.moveTo(0, H - 22);
    for (let x = 0; x <= W; x += 20) c.quadraticCurveTo(x + 10, H - 30 - Math.sin(x * 0.05 + now / 600) * 3, x + 20, H - 22);
    c.lineTo(W, H); c.lineTo(0, H); c.fill();
    // falling stuff
    for (const it of items) emoji(it.ch, it.x, it.y, it.size, it.rot);
    // the bunny + basket
    emoji("✨", px, H - 80, 26, tilt * 0.6);
    emoji("📖", px, H - 46, 54, tilt);
    // sparkles
    for (const s of sparks) {
      c.globalAlpha = Math.max(0, s.life);
      c.fillStyle = s.col;
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.28); c.fill();
    }
    c.globalAlpha = 1;
    // floating "+2" texts
    c.textAlign = "center";
    for (const f of floats) {
      c.globalAlpha = Math.max(0, f.life);
      c.font = `700 ${f.big ? 22 : 18}px Nunito, sans-serif`;
      c.fillStyle = f.col;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.restore();
  }

  /* ---------- game loop ---------- */
  function spawn(progress) {
    let r = Math.random() * TOTAL_W, type = ITEMS[0];
    for (const it of ITEMS) { if ((r -= it.w) < 0) { type = it; break; } }
    items.push({
      ...type, x: rand(24, W - 24), y: -30, size: rand(30, 38),
      vy: rand(150, 220) * (1 + progress * 1.2), rot: 0, vr: rand(-2, 2), ph: rand(0, 6), wob: rand(0, 50),
    });
  }
  function pop(x, y, col, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), v = rand(60, 220);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: rand(2, 4.5), life: 1, col });
    }
  }
  function float(text, x, y, col, big) { floats.push({ text, x, y, col, life: 1, big }); }

  function loop(now) {
    if (state !== "play") return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const remain = Math.max(0, (tEnd - now) / 1000), progress = 1 - remain / SECONDS;

    if (keys.left) ptx -= 560 * dt;
    if (keys.right) ptx += 560 * dt;
    ptx = Math.max(28, Math.min(W - 28, ptx));
    const prev = px;
    px += (ptx - px) * Math.min(1, dt * 14);
    tilt += (Math.max(-0.5, Math.min(0.5, (px - prev) * 0.05)) - tilt) * 0.3;

    if (now - lastSpawn > (0.6 - progress * 0.33) * 1000) { lastSpawn = now; spawn(progress); }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt; it.rot += it.vr * dt; it.x += Math.sin(now / 380 + it.ph) * it.wob * dt;
      const caught = Math.abs(it.x - px) < 40 && it.y > H - 92 && it.y < H - 30;
      if (caught) {
        items.splice(i, 1);
        if (it.pts > 0) {
          combo++;
          const bonus = combo % 5 === 0 ? 3 : 0;
          score += it.pts + bonus;
          pop(it.x, it.y, ["#ff4f93", "#ff9cc2", "#8f7bff", "#fff"][i % 4]);
          float(`+${it.pts}`, it.x, it.y - 20, "#d63a78");
          if (bonus) { float(`СЕРИЯ x${combo}! +${bonus}`, W / 2, H * 0.4, "#6f9bff", true); pop(px, H - 60, "#8f7bff", 24); }
          if (typeof buzz === "function") buzz(8);
        } else {
          score = Math.max(0, score + it.pts);
          combo = 0; shake = 1;
          float(`${it.pts}`, it.x, it.y - 20, "#ff2d6b", true);
          box.classList.remove("hurt"); void box.offsetWidth; box.classList.add("hurt");
          if (typeof buzz === "function") buzz([40, 30, 40]);
        }
      } else if (it.y > H + 30) {
        items.splice(i, 1);
        if (it.pts > 0) combo = 0;
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; s.life -= dt * 1.6;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.y -= 50 * dt; f.life -= dt * 1.2;
      if (f.life <= 0) floats.splice(i, 1);
    }
    shake *= 0.88;
    drawScene(now, dt);

    scoreEl.textContent = score;
    timeEl.textContent = Math.ceil(remain);
    bar.style.width = (remain / SECONDS) * 100 + "%";
    comboEl.textContent = combo >= 3 ? `🔥 x${combo}` : "";
    if (remain <= 0) end(); else requestAnimationFrame(loop);
  }

  async function countdown() {
    overlay.classList.add("count");
    for (const n of ["3", "2", "1", "СТАРТ!"]) {
      titleEl.textContent = n;
      titleEl.classList.remove("pop"); void titleEl.offsetWidth; titleEl.classList.add("pop");
      if (typeof sound === "function") sound(n === "СТАРТ!" ? 784 : 523);
      await sleep(650);
    }
    overlay.classList.remove("count");
  }

  async function start() {
    msgEl.textContent = ""; bestEl.textContent = ""; startBtn.style.display = "none";
    resize();
    await countdown();
    overlay.classList.add("hide");
    items = []; sparks = []; floats = []; score = 0; combo = 0; shake = 0;
    px = ptx = W / 2;
    box.classList.add("playing");
    state = "play";
    last = lastSpawn = performance.now();
    tEnd = last + SECONDS * 1000;
    requestAnimationFrame(loop);
  }

  function end() {
    state = "over";
    box.classList.remove("playing");
    items = [];
    const isBest = score > best;
    if (isBest) { best = score; try { localStorage.setItem("maryam-best", best); } catch (e) {} }
    titleEl.textContent = "ИГРА ОКОНЧЕНА";
    msgEl.innerHTML = "";
    const line = document.createElement("span");
    line.textContent = score >= 35 ? `${score} очков — ты поймала все звёзды ✨` :
                       score >= 20 ? `${score} очков — вот это да!` :
                       score >= 10 ? `${score} очков — неплохо! ещё раз?` : `${score} очков — это была разминка 😄`;
    msgEl.appendChild(line);
    bestEl.textContent = isBest && score > 0 ? "✨ новый рекорд! ✨" : `рекорд: ${best}`;
    startBtn.textContent = "▶ ЕЩЁ РАЗ";
    startBtn.style.display = "";
    overlay.classList.remove("hide");
    const [x, y] = center(box);
    burst(x, y, 16);
    if (score >= 15) achieve("game15", "Собирательница звёзд ⭐");
    if (score >= 30) { achieve("game30", "Легенда звёздной охоты 🏆"); Fireworks.show(6); }
    drawScene(performance.now(), 0);
  }

  startBtn.addEventListener("click", start);
})();
