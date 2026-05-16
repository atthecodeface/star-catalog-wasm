import {
  WasmVec3f64,
  WasmQuatf64,
  WasmStar,
} from "../pkg/star_catalog_wasm.js";
import { Line } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { CacheOld } from "./cache.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

//a SkyCanvas
export class SkyCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;

  mouse: Mouse;

  star_cache: CacheOld<any>;
  tan_yx: number;

  win_ar: number = 0;
  // this.tan_pixh and tan_pixv is the 'tan' space of a horizontal pixel and vertical pixel
  tan_pixh: number = 0;
  tan_pixv: number = 0;
  drag_rotate: string = "";
  star_vector: WasmVec3f64;

  //fp constructor
  constructor(
    application: Application,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "clock");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = width;
    this.height = height;
    this.star_vector = new WasmVec3f64(0, 0, 0);

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Aspect ratio in 'tan' space of a single Y pixel compared to a single X pixel
    this.tan_yx = 1.0;

    this.star_cache = this.make_star_cache();
    this.star_cache.force_refresh();

    this.mouse = new Mouse(this, this.canvas);

    this.derive_data();
    this.logger.info(`Created sky canvas`);
  }

  //mi make_star_cache
  make_star_cache() {
    const stars = {
      center: this.vp.vector_x,
      angle: 0.0,
      stars: [],
      brightness: 0.0,
    };
    return new CacheOld(
      stars,
      this.check_star_cache.bind(this),
      this.try_to_fill_star_cache.bind(this),
    );
  }

  //mi check_star_cache
  check_star_cache(stars: any) {
    if (stars.stars.length == 0) {
      return true;
    }
    if (stars.brightness != this.vp.brightness) {
      return true;
    }

    const c = this.vp.view_ecef_center_dir.dot(stars.center);
    if (c < 0) {
      return true;
    }
    const angle = Math.acos(c);
    if (angle + this.vp.fovh > stars.angle) {
      return true;
    }
    return false;
  }

  try_to_fill_star_cache(stars: any) {
    const catalog = this.vp.catalog;
    catalog.clear_filter();
    catalog.filter_max_magnitude(this.vp.brightness);

    stars.brightness = this.vp.brightness;
    stars.center = this.vp.view_ecef_center_dir;
    const angle = 1.5 * this.vp.fovh;
    stars.angle = angle;
    stars.stars = [];
    const s = catalog.find_stars_around(
      this.vp.view_ecef_center_dir,
      angle,
      0,
      this.vp.max_stars_in_sky,
    );
    if (s.length >= this.vp.max_stars_in_sky) {
      return stars;
    }
    for (const index of s) {
      stars.stars.push(catalog.star(index));
    }
    return stars;
  }

  derive_data() {
    const wh = this.vp.get_resizable_content_size();
    let set_w = wh[0];
    let set_h = wh[1];
    if (set_w != this.width || set_h != this.height) {
      this.width = set_w;
      this.height = set_h;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    this.win_ar = this.height / this.width;
    this.tan_yx = 1.0;
    // this.tan_pixh and tan_pixv is the 'tan' space of a horizontal pixel and vertical pixel
    this.tan_pixh = (2 * this.vp.tan_hfovh) / this.width;
    this.tan_pixv = (2 * this.tan_pixh) / this.tan_yx;
  }

  //mp update
  update() {
    this.derive_data();
    this.redraw_canvas();
  }

  //mp set_vector_of_fxy
  // Vector of *square* canvas fraction with -1,-1 being bottom left, 1,1 top right
  //
  // This assumes that -1 in the Y corresponds to a 'full' width
  set_vector_of_fxy(vxyz: Float64Array, fxy: [number, number]) {
    const fx = fxy[0];
    const fy = (fxy[1] * this.win_ar) / this.tan_yx;
    const roll = Math.atan2(fy, fx);
    const f = Math.sqrt(fx * fx + fy * fy);
    const yaw = Math.atan(f * this.vp.tan_hfovh);

    vxyz[0] = Math.cos(yaw);
    vxyz[1] = Math.sin(yaw) * Math.cos(roll);
    vxyz[2] = Math.sin(yaw) * Math.sin(roll);
    return;
  }

  //mp cxy_of_vector
  // Canvas XY of vector in'camera' space
  //
  // Note X+ is in to screen, Y+ is left, Z+ is up
  cxy_of_vector(vv: WasmVec3f64): null | [number, number] {
    const v = vv.array;
    if (v[0]! < 0.1) {
      return null;
    }
    const x = this.width / 2.0 - v[1]! / v[0]! / this.tan_pixh;
    const y = this.height / 2.0 - v[2]! / v[0]! / this.tan_pixh; // v / this.win_ar );
    return [x, y];
  }

  //mi rotate_axis
  rotate_axis(axis: number, delta: number) {
    var v = new WasmVec3f64(1, 0, 0);
    if (axis == 1) {
      v = new WasmVec3f64(0, 1, 0);
    } else if (axis == 2) {
      v = new WasmVec3f64(0, 0, 1);
    }
    const q = WasmQuatf64.of_axis_angle(v, delta);
    this.vp.view_q_post_mul(q);
  }

  //mi draw_star
  draw_star(ctx: CanvasRenderingContext2D, star: WasmStar) {
    // Determine viewer direction vector for the star
    star.set_vector(this.star_vector);
    this.star_vector.set_apply_q3(this.vp.ecef_to_view_q);

    // Determine the canvas XY of the star
    const cxy = this.cxy_of_vector(this.star_vector);
    if (cxy == null) {
      return;
    }

    const m = star.magnitude;
    // const _ra = star.right_ascension;
    // const _de = star.declination;
    const rgb = star.rgb.array;

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

  //mi add_declination_circle
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

  //mi add_ra_great_circle - for azimuthal grid
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

  //mi draw_grid - draw a grid given a styling and ecef-to-view quaternion
  draw_grid(ctx: CanvasRenderingContext2D, q_grid: WasmQuatf64, styling: any) {
    if (styling == null) {
      return;
    }

    const l = new Line(ctx, this.width, this.height);
    const v = new WasmVec3f64(0, 0, 0);
    ctx.strokeStyle = styling[2];
    this.add_declination_circle(q_grid, l, v, 0, 1);
    l.finish();
    ctx.strokeStyle = styling[0];
    for (var de = 10; de <= 80; de += 10) {
      this.add_declination_circle(q_grid, l, v, de, 1);
    }
    l.finish();
    ctx.strokeStyle = styling[1];
    for (var de = 10; de <= 80; de += 10) {
      this.add_declination_circle(q_grid, l, v, -de, 1);
    }
    l.finish();

    ctx.strokeStyle = styling[3];
    this.add_ra_great_circle(q_grid, l, v, 0, 1);
    l.finish();
    ctx.strokeStyle = styling[4];
    this.add_ra_great_circle(q_grid, l, v, 180, 1);
    l.finish();
    ctx.strokeStyle = styling[0];
    for (var ra = 15; ra < 175; ra += 15) {
      this.add_ra_great_circle(q_grid, l, v, ra, 1);
      this.add_ra_great_circle(q_grid, l, v, ra + 180, 1);
    }
    l.finish();
  }

  //mi draw_border
  draw_border(ctx: CanvasRenderingContext2D): void {
    const styling = this.vp.styling();
    if (styling.sky.view_border == null) {
      return;
    }
    const rx = this.canvas.width;
    const by = this.canvas.height;
    ctx.fillStyle = styling.sky.view_border[0]!;
    ctx.fillRect(0, by - 2, rx, 2);
    ctx.fillStyle = styling.sky.view_border[2]!;
    ctx.fillRect(0, 0, rx, 2);
    ctx.fillStyle = styling.sky.view_border[1]!;
    ctx.fillRect(0, 0, 2, by);
    ctx.fillStyle = styling.sky.view_border[3]!;
    ctx.fillRect(rx - 2, 0, 2, by);
  }

  //mi redraw_canvas
  redraw_canvas(): void {
    const catalog = this.vp.catalog;
    const styling = this.vp.styling();
    const ctx = this.canvas.getContext("2d")!;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.draw_border(ctx);
    if (this.vp.selected_star !== null) {
      const star = catalog.star(this.vp.selected_star)!;
      ctx.strokeStyle = "White";
      const qv = this.vp.ecef_to_view_q.apply(star.vector);
      const cxy = this.cxy_of_vector(qv);
      if (cxy !== null) {
        const cx = cxy[0]!;
        const cy = cxy[1]!;

        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    if (this.vp.show_azimuthal) {
      this.draw_grid(
        ctx,
        this.vp.ecef_to_view_q.mul(this.vp.observer_to_ecef_q),
        styling.sky.azimuthal_grid,
      );
    }
    if (this.vp.show_equatorial) {
      this.draw_grid(ctx, this.vp.ecef_to_view_q, styling.sky.equatorial_grid);
    }

    const stars = this.star_cache.get();
    if (stars.stars.length == 0) {
      this.vp.brightness = this.vp.brightness * 0.9;
      this.vp.update_html_elements();
      // this.star_catalog.set_view_needs_update();
      this.derive_data();
      this.redraw_canvas();
    } else {
      for (const star of stars.stars) {
        this.draw_star(ctx, star);
      }
    }
  }

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}

  drag_start(_start_xy: [number, number], xy: [number, number]): void {
    const cx = xy[0] - this.width / 2;
    const cy = xy[1] - this.height / 2;
    const d2 = cx * cx + cy * cy;
    if (d2 > (this.width * this.height) / 8) {
      this.drag_rotate = "x";
    } else {
      this.drag_rotate = "yz";
    }
  }

  drag_to(
    _start_xy: [number, number],
    cxy0: [number, number],
    cxy1: [number, number],
  ): void {
    if (this.drag_rotate == "x") {
      const cx0 = cxy0[0] - this.width / 2;
      const cy0 = cxy0[1] - this.height / 2;
      const cx1 = cxy1[0] - this.width / 2;
      const cy1 = cxy1[1] - this.height / 2;
      const angle = Math.atan2(cy1, cx1) - Math.atan2(cy0, cx0);
      const q = WasmQuatf64.unit().rotate_x(-angle);
      this.vp.view_q_post_mul(q);
    } else {
      const dcx = (cxy0[0] - cxy1[0]) * this.tan_pixh;
      const dcy = (cxy0[1] - cxy1[1]) * this.tan_pixv;
      const qz = WasmQuatf64.unit().rotate_z(-Math.atan(dcx));
      const qy = WasmQuatf64.unit().rotate_y(Math.atan(dcy));
      const q = qz.mul(qy);
      this.vp.view_q_post_mul(q);
    }
  }

  user_release(_start_xy: [number, number], cxy: [number, number]): void {
    const catalog = this.vp.catalog;
    const fx = (-cxy[0] / this.width + 0.5) * 2;
    const fy = (-cxy[1] / this.height + 0.5) * 2;

    // Map click location to ECEF direction
    const vec = new WasmVec3f64(0, 0, 0);
    this.vp.sky_view_frame_to_ecef_set_vec(fx, fy, vec);

    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);

    const ra = Math.atan2(vxyz[1]!, vxyz[0]!);
    const de = Math.asin(vxyz[2]!);
    catalog.clear_filter();
    catalog.filter_max_magnitude(this.vp.brightness);
    this.application.select_star(catalog.closest_to_ra_de(ra, de));
  }

  user_zoom(_cxy: [number, number], factor: number): void {
    this.application.sky_view_zoom_by(factor);
  }

  user_rotate(_xy: [number, number], angle: number): void {
    const v = new WasmVec3f64(1, 0, 0);
    const q = WasmQuatf64.of_axis_angle(v, -angle);
    this.vp.view_q_post_mul(q);
  }
}
