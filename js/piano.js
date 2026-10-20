/* =====================================================================
   Real grand piano sound.
   Recordings of a real Yamaha grand piano ("Salamander Grand Piano",
   free to use, hosted by the Tone.js project) replace the synth sound
   for the piano, the background music and the little UI sounds.
   If there's no internet, the old synth sound is used automatically.
   ===================================================================== */
const Piano = (() => {
  const BASE = "https://tonejs.github.io/audio/salamander/";
  const NOTES = {
    C2: 65.41, Ds2: 77.78, Fs2: 92.5, A2: 110, C3: 130.81, Ds3: 155.56, Fs3: 185, A3: 220,
    C4: 261.63, Ds4: 311.13, Fs4: 369.99, A4: 440, C5: 523.25, Ds5: 622.25, Fs5: 739.99, A5: 880,
    C6: 1046.5, Ds6: 1244.51, Fs6: 1479.98,
  };
  const buffers = [];
  let ready = false, loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const ctx = audio();
      await Promise.all(Object.entries(NOTES).map(async ([name, hz]) => {
        const res = await fetch(BASE + name + ".mp3");
        if (!res.ok) throw new Error(name);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        buffers.push({ hz, buf });
      }));
      ready = true;
    } catch (e) { /* offline → keep the synth */ }
  }

  /* play a note: picks the closest recording and tunes it to the exact pitch */
  function play(freq, when = 0, gain = 0.8, dur = 2.5) {
    if (!ready) return false;
    return playAt(freq, audio().currentTime + Math.max(0, when), gain, dur, master);
  }
  function playAt(freq, t, gain, dur, dest) {
    if (!ready) return false;
    const ctx = audio();
    let best = buffers[0];
    for (const b of buffers) if (Math.abs(Math.log2(freq / b.hz)) < Math.abs(Math.log2(freq / best.hz))) best = b;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = best.buf;
    src.playbackRate.value = freq / best.hz;
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    src.connect(g).connect(dest || master);
    src.start(t);
    src.stop(t + dur + 0.9);
    return true;
  }

  document.addEventListener("ella:enter", load);
  document.addEventListener("ella:unlock", load);
  return { play, playAt, get ready() { return ready; } };
})();

/* the piano keys (and every other little sound that uses sound()) now play the real piano */
{
  const synthSound = sound;
  sound = (freq) => { if (!Piano.play(freq, 0, 0.9, 1.6)) synthSound(freq); };
}
