import { WasmIcosphere } from "../pkg/star_catalog_wasm.js";
import { WasmVec3f32, WasmMat4f32 } from "../pkg/star_catalog_wasm.js";

import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { WebglTexture, WebglUniform, Webgl, Webgl3DObj } from "./web_gl.js";

import { Application } from "./application.js";
import { ViewProperties } from "./view_properties.js";

import { EarthShader } from "./shaders.js";

export class Earth {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;

  deg2rad = Math.PI / 180;
  rad2deg = 180 / Math.PI;

  mouse: Mouse;

  use_webgl: boolean;
  ctx: CanvasRenderingContext2D | null;
  icos: WasmIcosphere;
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_triangle: Webgl3DObj | null = null;
  webgl: Webgl | null = null;
  program: number = 0;
  texture: WebglTexture | null = null;

  view_scale: number;

  constructor(
    application: Application,
    canvas_div_id: string,
    width: number,
    height: number,
    use_webgl: boolean,
    division: number,
  ) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "earth");

    const size = Math.min(width, height);

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = size;
    this.height = size;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.webgl = new Webgl(application.log, this.canvas);

    this.use_webgl = use_webgl;
    this.ctx = null;

    this.mouse = new Mouse(this, this.canvas);

    this.icos = new WasmIcosphere();
    this.icos.subdivide(division);

    this.view_scale = 0.9;

    this.start_webgl();
  }

  start_webgl() {
    if (!this.webgl!.start_webgl()) {
      this.webgl = null;
      return;
    }

    const program = this.webgl!.compile_program(new EarthShader());
    if (program === null) {
      this.webgl = null;
      return;
    }
    this.program = program;

    this.webgl_icosphere = new Webgl3DObj(
      this.icos.num_vertices,
      this.icos.num_faces * 3,
    );
    for (var i = 0; i < this.icos.num_vertices; i++) {
      const v = this.icos.subdiv_vertex(i);
      this.webgl_icosphere.add_vertex(v.position.array, v.texture.array);
    }
    for (var i = 0; i < this.icos.num_faces; i++) {
      const f = this.icos.subdiv_face(i);
      this.webgl_icosphere.add_face([f[0]!, f[1]!, f[2]!]);
    }
    this.webgl!.create(this.webgl_icosphere);

    this.webgl_triangle = new Webgl3DObj(3, 3);
    this.webgl_triangle.add_vertex(
      new Float32Array([1.0, 0, 0.05773]),
      new Float32Array([0, 0]),
    );
    this.webgl_triangle.add_vertex(
      new Float32Array([1.0, -0.05, -0.02887]),
      new Float32Array([0, 0]),
    );
    this.webgl_triangle.add_vertex(
      new Float32Array([1.0, 0.05, -0.02887]),
      new Float32Array([0, 0]),
    );
    this.webgl_triangle.add_face([0, 2, 1]);
    this.webgl!.create(this.webgl_triangle);

    this.texture = new WebglTexture(this.webgl!, new Image()); // on loaded call this.draw()!
    this.texture.image!.src = "images/Blue_Marble_2002_x10.jpg";

    this.logger.info("webgl", `WebGl started successfully`);
  }

  update() {
    if (!this.texture!.texture_bound) {
      return;
    }
    if (this.webgl !== null) {
      this.webgl_draw();
    }
  }

  webgl_draw() {
    const styling = this.vp.styling();
    if (this.webgl === null) {
      return;
    }
    this.webgl.webgl!.viewport(0, 0, this.width, this.height);
    this.webgl.use_program(this.program);
    this.webgl.clear_buffer();

    this.vp.view_wh = [this.width, this.height];

    // WebGL has a clip space of -1,-1,-1 to 1,1,1; negative z is more visible
    const projection = [
      0,
      0,
      -this.view_scale,
      0,

      this.view_scale,
      0,
      0,
      0,

      0,
      this.view_scale,
      0,
      0,

      0,
      0,
      0,
      1,
    ];
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection);

    const matrix = WasmMat4f32.identity();
    this.vp.earth.q.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);

    this.webgl.set_texture(this.texture!);

    this.webgl.set_color(styling.earth.color);

    const model = WasmMat4f32.identity();
    this.webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
    this.webgl.draw(this.webgl_icosphere!);

    this.webgl.set_color([1, 0, 0, 0]);

    this.vp.earth.triangle_q_ll.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
    this.webgl.draw(this.webgl_triangle!);
  }

  drag_start(_start_xy: [number, number], _xy: [number, number]): void {}
  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  drag_to(
    _start_xy: [number, number],
    old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    const dcx = old_xy[0] - new_xy[0];
    const dcy = old_xy[1] - new_xy[1];
    this.vp.earth.center_on_lat -= dcy;
    this.vp.earth.center_on_lon -= dcx;
    this.application.view_updated();
  }

  user_release(_start_xy: [number, number], cxy: [number, number]): void {
    const lat_lon = this.vp.earth.latlon_of_cxy(this.vp, cxy);
    if (lat_lon == null) {
      return;
    }
    this.vp.update_latlon(lat_lon[0], lat_lon[1]);
    console.log(lat_lon[0], lat_lon[1]);
    this.application.location_updated();
  }

  user_zoom(_cxy: [number, number], factor: number): void {
    if (factor < 1.0) {
      this.vp.earth.center_on_lon -= 1.0 / factor;
    } else {
      this.vp.earth.center_on_lon += factor;
    }
    this.application.view_updated();
  }
}
