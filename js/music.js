/* =====================================================================
   Background music.
   No mp3 needed: this is a little music-box song generated live with
   the Web Audio API (chords C – G – Am – F, a twinkly arpeggio and an
   original melody). If CONFIG.musicFile is set, that file plays instead.
   ===================================================================== */
const Music = (() => {
  const btn = $("#musicBtn");
  let on = false, timer = null, nextTime = 0, step = 0, out = null, fileEl = null;
  const BPM = 78, EIGHTH = 60 / BPM / 2;
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]; // C  G  Am  F
  const MELODY = [
    76, 0, 74, 72, 74, 0, 76, 0,   74, 0, 71, 0, 67, 0, 0, 0,
    72, 0, 74, 76, 79, 0, 76, 0,   77, 0, 76, 74, 72, 0, 0, 0,
    76, 0, 79, 0, 84, 0, 83, 79,   79, 0, 77, 0, 74, 0, 0, 0,
    76, 0, 72, 0, 76, 79, 81, 0,   77, 76, 74, 0, 72, 0, 0, 0,
  ];

  function chime(freq, t, vol, dur) {
    // real piano recordings when they're loaded (see js/piano.js), synth otherwise
    if (!window.RETRO && typeof Piano !== "undefined" && Piano.playAt(freq, t, vol * 4.5, dur, out)) return;
    if (window.RETRO) vol *= 0.45; // chiptune mode is louder, so turn it down
    const ctx = audio(), g = ctx.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = ctx.createOscillator(); o.type = window.RETRO ? "square" : "triangle"; o.frequency.value = freq;
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = "sine"; o2.frequency.value = freq * 4.02; g2.gain.value = 0.16;
    o.connect(g); o2.connect(g2).connect(g);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + 0.35);
  }
  function pad(notes, t, dur) {
    const ctx = audio(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    g.connect(out); lp.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    for (const n of notes) {
      const o = ctx.createOscillator(); o.type = window.RETRO ? "square" : "triangle"; o.frequency.value = hz(n - 12);
      o.detune.value = rand(-6, 6);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  /* Ave Maria (Bach/Gounod) on the real piano — her favorite piece. Used once the piano recordings are loaded. */
  let aveT0 = null, aveIdx = 0;
  function scheduleAve(ctx) {
    if (aveT0 === null) { aveT0 = Math.max(nextTime, ctx.currentTime + 0.15); aveIdx = 0; }
    while (aveIdx < AVE_EVENTS.length && aveT0 + AVE_EVENTS[aveIdx][0] < ctx.currentTime + 0.5) {
      const [t, midi, dur, gain] = AVE_EVENTS[aveIdx++];
      const when = aveT0 + t;
      if (when >= ctx.currentTime - 0.02) Piano.playAt(440 * Math.pow(2, (midi - 69) / 12), when, gain, dur, out);
    }
    if (aveIdx >= AVE_EVENTS.length) { aveT0 += AVE_LENGTH + 3; aveIdx = 0; }   // loop, with a short pause
  }
  function schedule() {
    const ctx = audio();
    if (!window.RETRO && typeof AVE_EVENTS !== "undefined" && typeof Piano !== "undefined" && Piano.ready) return scheduleAve(ctx);
    aveT0 = null;
    while (nextTime < ctx.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % 4, s = step % 8, ch = CHORDS[bar];
      if (s === 0) pad(ch, nextTime, EIGHTH * 8.5);
      const arp = [0, 1, 2, 1, 0, 1, 2, 1][s];
      chime(hz(ch[arp] + (s >= 4 ? 12 : 0)), nextTime, 0.035, 1.1);
      const m = MELODY[step % MELODY.length];
      if (m) chime(hz(m), nextTime, 0.075, 1.8);
      nextTime += EIGHTH;
      step++;
    }
  }
  function setUI() {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
  }
  function start() {
    if (on) return;
    on = true;
    if (CONFIG.musicFile) {
      fileEl = fileEl || Object.assign(new Audio(CONFIG.musicFile), { loop: true, volume: 0.55 });
      fileEl.play().catch(() => {});
    } else {
      const ctx = audio();
      if (!out) { out = ctx.createGain(); out.connect(master); }
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(0.0001, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
      nextTime = ctx.currentTime + 0.1;
      aveT0 = null;
      timer = setInterval(schedule, 80);
      schedule();
    }
    setUI();
  }
  function stop() {
    if (!on) return;
    on = false;
    if (fileEl) fileEl.pause();
    if (timer) {
      clearInterval(timer); timer = null;
      const ctx = audio();
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    }
    setUI();
  }

  btn.addEventListener("click", (e) => {
    on ? stop() : start();
    const [x, y] = center(btn);
    burst(x, y, 8, on ? ["♪", "♫", "💗"] : ["💤"]);
  });
  document.addEventListener("ella:enter", () => {
    btn.classList.add("show");
    if (CONFIG.autoMusic) start();
  });
  // pause in the background so the song doesn't stutter, resume when she comes back
  let wasOn = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { wasOn = on; stop(); }
    else if (wasOn) start();
  });
  return { start, stop, get on() { return on; } };
})();
