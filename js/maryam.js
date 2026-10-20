/* =====================================================================
   Maryam's own sections: the bookshelf, the poem book, Chinese writing
   practice, the "leaked documents" joke, the cheer-up button with a
   breathing exercise, and the constellation game.
   ===================================================================== */

/* ---------- 📚 the bookshelf ---------- */
(function bookshelf() {
  const shelf = $("#shelf");
  if (!shelf) return;
  const modal = $("#bookModal"), book = $("#bmBook"), cover = $("#bmCover");
  const opened = new Set();
  CONFIG.books.forEach((bk, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spine" + (bk.special ? " special" : "");
    b.style.setProperty("--c", bk.color);
    b.style.setProperty("--h", 78 + ((i * 37) % 22) + "%");
    b.style.setProperty("--w", 46 + ((i * 13) % 16) + "px");
    b.style.animationDelay = i * 0.08 + "s";
    b.innerHTML = `<span class="sp-ico"></span><span class="sp-title"></span>`;
    b.querySelector(".sp-ico").textContent = bk.icon;
    b.querySelector(".sp-title").textContent = bk.title;
    b.setAttribute("aria-label", bk.title);
    b.addEventListener("click", () => open(i, b));
    shelf.appendChild(b);
  });
  async function open(i, spine) {
    const bk = CONFIG.books[i];
    $("#bmIco").textContent = bk.icon;
    $("#bmTitle").textContent = bk.title;
    $("#bmText").textContent = "";
    $("#bmSig").textContent = `— ${CONFIG.fromName}`;
    book.style.setProperty("--c", bk.color);
    spine.classList.add("out");
    setTimeout(() => spine.classList.remove("out"), 900);
    modal.classList.remove("opened");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    try { SFX.whoosh(); } catch (e) {}
    await sleep(650);
    modal.classList.add("opened");              // the cover swings open
    await sleep(700);
    const p = $("#bmText");
    for (const ch of Array.from(bk.text)) { if (!modal.classList.contains("show")) return; p.textContent += ch; await sleep(14); }
    opened.add(i);
    achieve("book1", "Открыла первую книгу 📖");
    if (opened.size === CONFIG.books.length) { achieve("books", "Прочитала всю полку 📚"); Fireworks.show(4); }
  }
  function close() { modal.classList.remove("show", "opened"); modal.setAttribute("aria-hidden", "true"); }
  $("#bmClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

/* ---------- ✍️ the poem book (pages turn) ---------- */
(function poemBook() {
  const bookEl = $("#poemBook");
  if (!bookEl) return;
  const pages = [
    { cover: true, lines: [CONFIG.poemTitle, "стихотворение"] },
    ...CONFIG.poem.map((lines) => ({ lines })),
    { end: true, lines: [CONFIG.poemSign] },
  ];
  let cur = 0, busy = false, current = null;
  function render(i, dir) {
    const pg = document.createElement("div");
    const p = pages[i];
    pg.className = "pg" + (p.cover ? " cover" : "") + (p.end ? " end" : "") + (dir ? (dir > 0 ? " in-next" : " in-prev") : "");
    p.lines.forEach((line, k) => {
      const l = document.createElement("p");
      l.textContent = line;
      l.style.setProperty("--k", k);
      pg.appendChild(l);
    });
    if (p.cover) { const s = document.createElement("span"); s.className = "pg-star"; s.textContent = "✦"; pg.prepend(s); }
    const num = document.createElement("span"); num.className = "pg-num"; num.textContent = i + 1; pg.appendChild(num);
    bookEl.appendChild(pg);
    $("#poemPage").textContent = `${i + 1} / ${pages.length}`;
    $("#poemPrev").disabled = i === 0;
    $("#poemNext").disabled = i === pages.length - 1;
    return pg;
  }
  async function go(d) {
    const next = cur + d;
    if (busy || next < 0 || next >= pages.length) return;
    busy = true;
    current.classList.add(d > 0 ? "out-next" : "out-prev");
    try { SFX.whoosh(); } catch (e) {}
    const old = current;
    await sleep(420);
    old.remove();
    cur = next;
    current = render(cur, d);
    if (pages[cur].end) {
      const [x, y] = center(bookEl);
      burst(x, y, 18, ["✨", "⭐", "📖"]);
      achieve("poem", "Прочитала стих до конца ✍️");
    }
    await sleep(300);
    busy = false;
  }
  current = render(0, 0);
  $("#poemNext").addEventListener("click", () => go(1));
  $("#poemPrev").addEventListener("click", () => go(-1));
  bookEl.addEventListener("click", (e) => {
    const r = bookEl.getBoundingClientRect();
    go(e.clientX - r.left > r.width / 2 ? 1 : -1);
  });
  let sx = null;
  bookEl.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
  bookEl.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    sx = null;
  });
})();

/* ---------- 🀄 write a Chinese character (uses the Hanzi Writer library) ---------- */
(function hanziPractice() {
  const box = $("#hzBox");
  if (!box) return;
  const INFO = {
    "书": ["shū", "книга"], "学": ["xué", "учиться (大学 — университет)"], "星": ["xīng", "звезда"], "友": ["yǒu", "друг"], "好": ["hǎo", "хорошо"],
    "乐": ["lè", "радость"], "加": ["jiā", "добавлять (加油 — «давай!»)"], "油": ["yóu", "масло (加油 — «давай!»)"], "诗": ["shī", "стихи"],
  };
  const msg = $("#hzMsg"), info = $("#hzInfo");
  if (!window.HanziWriter) {
    msg.textContent = "Чтобы загрузить иероглифы, нужен интернет 🌐";
    $("#hzShow").disabled = $("#hzQuiz").disabled = true;
    return;
  }
  const size = Math.min(240, Math.max(180, innerWidth - 120));
  let ch = CONFIG.practice[0], writer = null;
  function make() {
    $("#hzTarget").innerHTML = "";
    writer = HanziWriter.create("hzTarget", ch, {
      width: size, height: size, padding: 12,
      strokeColor: "#9d7bff", radicalColor: "#ff7eb6", outlineColor: "rgba(157,123,255,.18)",
      drawingColor: "#ff7eb6", highlightColor: "#6fa8ff", drawingWidth: 22,
      strokeAnimationSpeed: 1.1, delayBetweenStrokes: 140, showCharacter: false,
      onLoadCharDataError: () => { msg.textContent = "Не получилось загрузить иероглиф — проверь интернет 🌐"; },
    });
    const [py, ru] = INFO[ch] || ["", ""];
    info.innerHTML = "";
    const big = document.createElement("b"); big.textContent = py;
    const small = document.createElement("span"); small.textContent = ru;
    info.append(big, small);
    msg.textContent = "Нажми «показать порядок черт» или попробуй написать сама.";
  }
  CONFIG.practice.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hz-ch" + (i === 0 ? " on" : ""); b.textContent = c;
    b.addEventListener("click", () => {
      ch = c;
      [...$("#hzChars").children].forEach((x) => x.classList.toggle("on", x === b));
      make();
    });
    $("#hzChars").appendChild(b);
  });
  $("#hzShow").addEventListener("click", () => { writer.showOutline(); writer.animateCharacter(); msg.textContent = "Смотри: черты рисуются по порядку ✨"; });
  $("#hzQuiz").addEventListener("click", () => {
    writer.hideCharacter();
    msg.textContent = "Пиши черту за чертой. Ошиблась — подскажу 😉";
    writer.quiz({
      onMistake: (d) => { if (d.mistakesOnStroke >= 2) msg.textContent = "Почти! Подсветил, где начинать ✨"; },
      onCorrectStroke: (d) => { msg.textContent = `Отлично! Осталось черт: ${d.strokesRemaining}`; },
      onComplete: (d) => {
        msg.textContent = d.totalMistakes === 0 ? "Идеально, без единой ошибки! 你很棒! 🎉" : `Готово! Ошибок: ${d.totalMistakes}. 你很棒! ✨`;
        const [x, y] = center($("#hzTarget"));
        burst(x, y, 20, ["✨", "⭐", "🀄", ch]);
        try { SFX.twinkle(); } catch (e) {}
        achieve("hanzi", "Написала иероглиф ✍️");
      },
    });
  });
  make();
})();

