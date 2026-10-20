/* =====================================================================
   More stuff: night mode + shooting stars, the story timeline,
   "I love you" in 20 languages (with a real voice), a code editor that
   says I love you in 5 programming languages, magnetic buttons,
   sound effects, secret codes and the installable-app setup.
   ===================================================================== */

/* ---------- tiny sound effects ---------- */
const SFX = (() => {
  function tone(freq, t0, dur, vol, type = "sine", slideTo) {
    const ctx = audio(), t = ctx.currentTime + t0;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    pop() { try { tone(620, 0, 0.12, 0.05, "sine", 320); } catch (e) {} },
    chime() { try { tone(1046, 0, 0.5, 0.06); tone(1568, 0.09, 0.7, 0.05); tone(2093, 0.18, 0.8, 0.03); } catch (e) {} },
    whoosh() {
      try {
        const ctx = audio(), len = ctx.sampleRate * 0.35, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = buf; bp.type = "bandpass"; bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(400, ctx.currentTime); bp.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.3);
        g.gain.value = 0.08;
        src.connect(bp).connect(g).connect(master); src.start();
      } catch (e) {}
    },
    twinkle() { try { [1318, 1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.07, 0.5, 0.035)); } catch (e) {} },
  };
})();
// every achievement gets a little chime
{
  const original = achieve;
  achieve = (id, title) => { if (!unlocked.has(id)) SFX.chime(); original(id, title); };
}
document.addEventListener("click", (e) => {
  if (!document.body.classList.contains("entered")) return;
  if (e.target.closest(".flip")) SFX.whoosh();
  else if (e.target.closest("button")) SFX.pop();
});

