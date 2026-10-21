/* =====================================================================
   Письмо-книга: the letter opens as a 3D book. Every page is cut into
   thin vertical strips nested inside each other; turning a page rotates
   each strip a little more than the one before, so the paper really
   bends while you drag it. Drag or tap the right page to turn forward,
   the left one to go back. Text comes from CONFIG.letter / signOff.
   ===================================================================== */
const LetterBook = (function letterBook() {
  const STRIPS = 9;
  const ov = document.createElement("div");
  ov.id = "letterBook";
  ov.setAttribute("aria-hidden", "true");
  ov.innerHTML = `<div class="lb-stage"><div class="lb-book"></div></div>
    <div class="lb-nav"><button class="gpu-chip" type="button" data-lb="-1">‹ назад</button><span class="lb-num"></span><button class="gpu-chip on" type="button" data-lb="1">дальше ›</button></div>
    <p class="lb-hint">листай страницы пальцем 📖</p>
    <button class="x" type="button" aria-label="Закрыть">✕</button>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector(".lb-stage"), book = ov.querySelector(".lb-book"), num = ov.querySelector(".lb-num");

  let leaves = [], current = 0, pw = 300, ph = 420, anim = null, pages = 0;
  // on a phone only one page fits: after a turn we look at the left page, then slide to the right one
  let side = "right";
  const small = () => innerWidth < 640;

  /* ---------- pages ---------- */
  function pageSize() {
    const small = innerWidth < 640;
    pw = Math.round(Math.min(small ? innerWidth * 0.8 : innerWidth * 0.42, 340));
    ph = Math.round(Math.min(pw * 1.42, innerHeight * 0.68));
    book.style.width = pw * 2 + "px";
    book.style.height = ph + "px";
  }
  // pour the paragraphs into as many pages as needed (measured with a hidden page)
  function buildFaces() {
    const faces = [`<div class="lb-cover"><span class="lb-star">✦</span><b>Письмо</b><span>для ${CONFIG.herName}</span><i>от ${CONFIG.fromNameFrom || CONFIG.fromName}</i></div>`];
    const probe = document.createElement("div");
    probe.className = "lb-face lb-paper";
    probe.style.cssText = `position:fixed;left:-9999px;top:0;width:${pw}px;height:${ph}px;visibility:hidden`;
    document.body.appendChild(probe);
    const fits = () => probe.scrollHeight <= probe.clientHeight;
    let page = [];
    const paras = [...CONFIG.letter.map((t) => `<p>${escapeHtml(t)}</p>`), `<p class="lb-sign">${escapeHtml(CONFIG.signOff || "")}</p>`];
    for (const p of paras) {
      probe.innerHTML = [...page, p].join("");
      if (fits() || !page.length) page.push(p);
      else { faces.push(page.join("")); page = [p]; }
    }
    faces.push(page.join(""));
    probe.remove();
    for (let i = 1; i < faces.length; i++) faces[i] = `<div class="lb-text">${faces[i]}</div><span class="lb-pg">${i}</span>`;
    if (faces.length % 2) faces.push(`<div class="lb-end">加油 ✦</div>`);
    return faces;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

  function build() {
    pageSize();
    const faces = buildFaces(), s = pw / STRIPS;
    pages = faces.length - 1;
    book.innerHTML = "";
    leaves = [];
    for (let i = 0; i < faces.length / 2; i++) {
      const leaf = document.createElement("div");
      leaf.className = "lb-leaf";
      leaf.style.width = pw + "px";
      // a whole, seam-free copy of both sides, shown while the page lies flat
      leaf.innerHTML = `<div class="lb-flat"><div class="lb-slice"><div class="lb-face ${i ? "lb-paper" : "lb-cov"}" style="width:${pw}px;left:0">${faces[i * 2]}</div></div>` +
        `<div class="lb-slice lb-back"><div class="lb-face lb-paper" style="width:${pw}px;left:0">${faces[i * 2 + 1]}</div></div></div>`;
      let parent = leaf;
      const strips = [];
      for (let k = 0; k < STRIPS; k++) {
        const strip = document.createElement("div");
        strip.className = "lb-strip";
        strip.style.width = s + "px";
        if (k) strip.style.left = "100%";
        // front shows columns from the spine outwards, back shows them mirrored
        strip.innerHTML =
          `<div class="lb-slice"><div class="lb-face ${i ? "lb-paper" : "lb-cov"}" style="width:${pw}px;left:${-k * s}px">${faces[i * 2]}</div><i class="lb-shade"></i></div>` +
          `<div class="lb-slice lb-back"><div class="lb-face lb-paper" style="width:${pw}px;left:${-(pw - (k + 1) * s)}px">${faces[i * 2 + 1]}</div><i class="lb-shade"></i></div>`;
        parent.appendChild(strip);
        strips.push(strip);
        parent = strip;
      }
      book.appendChild(leaf);
      leaves.push({ el: leaf, strips, flat: leaf.firstChild, p: 0 });
    }
    current = 0;
    side = "right";
    layout();
  }

  /* ---------- bending ---------- */
  // p: 0 = lying on the right, 1 = turned to the left
  function bend(leaf, p) {
    leaf.p = p;
    const still = p === 0 || p === 1;
    leaf.el.classList.toggle("still", still);
    leaf.flat.style.transform = `rotateY(${-180 * p}deg)`;
    if (still) return;
    // the free edge leads the spine side a little, so the paper curves
    const curl = Math.sin(p * Math.PI) * 36, base = Math.max(0, p * 180 - curl / 2);
    let total = 0;
    leaf.strips.forEach((st, k) => {
      const a = k ? (curl * k) / ((STRIPS * (STRIPS - 1)) / 2) : base;
      total += a;
      st.style.transform = `rotateY(${-a}deg)`;
      const shade = (1 - Math.abs(Math.cos((total * Math.PI) / 180))) * 0.45;
      for (const sl of st.children) if (sl.classList.contains("lb-slice")) sl.lastChild.style.opacity = shade;
    });
  }
  function layout() {
    leaves.forEach((l, i) => {
      l.el.style.zIndex = i < current ? i + 1 : leaves.length - i;
      bend(l, i < current ? 1 : 0);
    });
    const shift = small()
      ? (current && side === "left" ? pw / 2 : -pw / 2)
      : current === leaves.length ? pw / 2 : current === 0 ? -pw / 2 : 0;
    book.style.transform = `translateX(${shift}px)`;
    const page = small() ? current * 2 - (side === "left" ? 1 : 0) : current;
    num.textContent = !current ? "обложка" : small() ? `${Math.min(page, pages)} / ${pages}` : `${current} / ${leaves.length}`;
    if (current === leaves.length) achieve("letter", "Прочитала секретное письмо 💌");
  }
  function animateTo(i, from, to, done) {
    cancelAnimationFrame(anim);
    const leaf = leaves[i], t0 = performance.now(), dur = 520 * Math.abs(to - from) + 120;
    leaf.el.style.zIndex = 100;
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      bend(leaf, from + (to - from) * e);
      if (t < 1) anim = requestAnimationFrame(step);
      else done();
    })(t0);
  }
  function turn(dir) {
    if (small() && current) {
      // slide between the two pages of the open spread instead of turning
      if (dir > 0 && side === "left" && current < leaves.length) { side = "right"; return layout(); }
      if (dir < 0 && side === "right") { side = "left"; return layout(); }
    }
    if (dir > 0 && current < leaves.length) { const i = current; animateTo(i, leaves[i].p, 1, () => { current = i + 1; side = "left"; layout(); }); }
    if (dir < 0 && current > 0) { const i = current - 1; animateTo(i, leaves[i].p, 0, () => { current = i; side = "right"; layout(); }); }
    rustle();
  }
  // soft paper sound: a short burst of filtered noise
  function rustle() {
    if (typeof actx === "undefined" || !actx || actx.state !== "running") return;
    const len = actx.sampleRate * 0.3, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 2400; f.Q.value = 0.7; g.gain.value = 0.18;
    src.connect(f); f.connect(g); g.connect(typeof master !== "undefined" && master ? master : actx.destination);
    src.start();
  }

  /* ---------- drag ---------- */
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (small()) { drag = { x0: e.clientX, phone: true }; return; }
    const r = book.getBoundingClientRect(), spine = r.left + r.width / 2;
    const forward = innerWidth < 640 ? e.clientX > innerWidth * 0.3 : e.clientX > spine;
    const i = forward ? current : current - 1;
    if (i < 0 || i >= leaves.length) return;
    drag = { x0: e.clientX, i, forward, p0: leaves[i].p, moved: 0 };
    leaves[i].el.style.zIndex = 100;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || drag.phone) return;
    const dx = e.clientX - drag.x0;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    const p = Math.max(0, Math.min(1, drag.p0 - dx / (pw * 1.5)));
    bend(leaves[drag.i], p);
  });
  stage.addEventListener("pointerup", (e) => {
    if (!drag) return;
    if (drag.phone) {   // phone: swipe or tap left/right
      const dx = e.clientX - drag.x0;
      drag = null;
      return turn(Math.abs(dx) > 30 ? (dx < 0 ? 1 : -1) : e.clientX > innerWidth / 2 ? 1 : -1);
    }
    const { i, forward, moved, p0 } = drag, p = leaves[i].p;
    drag = null;
    const to = moved < 6 ? (forward ? 1 : 0) : forward ? (p > 0.3 ? 1 : 0) : p < 0.7 ? 0 : 1;
    if (to !== p0) rustle();
    animateTo(i, p, to, () => { current = to ? i + 1 : i; layout(); });
  });

  ov.querySelectorAll("[data-lb]").forEach((b) => b.addEventListener("click", () => turn(+b.dataset.lb)));
  function close() { ov.classList.remove("show"); ov.setAttribute("aria-hidden", "true"); }
  ov.querySelector(".x").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  addEventListener("keydown", (e) => {
    if (!ov.classList.contains("show")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") turn(1);
    if (e.key === "ArrowLeft") turn(-1);
  });
  addEventListener("resize", () => ov.classList.contains("show") && build());

  return {
    async open() {
      build();
      ov.classList.add("show");
      ov.removeAttribute("aria-hidden");
      await sleep(900);
      if (current === 0) turn(1);          // the cover opens by itself
    },
  };
})();
