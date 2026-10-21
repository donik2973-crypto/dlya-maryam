/* =====================================================================
   "Миллион звёзд" — 1 048 576 particles simulated on the GPU (WebGL2).
   Each particle's position + velocity lives in one texel of a float
   texture; a fragment shader moves all of them every frame and a vertex
   shader draws them as glowing points. They fly between a spinning
   galaxy and words. Move / tap to push them around.
   StarField(canvas) is the engine — the section below and the finale
   (js/finale2.js) both use it.
   ===================================================================== */
function StarField(cv, opts = {}) {
  const gl = cv.getContext("webgl2", { antialias: false, depth: false, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const S = 1024;                    // texture side → S*S particles
  let rows = S;                      // active rows (halved on slow devices)
  let aspect = 1.6, ready = false, running = false, shape = null;

  const VS_TRI = `#version 300 es
  void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

  const FS_SIM = `#version 300 es
  precision highp float;
  uniform sampler2D uState, uSeed, uTarget;
  uniform float uT, uDt, uMode, uPtrOn, uBlast, uBeat, uGal;
  uniform vec2 uPtr, uPtrV, uBlastAt;
  out vec4 o;
  // curl of a smooth stream function → swirly, divergence-free flow
  vec2 flow(vec2 p, float t) {
    float a1 = 1.6*p.x + t, a2 = 2.1*p.y - .7*t, a3 = 2.9*p.y + 1.3*t, a4 = 3.3*p.x - .4*t;
    float dx = 1.6*cos(a1)*cos(a2) - 1.65*sin(a3)*sin(a4);
    float dy = -2.1*sin(a1)*sin(a2) + 1.45*cos(a3)*cos(a4);
    return vec2(dy, -dx);
  }
  void main() {
    ivec2 id = ivec2(gl_FragCoord.xy);
    vec4 s = texelFetch(uState, id, 0), sd = texelFetch(uSeed, id, 0);
    vec2 p = s.xy, v = s.zw, tgt;
    float k;
    if (uMode < .5) {                       // galaxy: inner stars orbit faster
      float r = sd.x, ang = sd.y + uT * .3 / (r + .2);
      tgt = (vec2(cos(ang), sin(ang) * .52) * r + (sd.zw - .5) * .09 * (1.2 - r)) * uGal;
      k = 3.;
    } else {
      tgt = texelFetch(uTarget, id, 0).xy;
      k = 7. + 7. * sd.z;
    }
    vec2 acc = (tgt - p) * k + flow(p * 1.3, uT * .25) * (uMode < .5 ? .45 : .2);
    vec2 d = p - uPtr;
    float f = exp(-dot(d, d) * 26.) * uPtrOn;
    acc += (d / (length(d) + .02) * 3.5 + uPtrV * 5.) * f;
    vec2 bd = p - uBlastAt;
    float bl = length(bd);
    acc += bd / (bl + .03) * uBlast * exp(-bl * 1.6) * (.5 + sd.z);
    acc += p * uBeat * (sd.w - .35) * 6.;
    v = (v + acc * uDt) * exp(-uDt * (uMode < .5 ? 2.2 : 3.));
    o = vec4(p + v * uDt, v);
  }`;

  const VS_DRAW = `#version 300 es
  precision highp float;
  uniform sampler2D uState, uSeed;
  uniform int uS;
  uniform float uAspect, uSize, uT;
  out vec3 vC;
  void main() {
    ivec2 id = ivec2(gl_VertexID % uS, gl_VertexID / uS);
    vec4 s = texelFetch(uState, id, 0), sd = texelFetch(uSeed, id, 0);
    gl_Position = vec4(s.x / uAspect, s.y, 0., 1.);
    vec3 pink = vec3(1., .4, .76), vio = vec3(.64, .42, 1.), blu = vec3(.38, .64, 1.);
    float h = fract(length(s.xy) * .5 + s.x * .15 + uT * .03 + sd.z * .15) * 3.;
    vec3 c = h < 1. ? mix(pink, vio, h) : h < 2. ? mix(vio, blu, h - 1.) : mix(blu, pink, h - 2.);
    vC = mix(c, vec3(1., .94, 1.), clamp(length(s.zw) * .35 - .1, 0., .7)) * (.6 + .4 * sd.w);
    gl_PointSize = sd.w > .997 ? uSize * 2.5 : uSize;
  }`;

  const FS_DRAW = `#version 300 es
  precision mediump float;
  uniform float uAlpha;
  in vec3 vC;
  out vec4 o;
  void main() { o = vec4(vC * uAlpha, uAlpha); }`;

  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  function floatTex(data) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, S, S, 0, gl.RGBA, gl.FLOAT, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  }

  let sim, draw, seedTex, targetTex, state = [], fbo = [], cur = 0, buf;
  let cover = 0.2, glow = 1;   // share of the canvas the current shape covers → how bright each dot is
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function init() {
    resize();
    sim = program(VS_TRI, FS_SIM);
    draw = program(VS_DRAW, FS_DRAW);
    // seed: galaxy radius, galaxy angle, two randoms
    buf = new Float32Array(S * S * 4);
    for (let i = 0; i < S * S; i++) {
      const core = Math.random() < 0.16;
      const r = core ? Math.abs(gauss()) * 0.28 : 0.12 + Math.pow(Math.random(), 0.7) * 0.95;
      buf[i * 4] = r;
      buf[i * 4 + 1] = (i % 3) * 2.094 + r * 4.2 + gauss() * 0.5 * (1.15 - r);
      buf[i * 4 + 2] = Math.random();
      buf[i * 4 + 3] = Math.random();
    }
    seedTex = floatTex(buf);
    targetTex = floatTex(null);
    for (let k = 0; k < 2; k++) {
      state[k] = floatTex(null);
      fbo[k] = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[k]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state[k], 0);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("float FBO");
    ready = true;
    bigBang();
    if (shape) wordTargets(shape);
  }

  // every particle starts in one point and explodes outwards
  function bigBang(x = 0, y = 0) {
    for (let i = 0; i < S * S; i++) {
      const a = Math.random() * 6.283, sp = 0.5 + Math.random() * 3.5;
      buf[i * 4] = x + gauss() * 0.01; buf[i * 4 + 1] = y + gauss() * 0.01;
      buf[i * 4 + 2] = Math.cos(a) * sp; buf[i * 4 + 3] = Math.sin(a) * sp;
    }
    gl.bindTexture(gl.TEXTURE_2D, state[cur]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S, S, gl.RGBA, gl.FLOAT, buf);
  }

  // draw the text (lines split by \n) on a hidden canvas and give every particle a random lit pixel
  function wordTargets(word) {
    const W = 600, H = Math.round(W / aspect);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    const lines = word.split("\n");
    const fam = (t) => /[㐀-鿿]/.test(t) ? '"Ma Shan Zheng", "Caveat", "KaiTi", serif' : '"Caveat", "Nunito", cursive';
    let size = (H * 0.7) / lines.length;
    for (const t of lines) {
      x.font = `700 ${size}px ${fam(t)}`;
      size = Math.min(size, size * (W * 0.86) / x.measureText(t).width);
    }
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#fff";
    lines.forEach((t, k) => {
      x.font = `700 ${size}px ${fam(t)}`;
      x.fillText(t, W / 2, H / 2 + (k - (lines.length - 1) / 2) * size * 1.05 + size * 0.04);
    });
    const px = x.getImageData(0, 0, W, H).data, lit = [];
    for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] > 140) lit.push(i);
    if (!lit.length) return;
    cover = lit.length / (W * H);
    for (let i = 0; i < S * S; i++) {
      const p = lit[(Math.random() * lit.length) | 0];
      buf[i * 4] = (((p % W) + Math.random()) / W * 2 - 1) * aspect;
      buf[i * 4 + 1] = -((((p / W) | 0) + Math.random()) / H * 2 - 1);
    }
    gl.bindTexture(gl.TEXTURE_2D, targetTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, S, S, gl.RGBA, gl.FLOAT, buf);
  }
  // null = galaxy; text waits for the calligraphy font first
  function setShape(word) {
    shape = word;
    if (word) document.fonts.load('700 40px "Ma Shan Zheng"', word).catch(() => {}).then(() => shape === word && ready && wordTargets(word));
  }

  /* ---------- pointer ---------- */
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, on: 0, t: 0 }, bl = { x: 0, y: 0, f: 0 };
  function toSim(e) {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width * 2 - 1) * aspect, -((e.clientY - r.top) / r.height * 2 - 1)];
  }
  function blast(x, y, f) { bl.x = x; bl.y = y; bl.f = f; }
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = toSim(e), now = performance.now(), dt = Math.max(16, now - ptr.t) / 1000;
    ptr.vx = (x - ptr.x) / dt; ptr.vy = (y - ptr.y) / dt;
    ptr.x = x; ptr.y = y; ptr.t = now; ptr.on = 1;
    if (opts.onTouch) opts.onTouch();
  });
  cv.addEventListener("pointerdown", (e) => {
    const [x, y] = toSim(e);
    ptr.x = x; ptr.y = y; ptr.vx = ptr.vy = 0; ptr.on = 1; ptr.t = performance.now();
    blast(x, y, 5);
    if (opts.onTouch) opts.onTouch();
  });
  cv.addEventListener("pointerleave", () => (ptr.on = 0));
  cv.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") ptr.on = 0; });

  /* ---------- loop ---------- */
  let last = 0, t0 = 0, slow = 0, frames = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    aspect = cv.width / cv.height;
    if (ready && shape) wordTargets(shape);
  }
  addEventListener("resize", () => ready && resize());

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    const t = (now - t0) / 1000;

    // got slower than ~25 fps for a while → simulate fewer particles
    if (t > 1.5) {
      frames++;
      if (dt > 0.04) slow++;
      if (frames === 90) {
        if (slow > 45 && rows > 256) { rows /= 2; if (opts.onCount) opts.onCount(S * rows); }
        frames = slow = 0;
      }
    }
    if (opts.onFrame) opts.onFrame(now);

    let beat = 0;
    if (typeof analyser !== "undefined" && analyser && typeof playing !== "undefined" && playing) {
      analyser.getByteFrequencyData(freqData);
      beat = Math.pow((freqData[2] + freqData[3] + freqData[4]) / 765, 3) * 0.6;
    }
    ptr.vx *= 0.9; ptr.vy *= 0.9;

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
    gl.viewport(0, 0, S, rows);
    gl.useProgram(sim.p);
    const u = sim.u;
    [state[cur], seedTex, targetTex].forEach((tex, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); });
    gl.uniform1i(u.uState, 0); gl.uniform1i(u.uSeed, 1); gl.uniform1i(u.uTarget, 2);
    gl.uniform1f(u.uT, t); gl.uniform1f(u.uDt, dt); gl.uniform1f(u.uMode, shape ? 1 : 0);
    gl.uniform1f(u.uPtrOn, ptr.on); gl.uniform2f(u.uPtr, ptr.x, ptr.y); gl.uniform2f(u.uPtrV, ptr.vx, ptr.vy);
    gl.uniform1f(u.uBlast, bl.f / dt * 0.016); gl.uniform2f(u.uBlastAt, bl.x, bl.y);
    gl.uniform1f(u.uBeat, beat);
    gl.uniform1f(u.uGal, Math.min(1, aspect * 0.85));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = 1 - cur;
    bl.f = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(draw.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, state[cur]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, seedTex);
    gl.uniform1i(draw.u.uState, 0); gl.uniform1i(draw.u.uSeed, 1); gl.uniform1i(draw.u.uS, S);
    gl.uniform1f(draw.u.uAspect, aspect); gl.uniform1f(draw.u.uT, t);
    glow += (Math.min(1.4, Math.max(0.35, (shape ? cover : 0.2) / 0.2)) - glow) * 0.05;
    const size = Math.max(1, Math.min(devicePixelRatio || 1, 2) * 0.85);
    gl.uniform1f(draw.u.uSize, size);
    // brighter per particle when there are fewer of them or the canvas is bigger; bigger dots → dimmer
    gl.uniform1f(draw.u.uAlpha, Math.min(0.6, 0.2 * Math.pow(S / rows, 0.6) * (cv.width * cv.height) / 5.8e5 / (size * size) * glow));
    gl.drawArrays(gl.POINTS, 0, S * rows);
  }

  return {
    get count() { return S * rows; },
    start() {
      if (!ready) { init(); t0 = performance.now(); }
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    },
    stop() { running = false; },
    setShape, blast, bigBang: (x, y) => ready && bigBang(x, y),
  };
}

/* ---------- the section: chips, autoplay, only runs while on screen ---------- */
(function millionSection() {
  const cv = $("#million");
  if (!cv) return;
  const sec = cv.closest("section");
  const bar = $("#millionBar"), count = $("#millionCount");
  if (CONFIG.millionLead) $("#millionLead").textContent = CONFIG.millionLead;
  const shapes = ["галактика", ...(CONFIG.millionWords || ["加油", "Марьям", "谢谢"])];
  let mode = 0, autoUntil = 0, autoNext = 0, touched = false;

  const showCount = (n) => (count.textContent = n.toLocaleString("ru-RU") + " частиц");
  const field = StarField(cv, {
    onCount: showCount,
    onTouch() {
      autoUntil = performance.now() + 15000;
      if (!touched) { touched = true; achieve("million", "Миллион звёзд под контролем 🌌"); }
    },
    onFrame(now) { if (now > autoUntil && now > autoNext) setMode((mode + 1) % shapes.length); },
  });
  if (!field) { sec.remove(); return; }
  showCount(field.count);

  const chips = shapes.map((name, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "gpu-chip"; b.textContent = name;
    b.addEventListener("click", () => { setMode(i); autoUntil = performance.now() + 25000; });
    bar.insertBefore(b, count);
    return b;
  });
  function setMode(i) {
    mode = i;
    chips.forEach((b, k) => b.classList.toggle("on", k === i));
    field.setShape(i ? shapes[i] : null);
    field.blast(0, 0, 1.2);
    autoNext = performance.now() + 8000;
  }
  chips[0].classList.add("on");

  new IntersectionObserver((es) => {
    if (es[0].isIntersecting) {
      try { field.start(); } catch (err) { console.warn("million:", err); sec.remove(); return; }
      if (!autoNext) autoNext = performance.now() + 6000;
    } else field.stop();
  }, { rootMargin: "120px" }).observe(cv);
})();