/* ---------- magnetic buttons (they lean toward the mouse) ---------- */
if (finePointer && !reduceMotion) {
  const magnet = (el, pull = 0.28) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * pull}px ${(e.clientY - r.top - r.height / 2) * pull}px`;
    });
    el.addEventListener("pointerleave", () => { el.style.translate = ""; });
  };
  document.querySelectorAll(".btn, #musicBtn, #nightBtn, .piano-top button, .ed-run").forEach((el) => magnet(el));
}

/* ---------- night mode + shooting stars ---------- */
(function nightMode() {
  const btn = $("#nightBtn");
  let starTimer = null;
  if (!btn) { document.addEventListener("ella:enter", () => scheduleStar(3500)); }
  function set(on, fromUser) {
    document.body.classList.toggle("night", on);
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    if (fromUser) {
      const [x, y] = center(btn);
      burst(x, y, 14, on ? ["⭐", "🌙", "✨"] : ["☀️", "🌸", "✨"]);
      SFX.twinkle();
    }
    if (on) scheduleStar(1500);
    else clearTimeout(starTimer);
  }
  function scheduleStar(ms) { clearTimeout(starTimer); starTimer = setTimeout(shootingStar, ms ?? rand(3500, 8000)); }
  function shootingStar() {
    if (!document.body.classList.contains("night") || document.hidden) return scheduleStar();
    const s = document.createElement("button");
    s.className = "shoot"; s.type = "button"; s.setAttribute("aria-label", "Падающая звезда — загадай желание");
    document.body.appendChild(s);
    const x0 = rand(innerWidth * 0.35, innerWidth * 1.05), y0 = rand(-20, innerHeight * 0.3);
    const dist = rand(400, 700), ang = rand(140, 160) * Math.PI / 180;
    const anim = s.animate([
      { transform: `translate(${x0}px, ${y0}px) rotate(${ang}rad) scaleX(.2)`, opacity: 0 },
      { transform: `translate(${x0 + Math.cos(ang) * dist * 0.3}px, ${y0 + Math.sin(ang) * dist * 0.3}px) rotate(${ang}rad) scaleX(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${x0 + Math.cos(ang) * dist}px, ${y0 + Math.sin(ang) * dist}px) rotate(${ang}rad) scaleX(.6)`, opacity: 0 },
    ], { duration: 2200, easing: "cubic-bezier(.3,.1,.6,1)" });
    anim.onfinish = () => s.remove();
    s.addEventListener("pointerdown", (e) => {
      burst(e.clientX, e.clientY, 18, ["⭐", "✨", "💫", "🌟"]);
      ring(e.clientX, e.clientY, { size: 240, color: "#fff4b8" });
      SFX.twinkle();
      achieve("wish", "Поймала падающую звезду — загадай желание ⭐");
      s.remove();
    });
    scheduleStar();
  }
  if (btn) btn.addEventListener("click", () => set(!document.body.classList.contains("night"), true));
  if (btn) document.addEventListener("ella:enter", () => {
    btn.classList.add("show");
    const h = new Date().getHours();
    if (h >= 20 || h < 6) setTimeout(() => set(true, false), 2500); // opened at night? the sky turns dark by itself
  });
})();

/* ---------- our story: a timeline that draws itself as you scroll ---------- */
(function timeline() {
  const tl = $("#timeline");
  if (!tl) return;
  const DAY = 864e5;
  const addDays = (n) => new Date(START.getFullYear(), START.getMonth(), START.getDate() + n);
  const addMonths = (n) => new Date(START.getFullYear(), START.getMonth() + n, START.getDate());
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayNum = Math.floor((today - START) / DAY) + 1;
  const items = [
    { date: START, icon: "💗", title: "Day one", text: `The day it all started. Best day ever.` },
    { date: addMonths(1), icon: "🌸", title: "One month", text: "Officially not a phase." },
    { date: addDays(99), icon: "💯", title: "100 days", text: "A big deal in Korea 🇰🇷 — and to me." },
    { date: addMonths(6), icon: "🎀", title: "Half a year", text: "Six months with my favorite person." },
    { date: addDays(199), icon: "✨", title: "200 days", text: "Still the cutest. Still counting." },
    { date: addDays(299), icon: "🐰", title: "300 days", text: "300 days of you being amazing." },
    { date: new Date(START.getFullYear() + 1, START.getMonth(), START.getDate()), icon: "🎂", title: "Our first anniversary", text: "One whole year of us. Cake is mandatory." },
  ];
  items.push({ date: today, icon: "📍", title: "Today", text: `Day ${dayNum.toLocaleString("en-US")} — you are here 💗`, today: true });
  items.sort((a, b) => a.date - b.date || (a.today ? 1 : -1));
  const nextUp = items.find((it) => !it.today && it.date > today);

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "tl-line");
  const base = document.createElementNS(svgNS, "path"), prog = document.createElementNS(svgNS, "path");
  base.setAttribute("class", "tl-base"); prog.setAttribute("class", "tl-prog");
  svg.append(base, prog);
  tl.appendChild(svg);
  const heart = document.createElement("span");
  heart.className = "tl-heart"; heart.textContent = "💗";
  tl.appendChild(heart);

  const els = items.map((it, i) => {
    const el = document.createElement("div");
    const future = !it.today && it.date > today;
    el.className = `tl-item ${i % 2 ? "right" : "left"}${future ? " future" : ""}${it.today ? " today" : ""}${it === nextUp ? " next" : ""}`;
    el.innerHTML = `<span class="tl-dot"></span>
      <div class="tl-card">
        <div class="tl-top"><span class="tl-ico"></span><span class="tl-date"></span></div>
        <h4></h4><p></p>${future ? '<span class="tl-count"></span>' : ""}
      </div>`;
    el.querySelector(".tl-ico").textContent = it.icon;
    el.querySelector(".tl-date").textContent = it.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    el.querySelector("h4").textContent = it.title + (future ? "" : it.today ? "" : " ✓");
    el.querySelector("p").textContent = it.text;
    tl.appendChild(el);
    return { el, it };
  });

  function countdowns() {
    for (const { el, it } of els) {
      const c = el.querySelector(".tl-count");
      if (!c) continue;
      let ms = it.date - Date.now();
      const d = Math.floor(ms / DAY); ms -= d * DAY;
      const h = Math.floor(ms / 36e5); ms -= h * 36e5;
      const m = Math.floor(ms / 6e4); const s = Math.floor((ms - m * 6e4) / 1000);
      c.textContent = it === nextUp ? `next up · in ${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `in ${d + 1} days`;
    }
  }
  countdowns(); setInterval(countdowns, 1000);

  let len = 0, H = 0;
  function layout() {
    const W = tl.clientWidth; H = tl.clientHeight;
    const x = W < 700 ? 26 : W / 2, amp = W < 700 ? 5 : 9;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let d = `M ${x} 0`;
    for (let y = 8; y <= H; y += 8) d += ` L ${(x + Math.sin(y / 46) * amp).toFixed(1)} ${y}`;
    base.setAttribute("d", d); prog.setAttribute("d", d);
    len = prog.getTotalLength();
    prog.style.strokeDasharray = len;
    update();
  }
  let ticking = false;
  function update() {
    ticking = false;
    if (!len) return;
    const r = tl.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight * 0.62 - r.top) / r.height));
    prog.style.strokeDashoffset = len * (1 - p);
    const pt = prog.getPointAtLength(len * p);
    heart.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%,-50%) scale(${p > 0 && p < 1 ? 1 : 0.6})`;
    const reach = p * H;
    for (const { el, it } of els) {
      if (!el.classList.contains("lit") && el.offsetTop + 27 <= reach + 2) {
        el.classList.add("lit");
        if (it.today) { const [hx, hy] = center(el.querySelector(".tl-dot")); burst(hx, hy, 12); }
      }
    }
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  new ResizeObserver(layout).observe(tl);
  document.addEventListener("ella:enter", () => setTimeout(layout, 300));
})();

/* ---------- "I love you" in 20 languages, on a spinning word sphere ---------- */
(function languages() {
  const sphere = $("#sphere");
  if (!sphere) return;
  const LANGS = [
    ["I love you", "English", "en-US", "the classic"],
    ["사랑해", "Korean", "ko-KR", "sa-rang-hae · Stray Kids approved 🎤"],
    ["愛してる", "Japanese", "ja-JP", "ai-shi-te-ru"],
    ["Je t'aime", "French", "fr-FR", "zhuh tem"],
    ["Te amo", "Spanish", "es-ES", "teh AH-mo"],
    ["Ti amo", "Italian", "it-IT", "tee AH-mo"],
    ["Ich liebe dich", "German", "de-DE", "ish LEE-buh dish"],
    ["Eu te amo", "Portuguese", "pt-BR", "eh-oo chee AH-mo"],
    ["我爱你", "Chinese", "zh-CN", "wǒ ài nǐ"],
    ["Я тебя люблю", "Russian", "ru-RU", "ya tee-BYA lyu-BLYU"],
    ["Seni seviyorum", "Turkish", "tr-TR", "seh-NEE seh-vee-YO-room"],
    ["Kocham cię", "Polish", "pl-PL", "KO-ham chyeh"],
    ["Ik hou van je", "Dutch", "nl-NL", "ik how fan yuh"],
    ["Σ'αγαπώ", "Greek", "el-GR", "sa-ga-PO"],
    ["Mahal kita", "Filipino", "fil-PH", "ma-HAL kee-TA"],
    ["Aloha au iā ʻoe", "Hawaiian", "haw-US", "ah-LO-ha ow EE-ah OH-eh"],
    ["Jeg elsker deg", "Norwegian", "nb-NO", "yai EL-sker dai"],
    ["Te iubesc", "Romanian", "ro-RO", "teh yoo-BESK"],
    ["Rakastan sinua", "Finnish", "fi-FI", "RA-kas-tan SI-nu-a"],
    ["Volim te", "Croatian", "hr-HR", "VO-lim teh"],
  ];
  LANGS.length = 0;
  for (const [w, py, ru] of CONFIG.chinese) LANGS.push([w, ru, "zh-CN", py]);
  const N = LANGS.length;
  const pts = LANGS.map((_, i) => {           // spread evenly on a sphere (Fibonacci sphere)
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(th) * r, y, Math.sin(th) * r];
  });
  const spans = LANGS.map(([word], i) => {
    const s = document.createElement("button");
    s.type = "button"; s.className = "w3"; s.textContent = word;
    s.addEventListener("click", () => { auto = false; select(i, true); });
    sphere.appendChild(s);
    return s;
  });
  const card = $("#lpCard"), wEl = $("#lpWord"), lEl = $("#lpLang"), sEl = $("#lpSay");
  let current = -1, auto = true;
  const heard = new Set();
  function speak(i) {
    if (!("speechSynthesis" in window)) return;
    const [word, , lang] = LANGS[i];
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang; u.rate = 0.85; u.pitch = 1.15;
    const v = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function select(i, byUser) {
    if (current >= 0) spans[current].classList.remove("sel");
    current = i;
    spans[i].classList.add("sel");
    const [word, lang, , say] = LANGS[i];
    wEl.textContent = word; lEl.textContent = lang; sEl.textContent = say;
    card.classList.remove("flip"); void card.offsetWidth; card.classList.add("flip");
    if (byUser) {
      speak(i);
      const [x, y] = center(spans[i]);
      burst(x, y, 8, ["✨", "⭐", "🀄"]);
      heard.add(i);
      if (heard.size >= 5) achieve("polyglot", "Маленький китаист 🀄");
    }
  }
  $("#lpSpeak").addEventListener("click", () => { if (current >= 0) speak(current); });
  select(1, false);
  setInterval(() => { if (auto && visible) select((current + 1) % N, false); }, 3200);

  let ay = 0, ax = 0.3, vy = 0.004, vx = 0, visible = false, drag = false, lx = 0, ly = 0;
  sphere.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
  addEventListener("pointerup", () => { drag = false; });
  addEventListener("pointermove", (e) => {
    if (!drag) return;
    vy = (e.clientX - lx) * 0.0016; vx = (e.clientY - ly) * 0.0012;
    lx = e.clientX; ly = e.clientY;
  });
  new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) requestAnimationFrame(frame); }).observe(sphere);
  function frame() {
    if (!visible) return;
    if (!drag) { vy += (0.004 - vy) * 0.02; vx *= 0.96; }
    ay += vy; ax += vx; ax += (0.3 - ax) * 0.01;
    const R = Math.min(sphere.clientWidth, sphere.clientHeight) * 0.42;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    pts.forEach(([x, y, z], i) => {
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
      const depth = (z2 + 1) / 2;   // 0 = back, 1 = front
      const s = spans[i];
      s.style.transform = `translate(-50%,-50%) translate(${x1 * R * 1.25}px, ${y2 * R}px) scale(${0.55 + depth * 0.65})`;
      s.style.opacity = 0.25 + depth * 0.75;
      s.style.zIndex = Math.round(depth * 100);
      s.style.filter = depth < 0.35 ? `blur(${(0.35 - depth) * 4}px)` : "";
    });
    requestAnimationFrame(frame);
  }
})();

/* ---------- a code editor that types "I love you" in 5 languages ---------- */
(function codeEditor() {
  const ed = $("#editor");
  if (!ed) return;
  const her = CONFIG.herName, me = CONFIG.fromName;
  const [y, m, d] = [START.getFullYear(), START.getMonth(), START.getDate()];
  const days = () => Math.floor((Date.now() - START) / 864e5);
  const SNIPS = [
    {
      name: "Python", file: "love.py", cmd: "python3 love.py", comment: "#",
      kw: "import|def|while|if|return|print|True|False|try|except|as|raise|for|in|not|and|or",
      code: [
        `# love.py — written by ${me}, for ${her}`,
        "import time",
        "",
        `${her.toLowerCase()} = {"name": "${her}", "cute": True, "favorite": True}`,
        "",
        "def how_much_i_love(person):",
        "    love = 0",
        "    while True:",
        "        love += 1",
        "        if love > 10 ** 100:",
        "            raise OverflowError(\"too much love 💥\")",
        "",
        "try:",
        `    how_much_i_love(${her.toLowerCase()})`,
        "except OverflowError as e:",
        "    print(\"error:\", e)",
        `    print(f"conclusion: I love you, {${her.toLowerCase()}['name']} 💗")`,
      ],
      out: () => ["error: too much love 💥", `conclusion: I love you, ${her} 💗`],
    },
    {
      name: "JavaScript", file: "days.js", cmd: "node days.js", comment: "//",
      kw: "const|let|for|of|if|return|new|function|true|false",
      code: [
        "// days.js — counting every single one",
        `const ${her.toLowerCase()} = { name: "${her}", favorite: true };`,
        `const start = new Date(${y}, ${m}, ${d});`,
        "const days = Math.floor((Date.now() - start) / 864e5);",
        "",
        `console.log(\`\${days} days with \${${her.toLowerCase()}.name}\`);`,
        "for (const reason of [\"sweet\", \"creative\", \"helpful\"]) {",
        "  console.log(`I love you because you're ${reason}`);",
        "}",
      ],
      out: () => [`${days()} days with ${her}`, "I love you because you're sweet", "I love you because you're creative", "I love you because you're helpful"],
    },
    {
      name: "C++", file: "heart.cpp", cmd: "g++ heart.cpp -o heart && ./heart", comment: "//",
      kw: "#include|int|for|while|return|std|string|cout|endl|main",
      code: [
        "// heart.cpp",
        "#include <iostream>",
        "#include <string>",
        "",
        "int main() {",
        `    std::string her = "${her}";`,
        "    for (int beat = 0; beat < 3; beat++) {",
        "        std::cout << \"ba-dum 💓\" << std::endl;",
        "    }",
        "    std::cout << \"my heart belongs to \" << her << std::endl;",
        "    return 0; // not returning it though",
        "}",
      ],
      out: () => ["ba-dum 💓", "ba-dum 💓", "ba-dum 💓", `my heart belongs to ${her}`],
    },
    {
      name: "Rust", file: "main.rs", cmd: "cargo run", comment: "//",
      kw: "fn|let|mut|String|from|println|loop|impl|struct",
      code: [
        "// main.rs",
        "fn main() {",
        `    let her = String::from("${her}");`,
        "    let my_heart: &String = &her; // borrowed forever",
        "    println!(\"{} has my heart 🦀💗\", my_heart);",
        "    // even the borrow checker approves of us",
        "}",
      ],
      out: () => ["   Compiling love v1.0.0", "    Finished release [optimized] target(s)", `${her} has my heart 🦀💗`],
    },
    {
      name: "SQL", file: "who.sql", cmd: "sqlite3 love.db < who.sql", comment: "--",
      kw: "SELECT|FROM|WHERE|ORDER|BY|DESC|LIMIT|TRUE|AND",
      code: [
        "-- who.sql",
        "SELECT name, reason",
        "FROM   people_i_love",
        "WHERE  favorite = TRUE",
        "ORDER  BY cuteness DESC",
        "LIMIT  1;",
      ],
      out: () => {
        const r = "literally everything";
        const w1 = Math.max(4, her.length), w2 = r.length;
        const line = `+${"-".repeat(w1 + 2)}+${"-".repeat(w2 + 2)}+`;
        return [line, `| ${"name".padEnd(w1)} | ${"reason".padEnd(w2)} |`, line, `| ${her.padEnd(w1)} | ${r} |`, line, "(1 row) — it's always her 💗"];
      },
    },
  ];

  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function tokenize(sn) {
    const code = sn.code.join("\n");
    const com = sn.comment === "#" ? "#.*" : sn.comment === "--" ? "--.*" : "\\/\\/.*";
    const re = new RegExp(`(${com})|("(?:[^"\\\\\\n]|\\\\.)*"|'(?:[^'\\\\\\n]|\\\\.)*'|\`[^\`]*\`)|(\\b\\d+(?:\\.\\d+)?(?:e\\d+)?\\b)|(${sn.kw.split("|").map((k) => k.startsWith("#") ? k : `\\b${k}\\b`).join("|")})|(\\b[A-Za-z_]\\w*(?=\\s*[(!]))`, "g");
    const toks = [];
    let last = 0, mt;
    while ((mt = re.exec(code))) {
      if (mt.index > last) toks.push({ t: code.slice(last, mt.index), c: "" });
      const c = mt[1] ? "tk-c" : mt[2] ? "tk-s" : mt[3] ? "tk-n" : mt[4] ? "tk-k" : "tk-f";
      toks.push({ t: mt[0], c });
      last = re.lastIndex;
    }
    if (last < code.length) toks.push({ t: code.slice(last), c: "" });
    return { toks, total: code.length, lines: sn.code.length };
  }
  const tabs = $("#edTabs"), codeEl = $("#edCode"), linesEl = $("#edLines"), fileEl = $("#edFile"), cons = $("#edConsole");
  let cur = 0, typed = 0, data = null, typing = false, running = false;

  function render() {
    let left = typed, html = "";
    for (const tk of data.toks) {
      if (left <= 0) break;
      const part = tk.t.slice(0, left);
      left -= part.length;
      html += tk.c ? `<span class="${tk.c}">${esc(part)}</span>` : esc(part);
    }
    codeEl.innerHTML = html + '<span class="ed-caret"></span>';
  }
  function open(i) {
    cur = i;
    [...tabs.children].forEach((t, k) => t.classList.toggle("on", k === i));
    data = tokenize(SNIPS[i]);
    fileEl.textContent = SNIPS[i].file;
    linesEl.textContent = Array.from({ length: data.lines }, (_, k) => k + 1).join("\n");
    cons.innerHTML = '<span class="p">ready.</span> press ▶ run';
    typed = 0;
    if (!typing) { typing = true; requestAnimationFrame(step); }
  }
  function step() {
    typed = Math.min(data.total, typed + 3);
    render();
    if (typed < data.total) requestAnimationFrame(step); else typing = false;
  }
  SNIPS.forEach((sn, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "ed-tab"; b.textContent = sn.name;
    b.addEventListener("click", () => open(i));
    tabs.appendChild(b);
  });
  const ran = new Set();
  $("#edRun").addEventListener("click", async () => {
    if (running) return;
    running = true;
    typed = data.total; render();
    const sn = SNIPS[cur];
    cons.textContent = "";
    const add = (text, cls) => { const l = document.createElement("div"); if (cls) l.className = cls; l.textContent = text; cons.appendChild(l); return l; };
    add(`$ ${sn.cmd}`, "p");
    await sleep(500);
    for (const line of sn.out()) { add(line); await sleep(260); }
    const [x, y] = center(cons);
    burst(x, y, 14, ["💗", "💻", "✨"]);
    ran.add(cur);
    achieve("code", "Ran Cooper's code 💻");
    if (ran.size === SNIPS.length) achieve("allcode", "Full-stack girlfriend 👩‍💻");
    running = false;
  });
  let started = false;
  new IntersectionObserver((en) => { if (en[0].isIntersecting && !started) { started = true; open(0); } }, { threshold: 0.3 }).observe(ed);
})();

