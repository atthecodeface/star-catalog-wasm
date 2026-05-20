import { Log, Logger } from "./log.js";

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
  Extra1,
  Extra2,
  Extra3,
  Extra4,
}

export interface WebglObjKind {
  webgl_create(webgl: WebGLRenderingContext): void;
  webgl_set_uniforms(_wgl: Webgl): void;
  webgl_draw(webgl: WebGLRenderingContext): void;
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
  private load_shader(vertex: boolean, src: string): WebGLShader | null {
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
