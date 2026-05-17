import {
  WasmVec3f32,
  WasmVec3f64,
  WasmQuatf64,
  WasmStar,
  WasmBezierBuilder3f32,
  WasmBezier3f32,
} from "../pkg/star_catalog_wasm.js";
import { Line } from "./draw.js";
import { CacheOld } from "./cache.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";
import { WebglCanvasView, CachedBezier } from "./webgl_canvas.js";

export class MapCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  brightness: number;
  star_cache: CacheOld<any>;

  mouse: Mouse;

  last_drag_polar: [number, number] = [0, 0];
  drag_minutes: boolean = false;

  bezier = new WasmBezier3f32();
  builder = new WasmBezierBuilder3f32();
  vec = new WasmVec3f64(0, 0, 0);
  pt = new WasmVec3f32(0, 0, 0);

  to_left: boolean = false;
  constructor(
    application: Application,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.application = application;
    this.vp = this.application.view_properties;
    this.logger = new Logger(application.log, "map");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = width;
    this.height = height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.brightness = 4.0;
    this.star_cache = new CacheOld(
      null,
      (_x) => {
        return false;
      },
      this.fill_star_cache.bind(this),
    );
    this.star_cache.force_refresh();

    this.mouse = new Mouse(this, this.canvas);

    this.logger.info(`Created map canvas`);
  }

  //mi fill_star_cache
  fill_star_cache(_x: WasmStar[]): WasmStar[] {
    const catalog = this.application.catalog;
    const stars = [];
    console.log("Fill map canvas cache");

    const XP_AXIS = new WasmVec3f64(1, 0, 0);
    catalog.clear_filter();
    catalog.filter_max_magnitude(this.brightness);
    for (const index of catalog.find_stars_around(XP_AXIS, 1.6, 0, 1000)) {
      stars.push(catalog.star(index)!);
    }

    catalog.clear_filter();
    catalog.filter_max_magnitude(this.brightness);
    for (const index of catalog.find_stars_around(
      XP_AXIS.neg(),
      1.6,
      0,
      1000,
    )) {
      stars.push(catalog.star(index)!);
    }
    return stars;
  }

  //mp update
  update() {
    this.vp.webgl_canvas_view = WebglCanvasView.StarMap;

    this.derive_data();
    this.redraw_canvas();
  }

  //mi derive_data
  derive_data() {
    const wh = this.vp.get_resizable_content_size();
    let set_w = wh[0];
    let set_h = wh[1];
    const ar = 2.0;
    if (set_w > set_h * ar) {
      set_w = set_h * ar;
    }
    if (set_h > set_w / ar) {
      set_h = set_w / ar;
    }

    if (set_w != this.width || set_h != this.height) {
      this.width = set_w;
      this.height = set_h;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }
  }

  //mi ra_de_of_cxy
  ra_de_of_cxy(cxy: [number, number]): [number, number] {
    const fx = cxy[0] / this.width;
    const fy = cxy[1] / this.height;
    const ra = (fx - 0.5) * 2 * Math.PI;
    const de = (0.5 - fy) * Math.PI;
    return [ra, de];
  }

  //mi cxy_of_ra_de
  // Canvas XY of RA and DE
  //
  // Canvas coordinates are X+ right Y+ down
  //
  // Declination 0 at the moddle, +DE up (PI for the height)
  //
  // RA is 0 at the middle RA+ right (2PI for the width)
  cxy_of_ra_de(ra: number, de: number): [number, number] {
    const x = 0.5 + ra / (2 * Math.PI);
    const y = 0.5 - de / Math.PI;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const cx = fx * this.width;
    const cy = fy * this.height;
    return [cx, cy];
  }

  //mi cxy_of_vector
  // canvas XY of a vector
  //
  // X+ is in, Y+ is left, Z+ is up; sin(z) is declination (or atan(z/x))
  cxy_of_vector(vec: WasmVec3f64): [number, number] {
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);
    const de = Math.asin(vxyz[2]!);
    const ra = Math.atan2(vxyz[1]!, vxyz[0]!);
    return this.cxy_of_ra_de(ra, de);
  }

  map_ra_de(i: number, ra: number, de: number): [number, number, number] {
    const de_c = Math.cos(de);
    const de_s = Math.sin(de);
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(this.vec);
    vxyz[0] = de_c * Math.cos(ra);
    vxyz[1] = de_c * Math.sin(ra);
    vxyz[2] = de_s;
    this.vp.observer_to_ecef_q.set_vec_apply(this.vec);

    let de_frame = (Math.asin(vxyz[2]!) / Math.PI) * 2.0;
    let ra_frame = (Math.atan2(vxyz[1]!, vxyz[0]!) / Math.PI) * 1.0;

    if (i == 0) {
      this.to_left = ra_frame < 0.0;
    } else {
      if (this.to_left && ra_frame > 0.5) {
        ra_frame -= 2.0;
      } else if (!this.to_left && ra_frame < -0.5) {
        ra_frame += 2.0;
      }
    }
    return [ra_frame, de_frame, 0.0];
  }

  // 8 bezier per
  create_declination_circle_beziers(
    control_points: Float32Array,
    offset: number,
    result: CachedBezier[],
    de: number,
  ): number {
    const de_r = de * this.vp.deg2rad;
    const da = this.vp.deg2rad;
    for (let i = 0; i < 360; i += 45) {
      const ra = i * da;
      result.push(
        CachedBezier.create_mapped(
          this.application.wasm_memory,
          control_points,
          offset,
          [1, 1, 0, 1],
          this.map_ra_de.bind(this),
          [ra, de_r],
          [ra + da * 45, de_r],
        ),
      );
      offset += 16;
    }
    return offset;
  }

  // -80 to 80 in steps of 10 is 17; so 17 bezier per
  create_ra_great_circle_half_beziers(
    control_points: Float32Array,
    offset: number,
    result: CachedBezier[],
    ra: number,
  ): number {
    const ra_r = ra * this.vp.deg2rad;
    const da = this.vp.deg2rad;
    for (let i = -80; i <= 70; i += 10) {
      const de = i * da;
      result.push(
        CachedBezier.create_mapped(
          this.application.wasm_memory,
          control_points,
          offset,
          [1, 0, 1, 1],
          this.map_ra_de.bind(this),
          [ra_r, de],
          [ra_r, de + da * 10],
        ),
      );
      offset += 16;
    }
    return offset;
  }

  create_azimuthal_grid_beziers(): CachedBezier[] {
    const result: CachedBezier[] = [];
    const control_points = new Float32Array((160 + 408) * 16); // 4 axes each of 10 Beziers each of one mat4 (16 control point coordinates)
    let b = 0;

    // Each of these is 8 beziers; this is 19 circles (call it 20 for now)

    // Equator
    b = this.create_declination_circle_beziers(control_points, b, result, 0.0); // color
    // Above / below horizon
    for (let de = 10; de <= 80; de += 10) {
      b = this.create_declination_circle_beziers(control_points, b, result, de);
      b = this.create_declination_circle_beziers(
        control_points,
        b,
        result,
        -de,
      );
    }

    // Each of these is 17 beziers; this is 24 circles (408 beziers)

    // Longitude 0
    b = this.create_ra_great_circle_half_beziers(control_points, b, result, 0);
    // Longitude 180
    b = this.create_ra_great_circle_half_beziers(
      control_points,
      b,
      result,
      180,
    );
    // Other longitudes
    for (let ra = 15; ra <= 165; ra += 15) {
      b = this.create_ra_great_circle_half_beziers(
        control_points,
        b,
        result,
        ra,
      );
      b = this.create_ra_great_circle_half_beziers(
        control_points,
        b,
        result,
        -ra,
      );
    }
    return result;
  }

  map_xy_view_frame(i: number, x: number, y: number): [number, number, number] {
    this.application.sky_view_frame_to_ecef_set_vec(x, y, this.vec);
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(this.vec);
    let de = (Math.asin(vxyz[2]!) / Math.PI) * 2.0;
    let ra = (Math.atan2(vxyz[1]!, vxyz[0]!) / Math.PI) * 1.0;

    if (i == 0) {
      this.to_left = ra < 0.0;
    } else {
      if (this.to_left && ra > 0.75) {
        ra -= 2.0;
      } else if (!this.to_left && ra < -0.75) {
        ra += 2.0;
      }
    }
    return [ra, de, 0.0];
  }

  static map_xy_identity(
    _i: number,
    x: number,
    y: number,
  ): [number, number, number] {
    return [x, y, 0.0];
  }

  create_equatorial_grid_beziers(): CachedBezier[] {
    const result = [];
    const control_points = new Float32Array(30 * 16);

    let b = 0;
    for (const ra of [
      0.9999,
      5 / 6.0,
      4 / 6.0,
      3 / 6.0,
      2 / 6.0,
      1 / 6.0,
      0.001,
    ]) {
      for (const side of [-1, 1]) {
        result.push(
          CachedBezier.create_mapped(
            this.application.wasm_memory,
            control_points,
            b,
            [0, 1, 0, 1],
            MapCanvas.map_xy_identity,
            [ra * side, -1],
            [ra * side, 1],
          ),
        );
        b += 16;
      }
    }

    for (let y = 0; y <= 3; y++) {
      let de = y / 3.0;
      for (const side of [-1, 1]) {
        result.push(
          CachedBezier.create_mapped(
            this.application.wasm_memory,
            control_points,
            b,
            [0, 1, 0, 1],
            MapCanvas.map_xy_identity,
            [-1, de * side],
            [1, de * side],
          ),
        );
        b += 16;
        if (y == 0) {
          break;
        }
      }
    }

    return result;
  }

  create_frame_beziers(): CachedBezier[] {
    const result = [];
    const control_points = new Float32Array(4 * 10 * 16); // 4 axes each of 10 Beziers each of one mat4 (16 control point coordinates)
    let b = 0;
    for (const xy of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        let lx = i / 5.0 - 1.0;
        let rx = (i + 1) / 5.0 - 1.0;

        result.push(
          CachedBezier.create_mapped(
            this.application.wasm_memory,
            control_points,
            b,
            [1, 0, 0, 1],
            this.map_xy_view_frame.bind(this),
            [lx, xy],
            [rx, xy],
          ),
        );
        b += 16;
        result.push(
          CachedBezier.create_mapped(
            this.application.wasm_memory,
            control_points,
            b,
            [1, 0, 0, 1],
            this.map_xy_view_frame.bind(this),
            [xy, lx],
            [xy, rx],
          ),
        );
        b += 16;
      }
    }
    return result;
  }

  //mi draw_sky_rect
  // Draw the 'rectangle' that the Sky canvas represents
  draw_sky_rect(ctx: CanvasRenderingContext2D): void {
    const styling = this.application.styling();
    const vec = new WasmVec3f64(0, 0, 0);
    if (styling.map.view_border != null) {
      ctx.strokeStyle = styling.map.view_border[0]!;
      for (const y of [-1, 1]) {
        const l = new Line(ctx, this.width, this.height);
        for (var x = -1; x < 1.01; x += 0.1) {
          this.application.sky_view_frame_to_ecef_set_vec(x, y, vec);
          l.add_pt(this.cxy_of_vector(vec));
        }
        l.finish();
        ctx.strokeStyle = styling.map.view_border[2]!;
      }

      ctx.strokeStyle = styling.map.view_border[1]!;
      for (const x of [-1, 1]) {
        const l = new Line(ctx, this.width, this.height);
        for (var y = -1; y < 1.01; y += 0.1) {
          this.application.sky_view_frame_to_ecef_set_vec(x, y, vec);
          l.add_pt(this.cxy_of_vector(vec));
        }
        l.finish();
        ctx.stroke();
        ctx.strokeStyle = styling.map.view_border[3]!;
      }
    }
  }

  //mi draw_star
  // Draw a star in the Canvas context
  draw_star(ctx: CanvasRenderingContext2D, star: WasmStar): void {
    const m = star.magnitude;
    const rgb = star.rgb.array;
    const ra = star.right_ascension;
    const de = star.declination;
    const cxy = this.cxy_of_ra_de(ra, de);
    const cx = cxy[0];
    const cy = cxy[1];

    let r = Math.floor(Math.min(255, Math.max(0, rgb[0]! * 255)));
    let g = Math.floor(Math.min(255, Math.max(0, rgb[1]! * 255)));
    let b = Math.floor(Math.min(255, Math.max(0, rgb[2]! * 255)));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    if (m < 3) {
      ctx.fillRect(cx - 1, cy - 1, 3, 3);
    } else if (m < 4) {
      ctx.fillRect(cx, cy, 2, 2);
    } else {
      ctx.fillRect(cx, cy, 1, 1);
    }
  }

  //mi draw_equatorial_grid
  draw_equatorial_grid(ctx: CanvasRenderingContext2D) {
    const styling = this.application.styling();

    if (!this.vp.show_equatorial) {
      return;
    }
    const l = new Line(ctx, this.width, this.height);
    ctx.lineWidth = 2.0;

    ctx.strokeStyle = styling.map.equatorial_grid[3]!;
    for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
      l.add_pt(this.cxy_of_ra_de(0 * Math.PI, (de * Math.PI) / 2));
    }
    l.finish();
    ctx.strokeStyle = styling.map.equatorial_grid[4]!;
    for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
      l.add_pt(this.cxy_of_ra_de(0.999 * Math.PI, (de * Math.PI) / 2));
    }
    l.finish();
    for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
      l.add_pt(this.cxy_of_ra_de(-1 * Math.PI, (de * Math.PI) / 2));
    }
    l.finish();

    ctx.strokeStyle = styling.map.equatorial_grid[1]!;
    ctx.lineWidth = 1.0;
    for (var ra = 1 / 6; ra < 0.999; ra += 1 / 6) {
      for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
        l.add_pt(this.cxy_of_ra_de(ra * Math.PI, (de * Math.PI) / 2));
      }
      l.finish();
      for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
        l.add_pt(this.cxy_of_ra_de(-ra * Math.PI, (de * Math.PI) / 2));
      }
      l.finish();
    }

    ctx.strokeStyle = styling.map.equatorial_grid[1]!;
    for (var de = -1; de < -0.01; de += 1 / 3) {
      l.new_segment();
      for (const ra of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
        l.add_pt(this.cxy_of_ra_de(ra * Math.PI, (de * Math.PI) / 2));
      }
      l.new_segment();
      for (const ra of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
        l.add_pt(this.cxy_of_ra_de(ra * Math.PI, (-de * Math.PI) / 2));
      }
    }
    l.finish();

    ctx.strokeStyle = styling.map.equatorial_grid[2]!;
    for (const ra of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
      l.add_pt(this.cxy_of_ra_de(ra * Math.PI, 0));
    }
    l.finish();
  }

  //mi add_declination_circle - for azimuthal_grid
  add_declination_circle(
    q: WasmQuatf64,
    l: Line,
    vec: WasmVec3f64,
    de: number,
    step_size: number,
  ) {
    const de_c = Math.cos(de * this.vp.deg2rad);
    const de_s = Math.sin(de * this.vp.deg2rad);
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);
    l.new_segment();
    for (var ra = 0; ra <= 360; ra += step_size) {
      const ra_r = ra * this.vp.deg2rad;
      vxyz[0] = de_c * Math.cos(ra_r);
      vxyz[1] = de_c * Math.sin(ra_r);
      vxyz[2] = de_s;
      q.set_vec_apply(vec);
      l.add_pt(this.cxy_of_vector(vec));
    }
  }

  add_ra_great_circle(
    q: WasmQuatf64,
    l: Line,
    vec: WasmVec3f64,
    ra: number,
    _step_size: number,
  ) {
    const ra_c = Math.cos(ra * this.vp.deg2rad);
    const ra_s = Math.sin(ra * this.vp.deg2rad);
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);
    l.new_segment();
    for (var de = -80; de <= 80; de += 1) {
      const de_c = Math.cos(de * this.vp.deg2rad);
      const de_s = Math.sin(de * this.vp.deg2rad);
      vxyz[0] = ra_c * de_c;
      vxyz[1] = ra_s * de_c;
      vxyz[2] = de_s;
      q.set_vec_apply(vec);
      l.add_pt(this.cxy_of_vector(vec));
    }
  }

  //mi draw_azimuthal_grid
  // Draw a azimuthal grid
  //
  // Create a RH set of axes with z as 'up', and ideally x with no
  // component in the 'declination' direction
  draw_azimuthal_grid(ctx: CanvasRenderingContext2D): void {
    const styling = this.application.styling();
    if (!this.vp.show_azimuthal) {
      return;
    }

    const q_grid = this.vp.observer_to_ecef_q;
    const l = new Line(ctx, this.width, this.height);
    const v = new WasmVec3f64(0, 0, 0);

    // ecliptic
    ctx.strokeStyle = styling.map.azimuthal_grid[2]!;
    this.add_declination_circle(q_grid, l, v, 0, 1);
    l.finish();

    // above horizon
    ctx.strokeStyle = styling.map.azimuthal_grid[0]!;
    for (var de = 10; de <= 80; de += 10) {
      this.add_declination_circle(q_grid, l, v, de, 1);
    }
    l.finish();

    // below horizon
    ctx.strokeStyle = styling.map.azimuthal_grid[1]!;
    for (var de = -80; de < 0; de += 10) {
      this.add_declination_circle(q_grid, l, v, de, 1);
    }
    l.finish();

    ctx.strokeStyle = styling.map.azimuthal_grid[3]!;
    this.add_ra_great_circle(q_grid, l, v, 0, 1);
    l.finish();

    ctx.strokeStyle = styling.map.azimuthal_grid[4]!;
    this.add_ra_great_circle(q_grid, l, v, 180, 1);
    l.finish();

    ctx.strokeStyle = styling.map.azimuthal_grid[1]!;
    for (var ra = 15; ra < 175; ra += 15) {
      this.add_ra_great_circle(q_grid, l, v, ra, 1);
      this.add_ra_great_circle(q_grid, l, v, ra + 180, 1);
    }
    l.finish();
  }

  //mi redraw_canvas
  redraw_canvas() {
    const catalog = this.application.catalog;

    const ctx = this.canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const star of this.star_cache.get()) {
      this.draw_star(ctx, star);
    }

    this.draw_azimuthal_grid(ctx);
    this.draw_equatorial_grid(ctx);

    this.draw_sky_rect(ctx);
    if (this.vp.selected_star) {
      const star = catalog.star(this.vp.selected_star);
      const cxy = this.cxy_of_vector(star!.vector);
      if (cxy != null) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(cxy[0], cxy[1], 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  }

  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  user_zoom(_cxy: [number, number], factor: number): void {
    this.application.sky_view_zoom_by(factor);
  }

  drag_start(_start_xy: [number, number], xy: [number, number]): void {
    const ra_de = this.ra_de_of_cxy(xy);
    this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
  }

  drag_to(
    _start_xy: [number, number],
    _old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    const ra_de = this.ra_de_of_cxy(new_xy);
    this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
  }

  drag_end(_start_xy: [number, number], xy: [number, number]): void {
    const ra_de = this.ra_de_of_cxy(xy);
    this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
    this.vp.log_compass_elevation_update();
  }

  user_release(_start_xy: [number, number], xy: [number, number]): void {
    const catalog = this.application.catalog;
    const ra_de = this.ra_de_of_cxy(xy);
    catalog.clear_filter();
    catalog.filter_max_magnitude(this.brightness);
    this.application.select_star(catalog.closest_to_ra_de(ra_de[0], ra_de[1]));
  }
}