/* ---------- secret codes ---------- */
(function secrets() {
  let buf = "";
  function bigLove() {
    Fireworks.show(8); heartRain(90); flash(0.4, 600);
    achieve("secret", "Нашла секретный код 🔍");
  }
  function stayMode() {
    let st = $(".stage-lights");
    if (!st) {
      st = document.createElement("div");
      st.className = "stage-lights";
      st.innerHTML = "<i></i><i></i><i></i><i></i>";
      document.body.appendChild(st);
    }
    st.classList.add("on");
    heartRain(40);
    achieve("stay", "Режим концерта 🎤");
    setTimeout(() => st.classList.remove("on"), 8000);
  }
  addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("entered")) return;
    if (e.target && e.target.closest && e.target.closest("input, textarea")) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-12);
    if (buf.endsWith(CONFIG.herName.toLowerCase()) || buf.endsWith("maryam")) { buf = ""; bigLove(); }
    if (buf.endsWith("skz") || buf.endsWith("stay")) { buf = ""; stayMode(); }
  });
  // on phones: tap her name 5 times quickly
  let taps = 0, tapTimer;
  $("#heroName").addEventListener("click", (e) => {
    taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => { taps = 0; }, 1500);
    burst(e.clientX, e.clientY, 5, ["⭐", "✨"]);
    if (taps >= 5) { taps = 0; bigLove(); }
  });
})();

/* ---------- installable app + works offline (when hosted online) ---------- */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