/* ---------- 🕵️ the "leaked documents" joke ---------- */
(function dossier() {
  const body = $("#dsBody"), stamp = $("#dsStamp"), twist = $("#dsTwist"), btn = $("#dsBtn"), box = $("#dossier");
  if (!body) return;
  let busy = false;
  async function typeInto(el, text, speed = 28) {
    for (const ch of Array.from(text)) { el.textContent += ch; await sleep(speed); }
  }
  function bar(pct, cls) {
    const wrap = document.createElement("div"); wrap.className = "ds-bar " + (cls || "");
    const i = document.createElement("i"); wrap.appendChild(i);
    requestAnimationFrame(() => requestAnimationFrame(() => { i.style.width = pct + "%"; }));
    return wrap;
  }
  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true; btn.disabled = true;
    body.innerHTML = ""; twist.innerHTML = "";
    box.classList.remove("stamped", "done");
    for (const [k, v] of CONFIG.dossier) {
      const row = document.createElement("div"); row.className = "ds-row";
      const kEl = document.createElement("span"); kEl.className = "ds-k";
      const vEl = document.createElement("span"); vEl.className = "ds-v";
      row.append(kEl, vEl); body.appendChild(row);
      await typeInto(kEl, k + ":", 18);
      if (v.includes("█")) { vEl.classList.add("redacted"); vEl.textContent = v; await sleep(300); }
      else await typeInto(vEl, v, 40);
      if (v.trim().endsWith("%")) row.appendChild(bar(parseFloat(v), "low"));
      try { sound(220); } catch (e) {}
      await sleep(250);
    }
    await sleep(400);
    box.classList.add("stamped");
    try { sound(110); } catch (e) {}
    buzz(60);
    await sleep(1400);
    const p = document.createElement("p");
    twist.appendChild(p);
    await typeInto(p, CONFIG.dossierTwist, 32);
    box.classList.add("done");
    const [x, y] = center(twist);
    burst(x, y, 24, ["✨", "⭐", "💜", "🩵"]);
    achieve("dossier", "Рассекретила Дониёра 🕵️");
    btn.textContent = "🔁 ещё раз";
    btn.disabled = false; busy = false;
  });
})();

