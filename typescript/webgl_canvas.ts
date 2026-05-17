import {
  WasmVec3f32,
  WasmMat4f32,
  WasmMat4f64,
  WasmIcosphere,
  WasmQuatf64,
  WasmBezier3f32,
  WasmBezierBuilder3f32,
} from "../pkg/star_catalog_wasm.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

import {
  EarthShader,
  StarShader,
  SphereShader,
  StarMapShader,
} from "./shaders.js";

import { SolarSystem } from "./solar_system.js";
import { StarField } from "./star_field.js";
import { CacheKey, CacheSingleton } from "./cache.js";

import {
  Webgl,
  Webgl3DObj,
  WebglCubicBezierShader,
  WebglFlatShader,
  WebglFlatObj,
  WebglUniform,
  WebglCubicBezierObj,
} from "./web_gl.js";
import { WasmMemory } from "./wasm_memory.js";

export enum WebglCanvasView {
  Earth,
  SolarSystem,
  StarMap,
  SkyView,
}

export class CachedBezier {
  color: [number, number, number, number];
  control_pts: Float32Array;
  offset: number;

  static initialized: boolean = false;
  static bezier: WasmBezier3f32;
  static builder: WasmBezierBuilder3f32;
  static pt: WasmVec3f32;

  constructor(
    color: [number, number, number, number],
    control_pts: Float32Array,
    offset: number = 0,
  ) {
    this.control_pts = control_pts;
    this.color = color;
    this.offset = offset;
  }

  static init(): void {
    this.bezier = new WasmBezier3f32();
    this.builder = new WasmBezierBuilder3f32();
    this.pt = new WasmVec3f32(0, 0, 0);
  }
  static create_mapped(
    wasm_memory: WasmMemory,
    control_points: Float32Array,
    offset: number,
    color: [number, number, number, number],
    map: (i: number, x: number, y: number) => [number, number, number],
    x0_y0: [number, number],
    x1_y1: [number, number],
  ): CachedBezier {
    if (!this.initialized) {
      this.init();
    }

    this.builder.clear();
    for (let j = 0; j < 4; j++) {
      const x = (x0_y0[0] * (3 - j) + x1_y1[0] * j) / 3;
      const y = (x0_y0[1] * (3 - j) + x1_y1[1] * j) / 3;
      const pt0 = wasm_memory.float_array_of_vec3f32(this.pt);
      pt0.set(map(j, x, y), 0);
      this.builder.add_vec_pt_at(j / 3.0, this.pt);
    }
    this.bezier.reconstruct(this.builder);
    for (let j = 0; j < 4; j++) {
      this.bezier.set_vec_control_pt(this.pt, j);
      const pt0 = wasm_memory.float_array_of_vec3f32(this.pt);
      control_points.set(pt0, offset + j * 4);
    }
    return new CachedBezier(color, control_points, offset);
  }
}

class MapFrameKey implements CacheKey {
  q: WasmQuatf64;
  fovh: number;
  constructor(q: WasmQuatf64, fovh: number) {
    this.q = new WasmQuatf64(q.i, q.j, q.k, q.r);
    this.fovh = fovh;
  }
  key_is_equal(other: MapFrameKey): boolean {
    return this.q.distance_sq(other.q) == 0.0 && this.fovh == other.fovh;
  }
}

