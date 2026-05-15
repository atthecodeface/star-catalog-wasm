import { WasmIcosphere } from "../pkg/star_catalog_wasm.js";
import {
  WasmVec3f32,
  WasmMat4f32,
  WasmQuatf32,
} from "../pkg/star_catalog_wasm.js";

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
  view_scale: number;
  center_on_lat: number;
  center_on_lon: number;
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_triangle: Webgl3DObj | null = null;
  webgl: Webgl | null = null;
  program: number = 0;
  texture: WebglTexture | null = null;
  q: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);

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
    this.center_on_lat = this.vp.lat;
    this.center_on_lon = -this.vp.lon;

    this.start_webgl();
  }

  center_lat_lon(lat: number, lon: number) {
    this.center_on_lat = lat;
    this.center_on_lon = -lon;
  }

  update() {
    this.draw();
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
    this.texture.image!.src = "Blue_Marble_2002_x10.jpg";

    this.logger.info("webgl", `WebGl started successfully`);
  }

  webgl_draw() {
    const styling = this.vp.styling();
    if (this.webgl === null) {
      return;
    }
    this.webgl.webgl!.viewport(0, 0, this.width, this.height);
    this.webgl.use_program(this.program);
    this.webgl.clear_buffer();

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
    this.q.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);

    this.webgl.set_texture(this.texture!);

    this.webgl.set_color(styling.earth.color);

    const model = WasmMat4f32.identity();
    this.webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
    this.webgl.draw(this.webgl_icosphere!);

    this.webgl.set_color([1, 0, 0, 0]);

    this.triangle_q_ll.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
    this.webgl.draw(this.webgl_triangle!);
  }

  derive_data() {
    if (this.center_on_lat < -80) {
      this.center_on_lat = -80;
    }
    if (this.center_on_lat > 80) {
      this.center_on_lat = 80;
    }
    if (this.center_on_lon < -180) {
      this.center_on_lon += 360;
    }
    if (this.center_on_lon > 180) {
      this.center_on_lon -= 360;
    }
    {
      const qy = WasmQuatf32.unit().rotate_y(
        this.center_on_lat * this.vp.deg2rad,
      );
      const qz = WasmQuatf32.unit().rotate_z(
        this.center_on_lon * this.vp.deg2rad,
      );
      this.q = qy.mul(qz);
    }
    {
      const qy = WasmQuatf32.unit().rotate_y(-this.vp.lat * this.vp.deg2rad);
      const qz = WasmQuatf32.unit().rotate_z(this.vp.lon * this.vp.deg2rad);
      this.triangle_q_ll = qz.mul(qy);
    }
  }

  latlon_of_cxy(cxy: [number, number]): [number, number] | null {
    this.derive_data();
    const dx = ((cxy[0] / this.width) * 2 - 1.0) / this.view_scale;
    const dy = (1.0 - (cxy[1] / this.height) * 2) / this.view_scale;
    const d2 = dx * dx + dy * dy;
    if (d2 >= 0.98) {
      return null;
    }
    const d = Math.sqrt(d2);
    const dz = Math.sqrt(1 - d2);
    const yaw = Math.atan2(d, dz);
    const roll = Math.atan2(dy, dx);
    const v = new WasmVec3f32(
      Math.cos(yaw),
      Math.sin(yaw) * Math.cos(roll),
      Math.sin(yaw) * Math.sin(roll),
    );

    const world = this.q.conjugate().apply(v);
    // const world = this.q.apply3(v);
    const lat = this.rad2deg * Math.asin(world.array[2]!);
    const lon = this.rad2deg * Math.atan2(world.array[1]!, world.array[0]!);
    return [lat, lon];
  }

  v_of_p(xyz_vec: WasmVec3f32): [number, number] {
    let xyz = xyz_vec.array;
    xyz[2]! += 4;
    // if (xyz[2] < 0.1) {
    // return null;
    // }
    const x = (xyz[0]! / xyz[2]! + 0.5) * this.width;
    const y = (xyz[1]! / xyz[2]! + 0.5) * this.height;
    return [x, y];
  }

  draw() {
    this.derive_data();
    if (!this.texture!.texture_bound) {
      return;
    }
    if (this.webgl !== null) {
      this.webgl_draw();
    }
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
    this.center_on_lat -= dcy;
    this.center_on_lon -= dcx;
    this.draw();
  }

  user_release(_start_xy: [number, number], cxy: [number, number]): void {
    const lat_lon = this.latlon_of_cxy(cxy);
    if (lat_lon == null) {
      return;
    }
    this.vp.update_latlon(lat_lon[0], lat_lon[1]);
    this.application.location_updated();
  }

  user_zoom(_cxy: [number, number], factor: number): void {
    if (factor < 1.0) {
      this.center_on_lon -= 1.0 / factor;
    } else {
      this.center_on_lon += factor;
    }
    this.draw();
  }
}