/* ---------- 🫂 the cheer-up button + breathing together ---------- */
(function cheerUp() {
  const btn = $("#cheerBtn"), msg = $("#cheerMsg");
  if (!btn) return;
  let last = -1, presses = 0;
  btn.addEventListener("click", (e) => {
    let i;
    do { i = Math.floor(Math.random() * CONFIG.cheers.length); } while (i === last && CONFIG.cheers.length > 1);
    last = i;
    msg.classList.remove("show"); void msg.offsetWidth;
    msg.textContent = CONFIG.cheers[i];
    msg.classList.add("show");
    btn.classList.remove("squish"); void btn.offsetWidth; btn.classList.add("squish");
    const [x, y] = center(btn);
    burst(x, y, 14, ["✨", "⭐", "💫", "🫶"]);
    ring(x, y, { size: 300, width: 3, color: "#b48cff" });
    buzz(15);
    if (++presses === 5) achieve("cheer", "Зарядилась поддержкой 🔋");
  });

  const bBtn = $("#breathBtn"), wrap = $("#breath"), ball = $("#breathBall"), txt = $("#breathTxt");
  let breathing = false;
  bBtn.addEventListener("click", async () => {
    if (breathing) return;
    breathing = true; bBtn.disabled = true;
    wrap.classList.add("show");
    const steps = [["вдох…", "grow", 4000], ["задержи…", "hold", 2000], ["выдох…", "shrink", 4000]];
    for (let round = 0; round < 3; round++) {
      for (const [word, cls, ms] of steps) {
        txt.textContent = `${word} (${round + 1}/3)`;
        ball.className = "breath-ball " + cls;
        ball.style.transitionDuration = ms + "ms";
        await sleep(ms);
      }
    }
    txt.textContent = "умница. стало чуть легче? ✨";
    ball.className = "breath-ball";
    achieve("breath", "Подышали вместе 🌬️");
    setTimeout(() => { wrap.classList.remove("show"); bBtn.disabled = false; breathing = false; }, 3500);
  });
})();

