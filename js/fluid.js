/* =====================================================================
   "Живая туманность" — a real fluid simulation (Navier–Stokes, the
   "stable fluids" method) running on the GPU. Drag to stir glowing
   pink / violet / blue dye. The ink button stamps a Chinese word into
   the water, written left to right, and lets the current carry it away.
   ===================================================================== */
(function fluid() {
  const cv = $("#fluid");
  if (!cv) return;
  const sec = cv.closest("section");
  const gl = cv.getContext("webgl2", { alpha: true, depth: false, antialias: false, premultipliedAlpha: true });
  if (!gl || !(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"))) { sec.remove(); return; }
  gl.getExtension("OES_texture_half_float_linear");

  if (CONFIG.fluidLead) $("#fluidLead").textContent = CONFIG.fluidLead;
  const inkWords = CONFIG.inkWords || ["加油", "朋友", "你很棒"];
  const small = innerWidth < 700;
  const SIM = small ? 96 : 128, DYE = small ? 512 : 900;
  const COLORS = [[1, 0.35, 0.75], [0.62, 0.38, 1], [0.35, 0.6, 1], [1, 0.55, 0.85], [0.5, 0.45, 1]];

  const VS = `#version 300 es
  uniform vec2 tx;
  out vec2 vUv, vL, vR, vT, vB;
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = p; vL = p - vec2(tx.x, 0.); vR = p + vec2(tx.x, 0.); vT = p + vec2(0., tx.y); vB = p - vec2(0., tx.y);
    gl_Position = vec4(p * 2. - 1., 0., 1.);
  }`;
  const HEAD = `#version 300 es
  precision highp float;
  in vec2 vUv, vL, vR, vT, vB;
  out vec4 o;
  `;
  const FS = {
    splat: `uniform sampler2D uT; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
      void main() { vec2 p = vUv - point; p.x *= aspect; o = vec4(texture(uT, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.); }`,
    advect: `uniform sampler2D uVel, uSrc; uniform vec2 velTx; uniform float dt, diss;
      void main() { vec2 c = vUv - dt * texture(uVel, vUv).xy * velTx; o = texture(uSrc, c) / (1. + diss * dt); }`,
    divergence: `uniform sampler2D uVel;
      void main() {
        float L = texture(uVel, vL).x, R = texture(uVel, vR).x, T = texture(uVel, vT).y, B = texture(uVel, vB).y;
        vec2 C = texture(uVel, vUv).xy;
        if (vL.x < 0.) L = -C.x; if (vR.x > 1.) R = -C.x; if (vT.y > 1.) T = -C.y; if (vB.y < 0.) B = -C.y;
        o = vec4(.5 * (R - L + T - B), 0., 0., 1.);
      }`,
    curl: `uniform sampler2D uVel;
      void main() { o = vec4(.5 * (texture(uVel, vR).y - texture(uVel, vL).y - texture(uVel, vT).x + texture(uVel, vB).x), 0., 0., 1.); }`,
    vorticity: `uniform sampler2D uVel, uCurl; uniform float curl, dt;
      void main() {
        float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x, T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
        vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        f = f / (length(f) + 1e-4) * curl * C; f.y = -f.y;
        o = vec4(clamp(texture(uVel, vUv).xy + f * dt, -1000., 1000.), 0., 1.);
      }`,
    pressure: `uniform sampler2D uP, uDiv;
      void main() { o = vec4((texture(uP, vL).x + texture(uP, vR).x + texture(uP, vB).x + texture(uP, vT).x - texture(uDiv, vUv).x) * .25, 0., 0., 1.); }`,
    gradient: `uniform sampler2D uP, uVel;
      void main() { vec2 v = texture(uVel, vUv).xy - vec2(texture(uP, vR).x - texture(uP, vL).x, texture(uP, vT).x - texture(uP, vB).x); o = vec4(v, 0., 1.); }`,
    scale: `uniform sampler2D uT; uniform float k; void main() { o = texture(uT, vUv) * k; }`,
    ink: `uniform sampler2D uT, uMask; uniform float front, amount; uniform vec3 color;
      void main() {
        float m = texture(uMask, vec2(vUv.x, 1. - vUv.y)).a;
        float band = smoothstep(front - .07, front, vUv.x) * (1. - smoothstep(front, front + .01, vUv.x));
        o = vec4(texture(uT, vUv).rgb + color * m * band * amount, 1.);
      }`,
    display: `uniform sampler2D uT;
      void main() {
        vec3 c = 1. - exp(-texture(uT, vUv).rgb * 2.4);
        float a = max(c.r, max(c.g, c.b));
        o = vec4(c, a);
      }`,
  };

  let P = {}, vel, dye, divT, curlT, pres, maskTex, ready = false, running = false;

  function program(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, HEAD + fs]]) {
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
  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h };
  }
  function pair(w, h) {
    const d = { a: target(w, h), b: target(w, h), swap() { [this.a, this.b] = [this.b, this.a]; } };
    return d;
  }
  // run one shader pass into `out` (null = screen); `tex` maps uniform name → texture
  function pass(prog, out, tex, uni) {
    gl.useProgram(prog.p);
    let unit = 0;
    for (const k in tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex[k]); gl.uniform1i(prog.u[k], unit++); }
    for (const k in uni) {
      const v = uni[k];
      if (!prog.u[k]) continue;
      if (typeof v === "number") gl.uniform1f(prog.u[k], v);
      else if (v.length === 2) gl.uniform2f(prog.u[k], v[0], v[1]);
      else gl.uniform3f(prog.u[k], v[0], v[1], v[2]);
    }
    const w = out ? out.w : cv.width, h = out ? out.h : cv.height;
    gl.uniform2f(prog.u.tx, 1 / w, 1 / h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let aspect = 1;
  function init() {
    for (const k in FS) P[k] = program(FS[k]);
    const sw = aspect >= 1 ? Math.round(SIM * aspect) : SIM, sh = aspect >= 1 ? SIM : Math.round(SIM / aspect);
    const dw = aspect >= 1 ? DYE : Math.round(DYE * aspect), dh = aspect >= 1 ? Math.round(DYE / aspect) : DYE;
    vel = pair(sw, sh); pres = pair(sw, sh);
    divT = target(sw, sh); curlT = target(sw, sh);
    dye = pair(dw, dh);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("half-float FBO");
    maskTex = gl.createTexture();
    ready = true;
  }

  function splat(x, y, dx, dy, color, r = 0.0022) {
    pass(P.splat, vel.b, { uT: vel.a.tex }, { aspect, radius: r, point: [x, y], color: [dx, dy, 0] });
    vel.swap();
    pass(P.splat, dye.b, { uT: dye.a.tex }, { aspect, radius: r, point: [x, y], color });
    dye.swap();
  }
  let hue = 0;
  const nextColor = (k = 1) => { hue = (Math.floor(hue) + 1) % COLORS.length; return COLORS[hue].map((c) => c * k); };

  /* ---------- ink: write a word into the water ---------- */
  let inkFront = -1, inkColor, inkIdx = 0;
  const inkBtn = $("#inkBtn");
  function writeInk() {
    if (!ready) return;
    const word = inkWords[inkIdx++ % inkWords.length];
    const W = dye.a.w, H = dye.a.h;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    let size = H * 0.62;
    const fam = '"Ma Shan Zheng", "KaiTi", serif';
    x.font = `${size}px ${fam}`;
    size = Math.min(size, size * (W * 0.84) / x.measureText(word).width);
    x.font = `${size}px ${fam}`;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#fff";
    x.fillText(word, W / 2, H / 2);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // calm the water first so the word stays readable for a moment
    pass(P.scale, vel.b, { uT: vel.a.tex }, { k: 0.04 }); vel.swap();
    pass(P.scale, dye.b, { uT: dye.a.tex }, { k: 0.25 }); dye.swap();
    inkFront = 0.04;
    inkColor = [1.2, 0.75, 1.15];
    inkBtn.textContent = `✍️ написать тушью · ${inkWords[inkIdx % inkWords.length]}`;
    achieve("ink", "Написала иероглифы тушью 🖌️");
  }
  inkBtn.textContent = `✍️ написать тушью · ${inkWords[0]}`;
  inkBtn.addEventListener("click", () => document.fonts.load('40px "Ma Shan Zheng"', inkWords.join("")).catch(() => {}).then(writeInk));
  $("#fluidClear").addEventListener("click", () => {
    if (!ready) return;
    pass(P.scale, dye.b, { uT: dye.a.tex }, { k: 0 }); dye.swap();
    pass(P.scale, vel.b, { uT: vel.a.tex }, { k: 0 }); vel.swap();
  });

  /* ---------- pointer ---------- */
  const ptr = { x: 0, y: 0, down: false, moved: false };
  let idle = 0, painted = false;
  function uv(e) {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }
  cv.addEventListener("pointerdown", (e) => {
    const [x, y] = uv(e);
    ptr.x = x; ptr.y = y; ptr.down = true;
    cv.setPointerCapture(e.pointerId);
    if (ready) splat(x, y, 0, 0, nextColor(1.4), 0.004);
  });
  cv.addEventListener("pointermove", (e) => {
    const [x, y] = uv(e);
    if ((ptr.down || e.pointerType === "mouse") && ready) {
      const dx = (x - ptr.x) * 6000, dy = (y - ptr.y) * 6000;
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        hue = (hue + 0.02) % COLORS.length;
        splat(x, y, dx, dy, COLORS[Math.floor(hue)].map((c) => c * 0.8));
        idle = 0;
        if (!painted && ptr.down) { painted = true; achieve("nebula", "Нарисовала свою туманность 🌌"); }
      }
    }
    ptr.x = x; ptr.y = y;
  });
  addEventListener("pointerup", () => (ptr.down = false));

  /* ---------- loop ---------- */
  // the simulation grid keeps its first shape; later resizes only change the screen canvas
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    if (!ready) aspect = cv.width / cv.height;
  }
  addEventListener("resize", resize);

  let last = 0, ambient = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.025, (now - last) / 1000 || 0.016);
    last = now;
    gl.disable(gl.BLEND);

    // nobody is drawing → the nebula stirs itself
    idle += dt; ambient -= dt;
    if (idle > 3 && ambient <= 0 && inkFront < 0) {
      ambient = rand(0.6, 1.4);
      const a = Math.random() * 6.283;
      splat(rand(0.15, 0.85), rand(0.2, 0.8), Math.cos(a) * 500, Math.sin(a) * 500, nextColor(1), rand(0.0015, 0.004));
    }
    if (inkFront >= 0) {
      pass(P.ink, dye.b, { uT: dye.a.tex, uMask: maskTex }, { front: inkFront, amount: 0.22, color: inkColor });
      dye.swap();
      inkFront += dt * 0.55;
      // a few gentle eddies behind the brush make the ink bleed
      if (Math.random() < 0.2) splat(inkFront - 0.05, rand(0.25, 0.75), rand(-12, 12), rand(-18, 18), [0, 0, 0], 0.002);
      if (inkFront > 1.1) { inkFront = -1; idle = -4; }
    }

    const vt = [1 / vel.a.w, 1 / vel.a.h];
    pass(P.curl, curlT, { uVel: vel.a.tex }, {});
    pass(P.vorticity, vel.b, { uVel: vel.a.tex, uCurl: curlT.tex }, { curl: inkFront >= 0 ? 6 : 22, dt }); vel.swap();
    pass(P.divergence, divT, { uVel: vel.a.tex }, {});
    pass(P.scale, pres.b, { uT: pres.a.tex }, { k: 0.8 }); pres.swap();
    for (let i = 0; i < 20; i++) { pass(P.pressure, pres.b, { uP: pres.a.tex, uDiv: divT.tex }, {}); pres.swap(); }
    pass(P.gradient, vel.b, { uP: pres.a.tex, uVel: vel.a.tex }, {}); vel.swap();
    pass(P.advect, vel.b, { uVel: vel.a.tex, uSrc: vel.a.tex }, { velTx: vt, dt, diss: 0.2 }); vel.swap();
    pass(P.advect, dye.b, { uVel: vel.a.tex, uSrc: dye.a.tex }, { velTx: vt, dt, diss: inkFront >= 0 || idle < 0 ? 0.08 : 0.35 }); dye.swap();

    gl.clearColor(0, 0, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    pass(P.display, null, { uT: dye.a.tex }, {});
  }

  new IntersectionObserver((es) => {
    const vis = es[0].isIntersecting;
    if (vis && !ready) {
      try { resize(); init(); } catch (err) { console.warn("fluid:", err); sec.remove(); return; }
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283; splat(rand(0.2, 0.8), rand(0.25, 0.75), Math.cos(a) * 700, Math.sin(a) * 700, nextColor(1.3), 0.004); }
    }
    if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!vis) running = false;
  }, { rootMargin: "120px" }).observe(cv);
})();
