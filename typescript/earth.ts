import { WasmIcosphere } from "../pkg/star_catalog_wasm.js";
import {
  WasmVec2f32,
  WasmVec3f32,
  WasmMat4f32,
  WasmQuatf32,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { WebglTexture, Webgl, WebglObj } from "./web_gl.js";

import { ViewProperties } from "./view_properties.js";
import { Styling } from "./styling.js";
import { StarCatalog } from "./star_catalog.js";

export class Earth {
  star_catalog: StarCatalog;
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
  texture_image: HTMLImageElement;
  texture_loaded: boolean;
  texture_created: boolean;
  webgl_icosphere: WebglObj | null = null;
  webgl_triangle: WebglObj | null = null;
  webgl: Webgl | null = null;
  program: number = 0;
  texture: WebglTexture | null = null;
  q: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  styling: Styling;

  constructor(
    star_catalog: StarCatalog,
    canvas_div_id: string,
    width: number,
    height: number,
    use_webgl: boolean,
    division: number,
  ) {
    this.star_catalog = star_catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "earth");
    this.styling = this.star_catalog.styling;

    const size = Math.min(width, height);

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = size;
    this.height = size;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.webgl = new Webgl(star_catalog.log, this.canvas);

    // console.log("Earh: constructor: created with size ", this.width, this.height, " in ", canvas_div_id);

    this.use_webgl = use_webgl;
    this.ctx = null;

    this.mouse = new Mouse(this, this.canvas);

    this.icos = new WasmIcosphere();
    this.icos.subdivide(division);

    this.view_scale = 0.9;
    this.center_on_lat = this.vp.lat;
    this.center_on_lon = -this.vp.lon;

    this.texture_image = new Image();
    this.texture_loaded = false;
    this.texture_created = false;

    this.texture_image.onload = () => {
      this.logger.info("webgl", `Loaded earth texture`);
      this.texture_loaded = true;
      this.draw();
    };
    this.texture_image.src = "Blue_Marble_2002_x10.jpg";

    this.window_loaded();
  }

  center_lat_lon(lat: number, lon: number) {
    this.center_on_lat = lat;
    this.center_on_lon = -lon;
  }

  update() {
    this.draw();
  }

  //mi window_loaded
  window_loaded() {
    if (this.use_webgl) {
      this.start_webgl();
    }

    // this.canvas.width = this.canvas.offsetWidth;
    // this.canvas.height = this.canvas.offsetHeight;
    if (this.webgl === null) {
      this.ctx = this.canvas.getContext("2d")!;
      this.logger.info(
        "webgl",
        `Using 2D context for the earth sphere ${this.ctx}`,
      );
    } else {
      this.logger.info("webgl", `Using 3D context for the earth sphere`);
    }
  }

  //mi start_webgl
  start_webgl() {
    if (!this.webgl!.start_webgl()) {
      this.webgl = null;
      return;
    }

    const vertex_e = document.getElementById("vertex_src");
    const fragment_e = document.getElementById("fragment_src");
    if (vertex_e == null || fragment_e == null) {
      this.logger.error(
        "webgl",
        `Could not find both vertex and fragment src in the page`,
      );
      return;
    }
    const vertex_src = vertex_e.innerText;
    const fragment_src = fragment_e.innerText;

    const program = this.webgl!.compile_program(vertex_src, fragment_src);
    if (program === null) {
      this.webgl = null;
      return;
    }

    this.webgl_icosphere = new WebglObj(
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
    this.webgl_icosphere.webgl_create(this.webgl!.webgl!);

    this.webgl_triangle = new WebglObj(3, 3);
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
    this.webgl_triangle.webgl_create(this.webgl!.webgl!);

    this.texture = this.webgl!.create_texture();
    this.logger.info("webgl", `WebGl started successfully`);
  }

  webgl_draw() {
    if (this.webgl === null) {
      return;
    }
    this.webgl!.webgl!.viewport(0, 0, this.width, this.height);
    this.webgl.use_program(this.program);

    if (this.texture_loaded && !this.texture_created) {
      this.texture?.bind_to_image(this.texture_image);
      this.texture_created = true;
    }

    // WebGL has a clip space of -1,-1,-1 to 1,1,1; negative z is more visible
    this.webgl.programs[this.program]?.set_projection([
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
    ]);

    const matrix = WasmMat4f32.identity();
    this.q.set_rotation4(matrix);
    this.webgl.programs[this.program]?.set_view(matrix.transpose().array);

    if (this.texture_created) {
      this.webgl.programs[this.program]?.set_texture(this.texture!);
    }

    this.webgl.programs[this.program]?.set_color(this.styling.earth.color);

    const model = WasmMat4f32.identity();
    this.webgl.programs[this.program]?.set_model(model.array);

    this.webgl_icosphere!.draw(this.webgl!.webgl!);

    this.webgl.programs[this.program]?.set_color([1, 0, 0, 0]);

    this.triangle_q_ll.set_rotation4(matrix);
    this.webgl.programs[this.program]?.set_model(matrix.transpose().array);
    this.webgl_triangle!.draw(this.webgl!.webgl!);
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

    const world = this.q.conjugate().apply3(v);
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
    if (!this.texture_loaded) {
      return;
    }
    if (this.webgl !== null) {
      this.webgl_draw();
      return;
    }
    const f0 = 0;
    const f1 = this.icos.num_faces;
    for (var f = f0; f < f1; f++) {
      const vertices = this.icos.subdiv_face(f);
      const p_t0 = this.icos.subdiv_vertex(vertices[0]!);
      const p_t1 = this.icos.subdiv_vertex(vertices[1]!);
      const p_t2 = this.icos.subdiv_vertex(vertices[2]!);
      const p0 = this.q.apply3(p_t0.position);
      const p1 = this.q.apply3(p_t1.position);
      const p2 = this.q.apply3(p_t2.position);
      const n = p1.sub(p0).cross_product(p2.sub(p0));
      if (n.array[2]! < 0) {
        continue;
      }
      const v0 = this.v_of_p(p0);
      const v1 = this.v_of_p(p1);
      const v2 = this.v_of_p(p2);
      if (v0 == null || v1 == null || v2 == null) {
        continue;
      }
      const t0 = p_t0.texture;
      const t1 = p_t1.texture;
      const t2 = p_t2.texture;
      this.draw_triangle(v0, t0, v1, t1, v2, t2);
    }
  }

  // Draw a triangle in this context with three canvas coorinates an
  // three corresponding texture coordinates (0 to 1)
  //
  // Set the clip path to that of the canvas coordinates
  //
  // Set a transformation that is translate by v0 of (matrix M * N)
  //
  // Draw image at nominal -t0
  //
  // where N = rotate+skew ( (t1-t0) to X, (t2-t0) to Y )
  //
  // and M = rotate+skew ( X to (v1-v0), Y to (v2-v0) )
  //
  // Hence nominal coordinate (0,0) is texture t0; this maps through
  // M*N to 0, and hence to v0
  //
  // Nominal coordinate t1-t0 is texture t1; this maps through
  // M*N to X to (v1-v0), and hence to v1
  //
  // Nominal coordinate t2-t0 is texture t2; this maps through
  // M*N to Y to (v2-v0), and hence to v21
  draw_triangle(
    v0: [number, number],
    t0: WasmVec2f32,
    v1: [number, number],
    t1: WasmVec2f32,
    v2: [number, number],
    t2: WasmVec2f32,
  ): void {
    const ctx = this.ctx!;
    const tw = this.texture_image.width;
    const th = this.texture_image.height;
    ctx.save();
    if (true) {
      ctx.beginPath();
      ctx.moveTo(v0[0], v0[1]);
      ctx.lineTo(v1[0], v1[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.lineTo(v0[0], v0[1]);
      ctx.clip();
    }

    // Want to map t0 to v0, t1 to v1, t2 to v2
    //
    // Use a transform that maps (t1-t0) to (v1-v0)
    // and (t2-t0) to (v2-v0), and then adds v0
    //
    // Then draw the texture at -t0
    const tex0 = t0.array;
    const tex1 = t1.array;
    const tex2 = t2.array;
    const dt10: [number, number] = [
      (tex1[0]! - tex0[0]!) * tw,
      (tex1[1]! - tex0[1]!) * th,
    ];
    const dt20: [number, number] = [
      (tex2[0]! - tex0[0]!) * tw,
      (tex2[1]! - tex0[1]!) * th,
    ];
    const dv10: [number, number] = [v1[0] - v0[0], v1[1] - v0[1]];
    const dv20: [number, number] = [v2[0] - v0[0], v2[1] - v0[1]];

    const inv_det = dt10[0] * dt20[1] - dt10[1] * dt20[0];
    const inv: [number, number, number, number] = [
      dt20[1] / inv_det,
      -dt20[0] / inv_det,
      -dt10[1] / inv_det,
      dt10[0] / inv_det,
    ];
    const mat: [number, number, number, number] = [
      dv10[0] * inv[0] + dv20[0] * inv[2],
      dv10[0] * inv[1] + dv20[0] * inv[3],
      dv10[1] * inv[0] + dv20[1] * inv[2],
      dv10[1] * inv[1] + dv20[1] * inv[3],
    ];
    // console.log(mat[0] * dt20[0] + mat[1] * dt20[1],
    // mat[2] * dt20[0] + mat[3] * dt20[1],
    // );
    ctx.setTransform(mat[0], mat[2], mat[1], mat[3], v0[0], v0[1]);
    ctx.drawImage(this.texture_image, -tex0[0]! * tw, -tex0[1]! * th);
    ctx.restore();
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
    this.star_catalog.update_latlon(lat_lon[0], lat_lon[1]);
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