/* ---------- 🌌 connect the stars → her constellation ---------- */
(function constellation() {
  const cv = $("#sky");
  if (!cv) return;
  const c = cv.getContext("2d"), msg = $("#skyMsg");
  // the letter M, as stars
  const PTS = [[0.14, 0.84], [0.17, 0.5], [0.21, 0.17], [0.5, 0.6], [0.79, 0.17], [0.83, 0.5], [0.86, 0.84]];
  const bg = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.4, 1.4), ph: Math.random() * 6.28 }));
  let W = 0, H = 0, next = 0, lines = [], done = false, doneAt = 0, visible = false;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const pos = (i) => {
    const pad = Math.min(W, H) * 0.08, s = Math.min(W - pad * 2, (H - pad * 2) * 1.35);
    const ox = (W - s) / 2, oy = (H - s / 1.35) / 2;
    return [ox + PTS[i][0] * s, oy + PTS[i][1] * (s / 1.35)];
  };
  addEventListener("resize", resize);
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) { resize(); requestAnimationFrame(draw); } }).observe(cv);
  cv.addEventListener("pointerdown", (e) => {
    if (W !== cv.clientWidth || H !== cv.clientHeight) resize();
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);  // works even while it's zooming in
    if (done) { next = 0; lines = []; done = false; msg.textContent = ""; return; }
    const [px, py] = pos(next);
    if (Math.hypot(x - px, y - py) < 30) {
      if (next > 0) lines.push({ from: next - 1, to: next, t0: performance.now() });
      try { sound(523 * Math.pow(1.12, next)); } catch (err) {}
      burst(e.clientX, e.clientY, 6, ["✨", "⭐"]);
      next++;
      if (next === PTS.length) {
        done = true; doneAt = performance.now();
        setTimeout(() => {
          msg.textContent = `Созвездие «${CONFIG.herName}» ✨ Звёзды тоже знают, что ты особенная.`;
          Fireworks.show(5);
          achieve("sky", "Открыла своё созвездие ✨");
        }, 500);
      }
    } else {
      cv.animate([{ transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "none" }], { duration: 250 });
    }
  });
  function draw(t) {
    if (!visible) return;
    const time = t / 1000;
    c.clearRect(0, 0, W, H);
    for (const s of bg) {
      c.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 1.5 + s.ph));
      c.fillStyle = "#fff";
      c.beginPath(); c.arc(s.x * W, s.y * H, s.r, 0, 6.28); c.fill();
    }
    c.globalAlpha = 1;
    // lines grow from star to star
    c.lineCap = "round";
    for (const l of lines) {
      const k = Math.min(1, (t - l.t0) / 350);
      const [x1, y1] = pos(l.from), [x2, y2] = pos(l.to);
      c.strokeStyle = done ? `rgba(255,198,230,${0.7 + 0.3 * Math.sin(time * 3)})` : "rgba(200,180,255,.85)";
      c.lineWidth = done ? 3 : 2;
      c.shadowColor = "#b48cff"; c.shadowBlur = done ? 18 : 8;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); c.stroke();
    }
    c.shadowBlur = 0;
    PTS.forEach((_, i) => {
      const [x, y] = pos(i);
      const isNext = i === next && !done, lit = i < next;
      const pulse = isNext ? 1 + 0.35 * Math.sin(time * 5) : 1;
      const rr = (lit ? 6 : 4.5) * pulse * (done ? 1 + 0.2 * Math.sin(time * 4 + i) : 1);
      const g = c.createRadialGradient(x, y, 0, x, y, rr * 4);
      g.addColorStop(0, lit || done ? "rgba(255,230,250,1)" : "rgba(220,210,255,.9)");
      g.addColorStop(0.3, lit || done ? "rgba(255,150,210,.6)" : "rgba(160,140,255,.4)");
      g.addColorStop(1, "rgba(120,140,255,0)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rr * 4, 0, 6.28); c.fill();
      if (!lit && !done) {
        c.fillStyle = isNext ? "#fff" : "rgba(255,255,255,.55)";
        c.font = `700 ${isNext ? 14 : 12}px Nunito, sans-serif`; c.textAlign = "center";
        c.fillText(i + 1, x, y - 16);
      }
    });
    if (done) {
      const k = Math.min(1, (t - doneAt) / 800);
      c.globalAlpha = k;
      c.fillStyle = "#ffe6f5";
      c.font = `700 ${Math.max(22, Math.min(40, W / 14))}px Caveat, cursive`; c.textAlign = "center";
      c.fillText(CONFIG.herName, W / 2, H - 18);
      c.globalAlpha = 1;
    }
    requestAnimationFrame(draw);
  }
})();