export class WebglCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  canvas: HTMLCanvasElement;

  webgl: Webgl | null = null;

  earth_program: number = 0;
  sphere_program: number = 0;
  flat_program: number = 0;
  bezier_program: number = 0;
  star_program: number = 0;
  star_map_program: number = 0;

  webgl_icosphere: Webgl3DObj | null = null;
  webgl_axis: WebglFlatObj | null = null;
  webgl_bezier: WebglCubicBezierObj | null = null;
  webgl_triangle: Webgl3DObj | null = null;
  webgl_circle: WebglFlatObj | null = null;

  solar_system: SolarSystem;
  star_field: StarField;

  model: WasmMat4f32 = WasmMat4f32.identity();
  current_wh: [number, number];

  sky_grid_beziers: CacheSingleton<MapFrameKey, CachedBezier[]>;

  map_frame_beziers: CacheSingleton<MapFrameKey, CachedBezier[]>;
  map_azimuthal_grid_beziers: CacheSingleton<MapFrameKey, CachedBezier[]>;
  map_equatorial_grid_beziers: CacheSingleton<MapFrameKey, CachedBezier[]>;

  constructor(application: Application, canvas: HTMLCanvasElement) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "webgl_canvas");

    this.sky_grid_beziers = new CacheSingleton();
    this.map_frame_beziers = new CacheSingleton();
    this.map_equatorial_grid_beziers = new CacheSingleton();
    this.map_azimuthal_grid_beziers = new CacheSingleton();

    this.canvas = canvas;

    this.canvas.height = 900;
    this.current_wh = [50, 50];
    this.webgl = new Webgl(application.log, this.canvas);

    this.solar_system = new SolarSystem();
    this.star_field = new StarField(application);

    if (!this.start_webgl(5)) {
      throw "Webgl was not created correctly; aborting webgl canvas";
    }
  }

  start_webgl(division: number): boolean {
    if (!this.webgl!.start_webgl()) {
      return false;
    }

    {
      const program = this.webgl!.compile_program(new EarthShader());
      if (program === null) {
        return false;
      }
      this.earth_program = program;
    }

    {
      const program = this.webgl!.compile_program(new SphereShader());
      if (program === null) {
        return false;
      } else {
        this.sphere_program = program;
      }
    }

    {
      const program = this.webgl!.compile_program(new StarShader());
      if (program === null) {
        return false;
      } else {
        this.star_program = program;
      }
    }

    {
      const program = this.webgl!.compile_program(new StarMapShader());
      if (program === null) {
        return false;
      } else {
        this.star_map_program = program;
      }
    }

    {
      const program = this.webgl!.compile_program(new WebglFlatShader());
      if (program === null) {
        return false;
      } else {
        this.flat_program = program;
      }
    }

    {
      const program = this.webgl!.compile_program(new WebglCubicBezierShader());
      if (program === null) {
        return false;
      } else {
        this.bezier_program = program;
      }
    }

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

    const icos = new WasmIcosphere();
    icos.subdivide(division);

    this.webgl_icosphere = new Webgl3DObj(
      icos.num_vertices,
      icos.num_faces * 3,
    );
    for (var i = 0; i < icos.num_vertices; i++) {
      const v = icos.subdiv_vertex(i);
      this.webgl_icosphere.add_vertex(v.position.array, v.texture.array);
    }
    for (var i = 0; i < icos.num_faces; i++) {
      const f = icos.subdiv_face(i);
      this.webgl_icosphere.add_face([f[0]!, f[1]!, f[2]!]);
    }
    this.webgl!.create(this.webgl_icosphere);

    this.webgl_axis = WebglFlatObj.axis(2, [
      [10, 0.05],
      [2, 0.1],
    ]);
    this.webgl!.create(this.webgl_axis);

    this.webgl_circle = WebglFlatObj.circle(1.0, 20);
    this.webgl!.create(this.webgl_circle);

    this.webgl_bezier = new WebglCubicBezierObj();
    this.webgl!.create(this.webgl_bezier);

    this.webgl!.create(this.star_field);

    this.solar_system.webgl_init(this.webgl!);

    this.logger.info(`Created full webgl content`);
    return true;
  }

  resize_canvas() {
    let wh = this.vp.get_resizable_content_size();
    if (this.current_wh != wh) {
      this.canvas.width = wh[0];
      this.canvas.height = wh[1];
      this.current_wh = wh;
    }

    this.vp.view_wh = this.current_wh;
  }

  redraw_canvas() {
    this.resize_canvas();
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];
    const ar = w / h;

    if (this.webgl === null) {
      return;
    }

    this.webgl.webgl!.viewport(0, 0, w, h);
    this.webgl.clear_buffer();

    // +Y moves it right
    // +Z moves it up
    // +X moves it out of screen
    const origin = new WasmVec3f32(0.0, 0.0, -3.0);
    const secs = this.vp.days_since_epoch * 86400;
    this.solar_system.set_time(secs);

    let projection = WasmMat4f32.identity().transpose().array;
    projection = WasmMat4f32.perspective(1.6, ar, 2.0, -20.0).transpose().array;
    projection = WasmMat4f32.identity().transpose().array;

    const f = 1.0 / Math.tan(this.vp.solar_system_fovh);
    const near = 1.0; // Maps to -1 in the Z, closest to the viewer, should scale by 1/near
    const far = 200.0; // Maps to +1 in the Z, furthest to the viewer, should scale by 1/far
    // W = -z
    // Z = (near + far) / (near - far) * z - (near * far * 2) / (near - far) = (near * z + far * z - near * far * 2) / (near - far)
    //  if z = near, Z(*w) = (near * near + far * near - near * far * 2) / (near - far) = (near * near - near * far) / (near - far) = near; Z = -1
    //  if z = far, Z(*w) = (near * far + far * far - near * far * 2) / (near - far) = (far * far - near * far) / (near - far) = -far; Z = 1
    // Note this has to flip the polarity of Z as the OpenGL clipping space is + into the screen, so -1 is near, +1 is far
    projection = new Float32Array([
      f,
      0,
      0,
      0,

      0,
      f * ar,
      0,
      0,

      0,
      0,
      (near + far) / (near - far), // scale by
      -1,

      0,
      0,
      (near * far * 2) / (near - far),
      0,
    ]);

    const view_matrix = WasmMat4f32.identity();

    this.vp.solar_sytem_orientation.set_mat4_rotation(view_matrix);

    this.webgl.use_program(this.star_program);
    this.webgl.set_color([1, 1, 1, 1]);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
    this.webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);
    this.webgl.draw(this.star_field);
    this.webgl.clear_depth_buffer();

    view_matrix.set_translate_by_vec3(origin);

    // Set view
    this.webgl.use_program(this.flat_program);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);

    // red for X axis
    this.webgl.set_color([1, 0.26, 0.16, 0.1]);
    this.webgl.set_uniform_mat4(
      WebglUniform.Model,
      [1, 0, 0, -1, /**/ 0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1],
      true,
    );
    this.webgl.draw(this.webgl_axis!);

    // purple for Z axis
    this.webgl.set_color([1, 0.2, 1.0, 1]);
    this.webgl.set_uniform_mat4(
      WebglUniform.Model,
      [0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 0, 1],
      true,
    );
    this.webgl.draw(this.webgl_axis!);

    // white for Y axis
    this.webgl.set_color([1, 1, 1, 1]);
    this.webgl.set_uniform_mat4(
      WebglUniform.Model,
      [0, 1, 0, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1],
      true,
    );
    this.webgl.draw(this.webgl_axis!);

    this.webgl.use_program(this.bezier_program);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
    this.solar_system.draw_orbits(this.webgl, this.webgl_bezier!);

    this.webgl.use_program(this.earth_program);

    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
    this.solar_system.draw_sun(this.webgl, this.webgl_icosphere!);
    this.solar_system.draw_planets(this.webgl, this.webgl_icosphere!);
  }

  draw_earth() {
    this.resize_canvas();
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];

    const view_scale = 0.9;
    const ar = w / h;

    if (this.webgl === null) {
      return;
    }

    const q = this.vp.earth.q;
    const triangle_q_ll = this.vp.earth.triangle_q_ll;

    this.webgl.webgl!.viewport(0, 0, w, h);
    this.webgl.clear_buffer();

    const styling = this.vp.styling();
    this.webgl.use_program(this.earth_program);

    // WebGL has a clip space of -1,-1,-1 to 1,1,1; negative z is more visible
    const projection = [
      0,
      0,
      -view_scale,
      0,

      view_scale / ar,
      0,
      0,
      0,

      0,
      view_scale,
      0,
      0,

      0,
      0,
      0,
      1,
    ];
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection);

    const matrix = WasmMat4f32.identity();
    q.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);

    const t = this.solar_system.earth_texture();
    if (t !== null) {
      this.webgl.set_texture(t!);
    }

    this.webgl.set_color(styling.earth.color);

    const model = WasmMat4f32.identity();
    this.webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
    this.webgl.draw(this.webgl_icosphere!);

    this.webgl.set_color([1, 0, 0, 0]);

    triangle_q_ll.set_mat4_rotation(matrix);
    this.webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
    this.webgl.draw(this.webgl_triangle!);
  }

  draw_sky_view() {
    this.resize_canvas();
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];

    if (this.webgl === null) {
      return;
    }

    this.sky_grid_beziers.set_contents(
      new MapFrameKey(WasmQuatf64.unit(), 1.0),
      () => this.vp.star_catalog.sky_canvas.create_azimuthal_grid_beziers(),
    );

    // const view_scale = 1.0;
    const ar = w / h;

    this.webgl.webgl!.viewport(0, 0, w, h);
    this.webgl.clear_buffer();

    const f = 1.2 / this.vp.tan_hfovh;
    // W = -z
    // Z = (near + far) / (near - far) * z - (near * far * 2) / (near - far) = (near * z + far * z - near * far * 2) / (near - far)
    //  if z = near, Z(*w) = (near * near + far * near - near * far * 2) / (near - far) = (near * near - near * far) / (near - far) = near; Z = -1
    //  if z = far, Z(*w) = (near * far + far * far - near * far * 2) / (near - far) = (far * far - near * far) / (near - far) = -far; Z = 1
    // Note this has to flip the polarity of Z as the OpenGL clipping space is + into the screen, so -1 is near, +1 is far
    const projection = new Float32Array([
      f,
      0,
      0,
      0,

      0,
      f * ar,
      0,
      0,

      0,
      0,
      1,
      0,

      0,
      0,
      0,
      1,
    ]);

    this.webgl.use_program(this.star_program);
    this.webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);

    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);

    const matrix = WasmMat4f64.identity();
    this.vp.ecef_to_view_q.set_mat4_rotation(matrix);

    this.webgl.set_color([1, 1, 1, 1]);
    this.webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);
    this.webgl.draw(this.star_field);
  }

  draw_star_map() {
    this.resize_canvas();
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];

    if (this.webgl === null) {
      return;
    }

    this.map_frame_beziers.set_contents(
      new MapFrameKey(this.vp.view_to_ecef_q, this.vp.fovh),
      () => this.vp.star_catalog.map_canvas.create_frame_beziers(),
    );
    this.map_azimuthal_grid_beziers.set_contents(
      new MapFrameKey(this.vp.observer_to_ecef_q, 1.0),
      () => this.vp.star_catalog.map_canvas.create_azimuthal_grid_beziers(),
    );
    this.map_equatorial_grid_beziers.set_contents(
      new MapFrameKey(WasmQuatf64.unit(), 1.0),
      () => this.vp.star_catalog.map_canvas.create_equatorial_grid_beziers(),
    );

    const view_scale = 1.0;
    const ar = 1.6;
    let xsc = 1.0;
    let ysc = w / h / ar;
    console.log(w, h, xsc, ysc);
    if (ysc > 1.0) {
      xsc /= ysc;
      ysc = 1.0;
    }
    this.webgl.webgl!.viewport(0, 0, w, h);
    this.webgl.clear_buffer();

    this.webgl.use_program(this.star_map_program);
    this.webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);

    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const view = [
      view_scale * xsc,
      0,
      0,
      0,

      0,
      view_scale * ysc,
      0,
      0,

      0,
      0,
      1,
      0,

      0,
      0,
      0,
      1,
    ];

    this.webgl.set_color([1, 1, 1, 1]);
    this.webgl.set_uniform_mat4(WebglUniform.View, view, true);
    this.webgl.draw(this.star_field);

    this.webgl.use_program(this.bezier_program);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, identity, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view, true);
    this.webgl.set_uniform_mat4(WebglUniform.Model, identity, true);

    for (const bezier_sets of [
      this.map_frame_beziers.get_contents(),
      this.map_azimuthal_grid_beziers.get_contents(),
      this.map_equatorial_grid_beziers.get_contents(),
    ]) {
      if (bezier_sets === null) {
        continue;
      }
      for (const b of bezier_sets) {
        this.webgl.set_color(b.color);
        this.webgl_bezier!.set_control_points(b.control_pts, b.offset);
        this.webgl.draw(this.webgl_bezier!);
      }
    }

    this.webgl.use_program(this.flat_program);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, identity, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view, true);
    this.webgl.set_color([1, 0.26, 0.16, 0.1]);
    if (this.vp.selected_star) {
      const star = this.vp.catalog.star(this.vp.selected_star)!;

      const radius = 0.02;
      let cx = (star.right_ascension / Math.PI) * 1.0;
      let cy = (star.declination / Math.PI) * 2.0;
      if (cx > 1) {
        cx -= 2;
      }
      if (cy > 1) {
        cy -= 2;
      }
      this.webgl.set_uniform_mat4(
        WebglUniform.Model,
        [
          radius,
          0,
          0,
          cx,
          /**/ 0,
          radius * ar,
          0,
          cy,
          /**/ 0,
          0,
          1,
          0,
          /**/ 0,
          0,
          0,
          1,
        ],
        true,
      );
      this.webgl.draw(this.webgl_circle!);
    }
  }
}
