/* =====================================================================
   "Чёрная дыра" — every pixel shoots a ray of light from the camera and
   bends it step by step with the Schwarzschild photon equation
   (a = -1.5·h²·r / |r|⁵). Light that falls in is black, light that hits
   the thin accretion disk takes its colour (brighter on the side that
   moves towards us — Doppler beaming), the rest shows the bent sky.
   Drag to fly around it.
   ===================================================================== */
// the renderer: transparent = see-through sky (used by the finale on top of the page)
function BlackHoleRenderer(cv, transparent = false) {
  const gl = cv.getContext("webgl2", { antialias: false, depth: false, alpha: transparent, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) return null;

  const VS = `#version 300 es
  void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform float uT, uYaw, uPitch, uDist, uSky;
  out vec4 o;
  float h3(vec3 p) { p = fract(p * .3183099 + .1) * 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= .5; } return s; }

  vec3 sky(vec3 d) {
    vec3 c = vec3(0.);
    for (int k = 0; k < 2; k++) {                  // two layers of stars
      vec3 p = d * (k == 0 ? 90. : 220.);
      vec3 i = floor(p), f = fract(p) - .5;
      float h = h3(i + float(k) * 7.);
      float s = step(.975, h) * smoothstep(.45, 0., length(f)) * (h - .975) * 40.;
      c += s * mix(vec3(1., .78, .93), vec3(.7, .82, 1.), h3(i + 3.));
    }
    float n = fbm(vec2(atan(d.z, d.x) * 2., d.y * 3.) + 4.);
    float band = exp(-pow(d.y * 2.4 - .35 * sin(atan(d.z, d.x) * 2.), 2.) * 2.5);
    c += mix(vec3(.42, .14, .5), vec3(.12, .2, .55), n) * n * n * band * .55;
    return c;
  }

  const float RIN = 2.6, ROUT = 11.;
  vec4 disk(vec3 p, vec3 dir) {
    float r = length(p.xz), t = (r - RIN) / (ROUT - RIN);
    float phi = atan(p.z, p.x);
    float om = 2.2 / pow(r, 1.5);                  // Kepler: inner rings spin faster
    float sw = fbm(vec2(r * 1.4, (phi - uT * om) * 2.5));
    float rings = .72 + .28 * sin(r * 5. + sw * 8.);
    vec3 hot = vec3(1., .95, .98), pink = vec3(1., .42, .76), vio = vec3(.6, .36, 1.), blu = vec3(.28, .48, 1.);
    vec3 c = t < .12 ? mix(hot, pink, t / .12) : t < .5 ? mix(pink, vio, (t - .12) / .38) : mix(vio, blu, (t - .5) / .5);
    vec3 v = normalize(vec3(-p.z, 0., p.x));
    float dop = max(.2, 1. + .9 * dot(v, -dir) * inversesqrt(r));
    float I = (pow(1. - t, 1.6) * 3.6 + .18) * (.4 + 1. * sw) * rings;
    I *= smoothstep(0., .04, t) * smoothstep(1., .7, t) * dop * dop * dop;
    return vec4(c * I, clamp(I * .9, 0., .95));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2. - uRes) / uRes.y;
    vec3 ro = vec3(sin(uYaw) * cos(uPitch), sin(uPitch), cos(uYaw) * cos(uPitch)) * uDist;
    vec3 fw = normalize(-ro), rt = normalize(cross(vec3(0, 1, 0), fw)), up = cross(fw, rt);
    vec3 dir = normalize(fw * 1.7 + uv.x * rt + uv.y * up);
    vec3 pos = ro, col = vec3(0.);
    float alpha = 0., hh = dot(cross(pos, dir), cross(pos, dir)), rmin = 1e3;
    bool fell = false;
    for (int i = 0; i < 150; i++) {
      float r = length(pos);
      rmin = min(rmin, r);
      float dt = clamp(.09 * r, .03, 1.5);
      dir += -1.5 * hh * pos / pow(r, 5.) * dt;
      vec3 np = pos + dir * dt;
      if (pos.y * np.y < 0.) {                     // crossed the disk plane
        vec3 hit = mix(pos, np, pos.y / (pos.y - np.y));
        float rr = length(hit.xz);
        if (rr > RIN && rr < ROUT) {
          vec4 d = disk(hit, normalize(dir));
          col += (1. - alpha) * d.rgb * d.a;
          alpha += (1. - alpha) * d.a;
        }
      }
      pos = np;
      if (r < 1.) { fell = true; break; }         // event horizon (rs = 1)
      if (r > uDist * 1.6 && dot(pos, dir) > 0.) break;
    }
    if (!fell) col += (1. - alpha) * sky(normalize(dir)) * uSky;
    vec3 ring = vec3(1., .5, .85) * .06 / max(rmin - 1.2, .04) * (1. - alpha) * (fell ? 0. : 1.);   // photon-ring glow
    col = 1. - exp(-(col + ring) * 1.25);
    float a = fell ? 1. : max(max(alpha, uSky), min(1., max(col.r, max(col.g, col.b))));
    o = vec4(pow(col, vec3(.92)), a);
  }`;

  function program() {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  const prog = program(), U = {};
  for (const n of ["uRes", "uT", "uYaw", "uPitch", "uDist", "uSky"]) U[n] = gl.getUniformLocation(prog, n);
  return function render({ t, yaw, pitch, dist, sky = 1 }) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(prog);
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uYaw, yaw);
    gl.uniform1f(U.uPitch, pitch);
    gl.uniform1f(U.uDist, dist);
    gl.uniform1f(U.uSky, sky);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

/* ---------- the section: drag to fly around, renders only while on screen ---------- */
(function blackHole() {
  const cv = $("#blackhole");
  if (!cv) return;
  const sec = cv.closest("section");
  if (CONFIG.blackHoleLead) $("#bhLead").textContent = CONFIG.blackHoleLead;
  let render, ready = false, running = false;
  // render below screen resolution (the browser smooths it out); drop further if slow
  let scale = innerWidth < 700 ? 0.8 : 0.7;
  function resize() {
    cv.width = Math.round(cv.clientWidth * scale);
    cv.height = Math.round(cv.clientHeight * scale);
  }
  addEventListener("resize", () => ready && resize());

  let yaw = 0.6, pitch = 0.16, vyaw = 0.05, drag = false, lx = 0, ly = 0, dragged = false;
  cv.addEventListener("pointerdown", (e) => { drag = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    yaw -= dx * 0.006; vyaw = -dx * 0.12;
    pitch = Math.max(-0.7, Math.min(0.7, pitch + dy * 0.004));
    if (!dragged && Math.abs(dx) + Math.abs(dy) > 30) { dragged = true; achieve("horizon", "Заглянула за горизонт событий 🕳️"); }
  });
  addEventListener("pointerup", () => (drag = false));

  let last = 0, t0 = 0, frames = 0, slow = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!drag) { vyaw += (0.05 - vyaw) * 0.02; yaw += vyaw * dt; }
    if (++frames > 40) {
      if (dt > 0.03) slow++;
      if (frames === 130) {
        if (slow > 50 && scale > 0.45) { scale *= 0.8; resize(); }
        frames = 41; slow = 0;
      }
    }
    render({ t: (now - t0) / 1000, yaw, pitch, dist: cv.width < cv.height ? 19 : 14.5 });
  }

  new IntersectionObserver((es) => {
    const vis = es[0].isIntersecting;
    if (vis && !ready) {
      try {
        resize();
        render = BlackHoleRenderer(cv);
        if (!render) throw new Error("no WebGL2");
        ready = true; t0 = performance.now();
      } catch (err) { console.warn("blackhole:", err); sec.remove(); return; }
    }
    if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!vis) running = false;
  }, { rootMargin: "80px" }).observe(cv);
})();
