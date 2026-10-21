/* =====================================================================
   Финал: a few seconds after she presses «Да», a black hole opens in
   the middle of the screen and everything on it spirals in. It shrinks
   to a point, flashes — and a new universe of a million stars bursts
   out and writes «加油, Марьям». Buttons bring the site back or play
   the credits.
   ===================================================================== */
(function blackHoleFinale() {
  if (reduceMotion || typeof BlackHoleRenderer === "undefined" || typeof StarField === "undefined") return;
  const words = CONFIG.finaleWords || "加油,\nМарьям";
  const line = CONFIG.finaleLine || "Даже если всё вокруг затянет в чёрную дыру — из неё родится новая вселенная. А ты справишься со всем. 加油!";

  const ov = document.createElement("div");
  ov.id = "bhFinale";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = `<canvas class="fin-bh"></canvas><canvas class="fin-stars"></canvas><div class="fin-flash"></div>
    <div class="fin-ui"><p class="fin-line"></p><div class="fin-btns">
      <button class="btn" type="button" data-fin="credits">🎬 титры</button>
      <button class="btn soft" type="button" data-fin="back">↺ вернуться</button></div></div>`;
  document.body.appendChild(ov);
  const bhCv = ov.querySelector(".fin-bh"), starCv = ov.querySelector(".fin-stars"), ui = ov.querySelector(".fin-ui");
  ov.querySelector(".fin-line").textContent = line;

  let render, field, swallowed = [], busy = false, done = false;
  document.addEventListener("ella:yes", () => {
    if (done) return;
    done = true;
    setTimeout(function wait() {
      // let the credits finish first if she opened them straight away
      if ($("#credits").classList.contains("show")) return setTimeout(wait, 1500);
      run();
    }, 4500);
  });

  const ease = (x) => x * x * (3 - 2 * x);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // deep rumble that rises while things fall in
  function rumble() {
    if (typeof actx === "undefined" || !actx || actx.state !== "running") return;
    const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = "sine"; o.frequency.setValueAtTime(38, t); o.frequency.exponentialRampToValueAtTime(90, t + 4.6);
    o2.type = "triangle"; o2.frequency.setValueAtTime(57, t); o2.frequency.exponentialRampToValueAtTime(180, t + 4.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 3.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    o.connect(g); o2.connect(g); g.connect(typeof master !== "undefined" && master ? master : actx.destination);
    o.start(t); o2.start(t); o.stop(t + 5.1); o2.stop(t + 5.1);
  }

  // every visible block on screen spirals into the centre
  function swallow() {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const els = [...document.querySelectorAll("#main section > *, #main footer > *, #musicBtn, #progress")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    });
    swallowed = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const frames = [];
      for (let k = 0; k <= 10; k++) {
        const f = k / 10, ang = f * f * Math.PI * 1.7, rad = Math.pow(1 - f, 1.4);
        const x = (dx * Math.cos(ang) - dy * Math.sin(ang)) * rad, y = (dx * Math.sin(ang) + dy * Math.cos(ang)) * rad;
        frames.push({ transform: `translate(${x - dx}px, ${y - dy}px) rotate(${ang * 57}deg) scale(${1 - f * 0.97})`, opacity: f > 0.8 ? (1 - f) * 5 : 1, filter: `blur(${f * 5}px)` });
      }
      return el.animate(frames, { duration: 2600, delay: 300 + i * 90 + Math.random() * 300, easing: "cubic-bezier(.55,0,.85,.4)", fill: "forwards" });
    });
  }

  async function run() {
    if (busy) return;
    busy = true;
    window.scrollTo({ top: $("#qBox").getBoundingClientRect().top + scrollY - innerHeight * 0.3, behavior: "smooth" });
    await sleep(700);
    try {
      const scale = innerWidth < 700 ? 0.5 : 0.6;
      bhCv.width = Math.round(innerWidth * scale); bhCv.height = Math.round(innerHeight * scale);
      render = render || BlackHoleRenderer(bhCv, true);
      if (!render) throw new Error("no WebGL2");
    } catch (err) { console.warn("finale:", err); busy = false; return; }

    document.body.classList.add("fin-on");
    ov.classList.add("show");
    ov.removeAttribute("aria-hidden");
    rumble();
    swallow();

    const t0 = performance.now(), dist0 = innerWidth < innerHeight ? 22 : 16;
    let yaw = 0.4;
    await new Promise((resolve) => {
      (function tick(now) {
        const t = (now - t0) / 1000;
        if (t > 5) return resolve();
        requestAnimationFrame(tick);
        const grow = ease(clamp01(t / 1.4)), shrink = ease(clamp01((t - 4.1) / 0.8));
        yaw += 0.01 + shrink * 0.2;
        ov.style.setProperty("--dark", clamp01((t - 2.3) / 1.5));
        render({ t, yaw, pitch: 0.18, dist: 160 - grow * (160 - dist0) + shrink * 400, sky: clamp01((t - 2.6) / 1.4) });
      })(t0);
    });

    // collapse → flash → a new universe
    ov.classList.add("flash");
    bhCv.style.opacity = 0;
    try {
      field = field || StarField(starCv);
      if (field) { field.start(); field.setShape(words); field.bigBang(0, 0); }
    } catch (err) { console.warn("finale stars:", err); }
    if (typeof Fireworks !== "undefined") setTimeout(() => Fireworks.show(6), 900);
    await sleep(2600);
    ui.classList.add("show");
    achieve("finale", "Пережила чёрную дыру 🕳️✨");
    busy = false;
  }

  function back() {
    swallowed.forEach((a) => a.cancel());
    swallowed = [];
    if (field) field.stop();
    ov.classList.remove("show", "flash");
    ui.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
    bhCv.style.opacity = "";
    ov.style.setProperty("--dark", 0);
    document.body.classList.remove("fin-on");
  }
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fin]");
    if (!b) return;
    back();
    if (b.dataset.fin === "credits") $("#creditsBtn").click();
  });
})();
