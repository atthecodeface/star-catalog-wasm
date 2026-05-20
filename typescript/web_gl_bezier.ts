import { WasmBezier3f32, WasmVec3f32 } from "./wasm_pkg.js";

import { WebglShaderSrc, WebglObjKind, Webgl, WebglUniform } from "./web_gl.js";

export class WebglCubicBezierShader implements WebglShaderSrc {
  id = "weblgl_cubic_bezier";
  extra_uniforms = ["control_points"];
  vertex = `
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;
  uniform mat4 control_points;

  attribute float position;

  void main() {

    float t = position;
    float u = 1.0 - t;
    float u2 = u * u;
    float t2 = t*t;
    float c0 = u2*u;
    float c1 = t*u2*3.0;
    float c2 = t2*u*3.0;
    float c3 = t*t2;

    vec4 pos = c0 * control_points[0];
    pos += c1 * control_points[1];
    pos += c2 * control_points[2];
    pos += c3 * control_points[3];

    pos.w = 1.0;
    pos = projection * view * model * pos;
    gl_Position = pos;
  }
  `;
  fragment = `
  precision mediump float;
  uniform vec4 color;
  void main() {
  gl_FragColor.r = color.r;
  gl_FragColor.g = color.g;
  gl_FragColor.b = color.b;
  gl_FragColor.a = color.a;
  }
  `;
}

export class WebglCubicBezierObj implements WebglObjKind {
  control_points: Float32Array;
  control_points_offset: number;
  positions: Float32Array;
  position_buf: WebGLBuffer | null = null;
  point: WasmVec3f32;

  constructor(steps: number = 10, min_t: number = 0, max_t: number = 1) {
    this.positions = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      this.positions[i] = (i / (steps - 1.0)) * (max_t - min_t) + min_t;
    }
    this.control_points = new Float32Array(4 * 4);
    this.control_points_offset = 0;
    this.point = WasmVec3f32.zero();
  }

  static of_bezier(
    bezier: WasmBezier3f32,
    steps: number = 10,
  ): WebglCubicBezierObj {
    const b = new WebglCubicBezierObj(steps);
    b.set_bezier(bezier);
    return b;
  }

  set_bezier(bezier: WasmBezier3f32): void {
    bezier.set_vec_control_pt(this.point, 0);
    this.control_points.set(this.point.array, 0);
    bezier.set_vec_control_pt(this.point, 1);
    this.control_points.set(this.point.array, 4);
    bezier.set_vec_control_pt(this.point, 2);
    this.control_points.set(this.point.array, 8);
    bezier.set_vec_control_pt(this.point, 3);
    this.control_points.set(this.point.array, 12);
    this.control_points_offset = 0;
  }

  set_control_points(control_points: Float32Array, offset: number = 0): void {
    this.control_points = control_points;
    this.control_points_offset = offset;
  }

  webgl_create(webgl: WebGLRenderingContext) {
    this.position_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.positions.buffer,
      webgl.STATIC_DRAW,
    );
  }

  webgl_set_uniforms(wgl: Webgl) {
    wgl.set_uniform_mat4(
      WebglUniform.Extra0,
      this.control_points.slice(
        this.control_points_offset,
        this.control_points_offset + 16,
      ),
      false,
    );
  }

  webgl_draw(webgl: WebGLRenderingContext) {
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.enableVertexAttribArray(0);
    webgl.vertexAttribPointer(0, 1, webgl.FLOAT, false, 0, 0);

    webgl.drawArrays(webgl.LINE_STRIP, 0, this.positions.length);
  }
}
