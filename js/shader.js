/* =====================================================================
   Living pink background — a WebGL fragment shader written in GLSL.
   It runs on the graphics card: flowing "liquid silk" made of layered
   noise that follows the mouse and ripples when big moments happen.
   ===================================================================== */
(function shaderBackground() {
  if (reduceMotion) return;
  const cv = document.createElement("canvas");
  cv.id = "gl";
  document.body.prepend(cv);
  const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  if (!gl) { cv.remove(); return; }

  const VERT = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

  const FRAG = `
    precision mediump float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform vec2  u_mouse;
    uniform float u_scroll;
    uniform float u_boost;
    uniform float u_night;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
      return v;
    }
    float heart(vec2 p) {            // signed-ish distance to a heart shape
      p.y -= 0.25;
      p.x = abs(p.x);
      float a = atan(p.x, p.y) / 3.14159;
      float r = length(p);
      float h = abs(a);
      float d = (13.0 * h - 22.0 * h * h + 10.0 * h * h * h) / (6.0 - 5.0 * h);
      return r - d * 0.35;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      float aspect = u_res.x / u_res.y;
      vec2 p = vec2(uv.x * aspect, uv.y);
      vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
      float t = u_time * 0.05;

      // domain-warped noise = the silky flowing look
      vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 - t + 4.3));
      vec2 r = vec2(fbm(p * 1.3 + 3.0 * q + vec2(1.7, 9.2) + t * 1.4),
                    fbm(p * 1.3 + 3.0 * q + vec2(8.3, 2.8) - t));
      float f = fbm(p * 1.1 + 2.6 * r + vec2(0.0, u_scroll * 0.00025));

      // the mouse warms up the color around it
      float md = length(p - m);
      float glow = exp(-md * md * 7.0);
      f += 0.16 * glow;

      vec3 cream  = vec3(1.00, 0.93, 0.96);
      vec3 pink   = vec3(1.00, 0.76, 0.87);
      vec3 lilac  = vec3(0.95, 0.82, 1.00);
      vec3 rose   = vec3(1.00, 0.58, 0.76);

      vec3 col = mix(cream, pink, smoothstep(0.25, 0.85, f));
      col = mix(col, lilac, smoothstep(0.35, 0.95, r.x) * 0.65);
      col = mix(col, rose, smoothstep(0.62, 1.0, f) * 0.42);

      // silk highlights
      float silk = smoothstep(0.55, 0.0, abs(f - 0.55) * 6.0);
      col += vec3(1.0, 0.95, 0.98) * silk * 0.10;

      // tiny glitter
      float g = hash(floor(gl_FragCoord.xy * 0.5) + floor(u_time * 6.0));
      col += step(0.9985, g) * 0.35;

      // celebration ripples + a ghost heart when something big happens
      vec2 c = vec2(0.5 * aspect, 0.5);
      float d = length(p - c);
      col += u_boost * 0.10 * (0.5 + 0.5 * sin(d * 28.0 - u_time * 7.0)) * exp(-d * 2.0);
      float hd = heart((p - c) * (1.6 - u_boost * 0.3));
      col = mix(col, rose, u_boost * 0.35 * smoothstep(0.02, -0.02, hd));

      col = mix(col, vec3(1.0, 0.86, 0.92), glow * 0.18);

      // ---- night sky version of the same flow ----
      vec3 deep   = vec3(0.03, 0.03, 0.11);
      vec3 violet = vec3(0.20, 0.10, 0.40);
      vec3 berry  = vec3(0.62, 0.20, 0.52);
      vec3 ncol = mix(deep, violet, smoothstep(0.2, 0.9, f));
      ncol = mix(ncol, berry, smoothstep(0.55, 1.0, r.y) * 0.55);
      ncol = mix(ncol, vec3(0.16, 0.32, 0.75), smoothstep(0.45, 1.0, q.x) * 0.5);  // blue nebula
      ncol += vec3(1.0, 0.45, 0.75) * glow * 0.22;
      ncol += vec3(0.9, 0.5, 1.0) * silk * 0.06;
      // twinkling stars
      vec2 cell = floor(gl_FragCoord.xy * 0.75);
      float sh = hash(cell);
      float tw = 0.5 + 0.5 * sin(u_time * (1.5 + sh * 3.0) + sh * 40.0);
      ncol += step(0.995, sh) * tw * vec3(1.0, 0.95, 1.0);
      // the moon's soft glow in the corner
      float moon = length(p - vec2(aspect * 0.86, 0.84));
      ncol += vec3(0.55, 0.65, 1.0) * exp(-moon * 5.0) * 0.12;
      ncol += u_boost * 0.12 * (0.5 + 0.5 * sin(d * 28.0 - u_time * 7.0)) * exp(-d * 2.0);
      col = mix(col, ncol, u_night);

      gl_FragColor = vec4(col, 1.0);
    }`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { cv.remove(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (n) => gl.getUniformLocation(prog, n);
  const uRes = U("u_res"), uTime = U("u_time"), uMouse = U("u_mouse"), uScroll = U("u_scroll"), uBoost = U("u_boost"), uNight = U("u_night");

  const SCALE = 0.5; // render at half resolution: it's soft anyway, and much faster
  function resize() {
    cv.width = Math.max(1, Math.round(innerWidth * SCALE));
    cv.height = Math.max(1, Math.round(innerHeight * SCALE));
    gl.viewport(0, 0, cv.width, cv.height);
  }
  resize();
  addEventListener("resize", resize);

  let mx = 0.5, my = 0.5, boost = 0, night = document.body.classList.contains("night") ? 1 : 0;   // start dark right away
  window.shaderNight = () => night;
  const pulse = () => { boost = 1; };
  ["ella:unlock", "ella:enter", "ella:yes"].forEach((e) => document.addEventListener(e, pulse));

  document.body.classList.add("gl-on");
  function frame(t) {
    const tx = mouse.x > -1 ? mouse.x / innerWidth : 0.5;
    const ty = mouse.y > -1 ? 1 - mouse.y / innerHeight : 0.5;
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    boost *= 0.985;
    gl.uniform2f(uRes, cv.width, cv.height);
    gl.uniform1f(uTime, t / 1000);
    gl.uniform2f(uMouse, mx, my);
    gl.uniform1f(uScroll, scrollY);
    gl.uniform1f(uBoost, boost);
    night += ((document.body.classList.contains("night") ? 1 : 0) - night) * 0.03;
    gl.uniform1f(uNight, night);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
