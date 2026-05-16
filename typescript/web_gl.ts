import { WasmBezier3f32, WasmVec3f32 } from "../pkg/star_catalog_wasm.js";
import { Log, Logger } from "./log.js";

export class WebglFlatShader {
  id = "weblgl_flat";
  extra_uniforms = [];
  vertex = `
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  attribute vec2 position;

  void main() {
    vec4 position4;
    vec4 pos;
    position4.x = position.x;
    position4.y = position.y;
    position4.z = 0.0;
    position4.w = 1.0;
    pos = projection * view * model * position4;
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

export class WebglCubicBezierShader {
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

export interface WebglShaderSrc {
  id: string;
  extra_uniforms: string[];
  vertex: string;
  fragment: string;
}

export enum WebglUniform {
  Projection,
  View,
  Model,
  Color,
  Sampler,
  Extra0,
}

export interface WebglObjKind {
  webgl_create(webgl: WebGLRenderingContext): void;
  webgl_set_uniforms(_wgl: Webgl): void;
  webgl_draw(webgl: WebGLRenderingContext): void;
}

export class WebglFlatObj implements WebglObjKind {
  positions: Float32Array;
  indices: Uint16Array;
  num_vertices: number = 0;
  num_indices: number = 0;
  position_buf: WebGLBuffer | null = null;
  indices_buf: WebGLBuffer | null = null;

  constructor(positions: Float32Array, indices: Uint16Array) {
    this.positions = positions;
    this.indices = indices;
    this.num_indices = this.indices.length;
    this.num_vertices = this.positions.length / 2;
  }

  static axis(length: number, ticks: [number, number][]): WebglFlatObj {
    let pts = [];
    let lines = [];
    pts.push(0, 0, length, 0);
    lines.push(0, 1);
    let pt_index = 2;
    for (const ab of ticks) {
      const ticks_per_unit = ab[0];
      const dy = ab[1];
      for (let x = 0; x <= length * ticks_per_unit; x++) {
        const px = x / (ticks_per_unit + 0.0);
        pts.push(px, 0, px, dy);
        lines.push(pt_index, pt_index + 1);
        pt_index += 2;
      }
    }
    return new WebglFlatObj(new Float32Array(pts), new Uint16Array(lines));
  }

  static circle(radius: number, steps: number): WebglFlatObj {
    let pts = [];
    let lines = [];
    let da = Math.PI / (steps * 0.5);
    for (let i = 0; i < steps; i++) {
      let x = radius * Math.cos(i * da);
      let y = radius * Math.sin(i * da);
      pts.push(x, y);
      lines.push(i, (i + 1) % steps);
    }
    return new WebglFlatObj(new Float32Array(pts), new Uint16Array(lines));
  }

  set_point(index: number, x: number, y: number) {
    this.positions[index * 2]! = x;
    this.positions[index * 2 + 1]! = y;
  }

  set_line(index: number, start: number, end: number) {
    this.indices[2 * index + 0] = start;
    this.indices[2 * index + 1] = end;
  }

  webgl_create(webgl: WebGLRenderingContext) {
    this.position_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.positions.buffer,
      webgl.STATIC_DRAW,
    );

    this.indices_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.bufferData(
      webgl.ELEMENT_ARRAY_BUFFER,
      this.indices.buffer,
      webgl.STATIC_DRAW,
    );
  }

  webgl_set_uniforms(_wgl: Webgl) {}

  webgl_draw(webgl: WebGLRenderingContext) {
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.enableVertexAttribArray(0);
    webgl.vertexAttribPointer(0, 2, webgl.FLOAT, false, 0, 0);

    webgl.lineWidth(1);
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.drawElements(webgl.LINES, this.num_indices, webgl.UNSIGNED_SHORT, 0);
  }
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
    this.point = new WasmVec3f32(0, 0, 0);
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

    webgl.lineWidth(1);
    webgl.drawArrays(webgl.LINE_STRIP, 0, this.positions.length);
  }
}

export class Webgl3DObj implements WebglObjKind {
  positions: Float32Array;
  tex_coords: Float32Array;
  indices: Uint16Array;
  num_vertices: number = 0;
  num_indices: number = 0;
  position_buf: WebGLBuffer | null = null;
  tex_coord_buf: WebGLBuffer | null = null;
  indices_buf: WebGLBuffer | null = null;

  constructor(max_vertices: number, max_indices: number) {
    this.positions = new Float32Array(3 * max_vertices);
    this.tex_coords = new Float32Array(2 * max_vertices);
    this.indices = new Uint16Array(3 * max_indices);
  }

  add_vertex(position: Float32Array, texcoord: Float32Array) {
    this.positions.set(position, this.num_vertices * 3);
    this.tex_coords.set(texcoord, this.num_vertices * 2);
    this.num_vertices += 1;
  }

  add_face(indices: number[]) {
    this.indices.set(indices, this.num_indices);
    this.num_indices += indices.length;
  }

  webgl_set_uniforms(_wgl: Webgl) {}

  webgl_create(webgl: WebGLRenderingContext) {
    this.position_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.positions.buffer,
      webgl.STATIC_DRAW,
    );

    this.tex_coord_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
    webgl.bufferData(
      webgl.ARRAY_BUFFER,
      this.tex_coords.buffer,
      webgl.STATIC_DRAW,
    );

    this.indices_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.bufferData(
      webgl.ELEMENT_ARRAY_BUFFER,
      this.indices.buffer,
      webgl.STATIC_DRAW,
    );
  }

  webgl_draw(webgl: WebGLRenderingContext) {
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
    webgl.enableVertexAttribArray(0);
    webgl.vertexAttribPointer(0, 3, webgl.FLOAT, false, 0, 0);
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
    webgl.enableVertexAttribArray(1);
    webgl.vertexAttribPointer(1, 2, webgl.FLOAT, false, 0, 0);

    webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
    webgl.drawElements(
      webgl.TRIANGLES,
      this.num_indices,
      webgl.UNSIGNED_SHORT,
      0,
    );
  }
}

export class WebglProgram {
  owner: string;
  webgl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: (WebGLUniformLocation | null)[];
  matrix = new Float32Array(16);

  constructor(
    shader: WebglShaderSrc,
    webgl: WebGLRenderingContext,
    program: WebGLProgram,
  ) {
    this.owner = shader.id;
    this.program = program;
    // At least up to 'Extra' uniforms...
    this.uniforms = [null, null, null, null, null];
    const u_projection = webgl.getUniformLocation(program, "projection");
    const u_view = webgl.getUniformLocation(program, "view");
    const u_model = webgl.getUniformLocation(program, "model");
    const u_color = webgl.getUniformLocation(program, "color");
    const u_sampler = webgl.getUniformLocation(program, "uSampler");
    this.uniforms[WebglUniform.Projection] = u_projection;
    this.uniforms[WebglUniform.View] = u_view;
    this.uniforms[WebglUniform.Model] = u_model;
    this.uniforms[WebglUniform.Sampler] = u_sampler;
    this.uniforms[WebglUniform.Color] = u_color;
    this.webgl = webgl;

    for (const e of shader.extra_uniforms) {
      const u = webgl.getUniformLocation(program, e);
      this.uniforms.push(u);
    }
  }

  set_uniform_mat4(
    uniform: WebglUniform,
    matrix: ArrayLike<number>,
    transpose: boolean = false,
  ) {
    const u = this.uniforms[uniform];
    if (u !== null) {
      if (transpose) {
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            this.matrix[i * 4 + j]! = matrix[j * 4 + i]!;
          }
        }
      } else {
        this.matrix.set(matrix);
      }
      this.webgl.uniformMatrix4fv(u!, false, this.matrix);
    }
  }

  set_uniform_float(uniform: WebglUniform, value: number) {
    const u = this.uniforms[uniform];
    if (u !== null) {
      this.webgl.uniform1f(u!, value);
    }
  }

  set_uniform_vec4(uniform: WebglUniform, value: number[]) {
    const u = this.uniforms[uniform];
    if (u !== null) {
      this.webgl.uniform4fv(u!, value);
    }
  }

  set_texture(uniform: WebglUniform, texture: WebglTexture) {
    const u = this.uniforms[uniform];
    if (u !== null) {
      this.webgl.activeTexture(this.webgl.TEXTURE0);
      this.webgl.bindTexture(this.webgl.TEXTURE_2D, texture.texture);
      this.webgl.uniform1i(u!, 0);
    }
  }
}

export class WebglTexture {
  webgl: Webgl;
  texture: WebGLTexture;

  image: HTMLImageElement | null = null;
  image_load_completed: boolean = false;
  texture_bound: boolean = false;

  constructor(webgl: Webgl, image: HTMLImageElement | null = null) {
    this.webgl = webgl;

    const w = webgl.webgl;
    if (w === null) {
      throw "Webgl not constructed correctly for a WebglTexture";
    }

    this.texture = w.createTexture();
    this.image = image;
    if (this.image !== null) {
      this.image.addEventListener("load", this.image_loaded.bind(this));
    }

    w.bindTexture(w.TEXTURE_2D, this.texture);
    w.texImage2D(
      w.TEXTURE_2D,
      0,
      w.RGBA,
      1,
      1,
      0,
      w.RGBA,
      w.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 255, 255]),
    );

    w.texParameteri(w.TEXTURE_2D, w.TEXTURE_MIN_FILTER, w.LINEAR);

    w.texParameteri(w.TEXTURE_2D, w.TEXTURE_WRAP_S, w.CLAMP_TO_EDGE);

    w.texParameteri(w.TEXTURE_2D, w.TEXTURE_WRAP_T, w.CLAMP_TO_EDGE);
  }

  image_loaded(_event: any) {
    this.image_load_completed = true;
    this.bind_to_image(this.image!);
  }

  bind_to_image(source: TexImageSource) {
    const w = this.webgl.webgl!;
    w.bindTexture(w.TEXTURE_2D, this.texture);
    w.texImage2D(w.TEXTURE_2D, 0, w.RGBA, w.RGBA, w.UNSIGNED_BYTE, source);
    this.texture_bound = true;
  }
}

export class Webgl {
  logger: Logger;
  canvas: HTMLCanvasElement;

  programs: WebglProgram[] = [];
  current_program: WebglProgram | null = null;

  webgl: WebGLRenderingContext | null = null;

  constructor(log: Log, canvas: HTMLCanvasElement) {
    this.logger = new Logger(log, "webgl");

    this.canvas = canvas;
  }

  /** Start WebGL - invoke this when the window has loaded
   *
   */
  start_webgl(): boolean {
    var gl: WebGLRenderingContext | null;
    try {
      gl = this.canvas.getContext("webgl2");
    } catch (x) {
      this.logger.error("webgl", `Failed to get WebGL context`);
      return false;
    }
    this.webgl = gl;
    return gl !== null;
  }

  /** Load a shader
   *
   */
  load_shader(vertex: boolean, src: string): WebGLShader | null {
    const webgl = this.webgl!;
    let kind: number = webgl.VERTEX_SHADER;
    if (!vertex) {
      kind = webgl.FRAGMENT_SHADER;
    }
    const shader = webgl.createShader(kind);
    if (shader == null) {
      this.logger.error("Failed to create shader");
      return null;
    }
    webgl.shaderSource(shader, src);
    webgl.compileShader(shader);
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
      this.logger.error(
        `Failed to compile shader ${webgl.getShaderInfoLog(shader)}`,
      );
      return null;
    }
    return shader;
  }

  compile_program(shader: WebglShaderSrc): null | number {
    if (this.webgl === null) {
      return null;
    }
    const webgl = this.webgl!;

    const program = webgl.createProgram();

    const owner = shader.id;
    const vs = this.load_shader(true, shader.vertex);
    if (vs == null) {
      this.logger.error(
        "webgl",
        `Failed to compile vertex shader for ${owner}`,
      );
      return null;
    }
    webgl.attachShader(program, vs);
    webgl.deleteShader(vs);
    const fs = this.load_shader(false, shader.fragment);
    if (fs == null) {
      this.logger.error(
        "webgl",
        `Failed to compile fragment shader for ${owner}`,
      );
      return null;
    }
    webgl.attachShader(program, fs);
    webgl.deleteShader(fs);

    webgl.linkProgram(program);
    webgl.useProgram(program);
    if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
      this.logger.error(
        "webgl",
        `Failed to load shaders for ${owner} ${webgl.getProgramInfoLog(program)}`,
      );
      return null;
    }

    const n = this.programs.length;
    this.programs.push(new WebglProgram(shader, webgl, program));
    return n;
  }

  clear_buffer() {
    if (this.webgl === null) {
      return;
    }
    this.webgl.enable(this.webgl.DEPTH_TEST); // Enable depth testing
    this.webgl.depthFunc(this.webgl.LEQUAL); // Near things obscure far things
    this.webgl.clear(this.webgl.COLOR_BUFFER_BIT | this.webgl.DEPTH_BUFFER_BIT);
  }

  clear_depth_buffer() {
    if (this.webgl === null) {
      return;
    }
    this.webgl.clear(this.webgl.DEPTH_BUFFER_BIT);
  }

  use_program(p: number): void {
    if (this.webgl === null) {
      return;
    }

    const program = this.programs[p];
    if (program === undefined) {
      return;
    }
    this.current_program = program;
    this.webgl.useProgram(this.current_program.program);
  }

  create(obj: WebglObjKind) {
    if (this.webgl !== null) {
      obj.webgl_create(this.webgl);
    }
  }

  set_uniform_float(uniform: WebglUniform, value: number) {
    if (this.current_program === null) {
      return;
    }
    this.current_program.set_uniform_float(uniform, value);
  }

  set_uniform_vec4(uniform: WebglUniform, value: number[]) {
    if (this.current_program === null) {
      return;
    }
    this.current_program.set_uniform_vec4(uniform, value);
  }

  set_uniform_mat4(
    uniform: WebglUniform,
    matrix: ArrayLike<number>,
    transpose: boolean = false,
  ) {
    if (this.current_program === null) {
      return;
    }
    this.current_program.set_uniform_mat4(uniform, matrix, transpose);
  }

  set_color(color: number[]) {
    if (this.current_program === null) {
      return;
    }
    this.current_program.set_uniform_vec4(WebglUniform.Color, color);
  }

  set_texture(texture: WebglTexture) {
    if (this.current_program === null) {
      return;
    }
    this.current_program.set_texture(WebglUniform.Sampler, texture);
  }

  draw(obj: WebglObjKind) {
    if (this.webgl !== null) {
      obj.webgl_set_uniforms(this);
      obj.webgl_draw(this.webgl);
    }
  }
}
