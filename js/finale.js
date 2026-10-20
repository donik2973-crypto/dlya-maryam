/* =====================================================================
   Finale: write back to Cooper (paper-plane send), shake the phone for
   hearts, and the secret 8-bit mode (Konami code ↑↑↓↓←→←→BA).
   ===================================================================== */

/* ---------- 💌 write back to Cooper ---------- */
(function writeBack() {
  const ta = $("#replyText");
  if (!ta) return;
  const note = $("#note"), count = $("#replyCount"), msg = $("#replyMsg"), send = $("#sendBtn"), deliver = $("#deliverBtn");
  $("#replySign").textContent = `— ${CONFIG.herName}`;
  (CONFIG.replyIdeas || []).forEach((t) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = t;
    b.addEventListener("click", () => {
      ta.value = (ta.value ? ta.value.trimEnd() + " " : "") + t;
      ta.dispatchEvent(new Event("input"));
      ta.focus();
    });
    $("#chips").appendChild(b);
  });
  let lastLen = 0;
  ta.addEventListener("input", () => {
    count.textContent = `${ta.value.length}/500`;
    if (ta.value.length > lastLen && !reduceMotion) {
      const r = ta.getBoundingClientRect();
      fx(["⭐", "✨", "💫"][ta.value.length % 3], rand(r.left + 20, r.right - 20), r.bottom - 10, rand(12, 18),
        [{ o: 1, s: 0.4 }, { o: 1, s: 1, y: -30 }, { o: 0, s: 0.6, y: -80, x: rand(-30, 30) }], 900);
    }
    lastLen = ta.value.length;
  });

  async function fly() {
    const text = ta.value.trim();
    if (!text) {
      note.classList.remove("nudge"); void note.offsetWidth; note.classList.add("nudge");
      msg.textContent = "сначала напиши что-нибудь 😊";
      return;
    }
    send.disabled = true;
    const full = `${text}\n— ${CONFIG.herName} ✨`;
    // 1. the note folds up
    note.classList.add("fold");
    await sleep(650);
    // 2. a paper plane takes off and loops away
    const [x, y] = center(note);
    const plane = document.createElement("div");
    plane.className = "plane";
    plane.innerHTML = `<svg viewBox="0 0 64 64"><path d="M4 30 L60 6 L42 58 L30 38 Z" fill="#fff" stroke="#9d7bff" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 38 L60 6 L24 34" fill="#e8dcff" stroke="#9d7bff" stroke-width="2" stroke-linejoin="round"/></svg>`;
    document.body.appendChild(plane);
    const path = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const loop = t > 0.25 && t < 0.6 ? Math.sin(((t - 0.25) / 0.35) * Math.PI * 2) : 0;
      path.push({
        transform: `translate(${x + t * innerWidth * 0.9 + loop * 60}px, ${y - t * (y + 120) - Math.sin(t * Math.PI) * 120 + (loop ? Math.cos(((t - 0.25) / 0.35) * Math.PI * 2) * 60 - 60 : 0)}px) translate(-50%,-50%) rotate(${-25 + loop * 180 + t * 10}deg) scale(${1.4 - t * 0.6})`,
        opacity: t > 0.9 ? (1 - t) * 10 : 1,
      });
    }
    const anim = plane.animate(path, { duration: 2400, easing: "cubic-bezier(.4,.1,.5,1)", fill: "forwards" });
    const trail = setInterval(() => {
      const r = plane.getBoundingClientRect();
      fx("·", r.left + r.width / 2, r.top + r.height / 2, 26, [{ o: 0.9 }, { o: 0, s: 0.4 }], 900);
    }, 50);
    SFX.whoosh();
    await new Promise((res) => (anim.onfinish = res));
    clearInterval(trail);
    plane.remove();
    achieve("reply", "Ответила Дониёру 💌");
    // 3. a fresh tap opens her messages app (phones only allow sharing straight from a tap)
    msg.textContent = "самолётик долетел ✈️ осталось отправить:";
    deliver.textContent = navigator.share ? "📲 отправить" : "📋 скопировать";
    deliver.hidden = false;
    deliver.onclick = async () => {
      try {
        if (navigator.share) { await navigator.share({ text: full }); msg.textContent = "отправлено! ✨"; }
        else { await navigator.clipboard.writeText(full); msg.textContent = "скопировано! вставь в ваш чат ✨"; }
      } catch (e) {
        try { await navigator.clipboard.writeText(full); msg.textContent = "скопировано! вставь в ваш чат ✨"; }
        catch (e2) { msg.textContent = "сделай скрин и отправь ему ✨"; }
      }
    };
    note.classList.remove("fold");
    send.disabled = false;
    heartRain(30);
  }
  send.addEventListener("click", fly);
})();

/* ---------- 📳 shake the phone → it rains hearts ---------- */
(function shake() {
  if (finePointer) return;
  let lastShake = 0, prev = null;
  const onMotion = (e) => {
    if (!document.body.classList.contains("entered")) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    if (prev) {
      const delta = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z);
      const now = Date.now();
      if (delta > 32 && now - lastShake > 1500) {
        lastShake = now;
        heartRain(45);
        buzz([30, 30, 30]);
        achieve("shake", "Вытрясла немного звёзд 📳");
      }
    }
    prev = { x: a.x, y: a.y, z: a.z };
  };
  const D = window.DeviceMotionEvent;
  if (D && typeof D.requestPermission === "function") {
    document.addEventListener("ella:unlock", () => { D.requestPermission().then((r) => { if (r === "granted") addEventListener("devicemotion", onMotion); }).catch(() => {}); });
  } else if (D) addEventListener("devicemotion", onMotion);
})();

/* ---------- 👾 secret 8-bit mode: ↑ ↑ ↓ ↓ ← → ← → B A (or tap the "days" box 7 times) ---------- */
(function retro() {
  const CODE = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let pos = 0;
  function toggle() {
    const on = !document.body.classList.contains("retro");
    document.body.classList.toggle("retro", on);
    window.RETRO = on;
    flash(0.6, 500);
    const banner = document.createElement("div");
    banner.className = "retro-banner";
    banner.textContent = on ? "8-БИТ РЕЖИМ 👾" : "ОБРАТНО В HD ✨";
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2200);
    if (on) { try { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sound(f), i * 90)); } catch (e) {} achieve("retro", "Секретный 8-бит режим 👾"); }
  }
  let typed = "";
  addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("entered") || e.repeat) return;
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;
    // use the physical key (e.code) so it works with any keyboard language
    const k = /^Key[A-Z]$/.test(e.code || "") ? e.code.slice(3).toLowerCase() : (e.code || e.key || "").toLowerCase();
    pos = k === CODE[pos] ? pos + 1 : k === CODE[0] ? 1 : 0;
    if (pos === CODE.length) { pos = 0; toggle(); return; }
    // easy backup: just type 8bit
    const ch = /^Digit\d$/.test(e.code || "") ? e.code.slice(5) : k.length === 1 ? k : "";
    typed = (typed + ch).slice(-4);
    if (typed === "8bit") { typed = ""; toggle(); }
  });
  let taps = 0, t;
  const days = $("#cD") && $("#cD").closest(".count-box");
  if (days) days.addEventListener("click", () => {
    taps++; clearTimeout(t); t = setTimeout(() => (taps = 0), 1600);
    if (taps >= 7) { taps = 0; toggle(); }
  });
})();
