import {
  WasmVec3f64,
  WasmMat4f64,
  WasmQuatf64,
} from "../pkg/star_catalog_wasm.js";
import { Webgl, WebglUniform } from "./web_gl.js";

import {} from "../pkg/star_catalog_wasm.js";
import { CacheSingleton } from "./cache.js";

import { MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";
import {
  WebglCanvas,
  CachedBezier,
  WebglCanvasClient,
  MapFrameKey,
} from "./webgl_canvas.js";

export class SkyCanvas implements WebglCanvasClient {
  application: Application;
  vp: ViewProperties;
  webgl_canvas: WebglCanvas;
  logger: Logger;

  drag_rotate: string = "";
  star_vector: WasmVec3f64;
  sky_grid_beziers: CacheSingleton<MapFrameKey, CachedBezier[]>;

  constructor(application: Application, webgl_canvas: WebglCanvas) {
    this.application = application;
    this.vp = this.application.view_properties;
    this.webgl_canvas = webgl_canvas;
    this.logger = new Logger(application.log, "clock");

    this.star_vector = new WasmVec3f64(0, 0, 0);
    this.sky_grid_beziers = new CacheSingleton();

    this.logger.info(`Created sky canvas`);
  }

  redraw(webgl: Webgl, webgl_canvas: WebglCanvas): void {
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];

    this.sky_grid_beziers.set_contents(
      new MapFrameKey(WasmQuatf64.unit(), 1.0),
      () => this.create_azimuthal_grid_beziers(),
    );

    // const view_scale = 1.0;
    const ar = w / h;

    webgl.webgl!.viewport(0, 0, w, h);
    webgl.clear_buffer();

    const f = 1.0 / this.vp.tan_hfovh; // should be 1/tan fov?
    const near = -0.01; // Maps to -1 in the Z, closest to the viewer, should scale by 1/near
    const far = -1.01; // Maps to +1 in the Z, furthest to the viewer, should scale by 1/far
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
      (near + far) / (near - far), // scale by
      1,

      0,
      0,
      (near * far * 2) / (near - far),
      0,
    ]);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const matrix = WasmMat4f64.identity();
    this.vp.ecef_to_view_q.set_mat4_rotation(matrix);

    webgl.use_program(webgl_canvas.star_program);
    webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);
    webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    webgl.set_color([1, 1, 1, 1]);
    webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);
    webgl.draw(webgl_canvas.star_field);

    const beziers = this.sky_grid_beziers.get_contents();
    if (beziers !== null) {
      webgl.use_program(webgl_canvas.bezier_program);
      webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
      webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);

      if (this.vp.show_equatorial) {
        webgl.set_color([1, 0.5, 0.5, 1]);
        webgl.set_uniform_mat4(WebglUniform.Model, identity, false);
        for (const b of beziers) {
          webgl_canvas.webgl_bezier!.set_control_points(
            b.control_pts,
            b.offset,
          );
          webgl.draw(webgl_canvas.webgl_bezier!);
        }
      }

      if (this.vp.show_azimuthal) {
        const model = WasmMat4f64.identity();
        webgl.set_color([0.5, 1, 1, 1]);
        this.vp.observer_to_ecef_q.set_mat4_rotation(model);
        webgl.set_uniform_mat4(WebglUniform.Model, model.array, true);
        for (const b of beziers) {
          webgl_canvas.webgl_bezier!.set_control_points(
            b.control_pts,
            b.offset,
          );
          webgl.draw(webgl_canvas.webgl_bezier!);
        }
      }
    }

    if (this.vp.selected_star !== null) {
      const star = this.vp.catalog.star(this.vp.selected_star)!;

      webgl.use_program(webgl_canvas.flat_program);
      webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
      webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);
      webgl.set_color([1, 0.26, 0.16, 0.1]);

      const radius = 0.02;
      webgl.set_uniform_mat4(
        WebglUniform.Model,
        [
          radius,
          0,
          0,
          star.vector.array[0]!,
          /**/ 0,
          radius,
          0,
          star.vector.array[1]!,
          /**/ 0,
          0,
          radius,
          star.vector.array[2]!,
          /**/ 0,
          0,
          0,
          1,
        ],
        true,
      );
      webgl.draw(webgl_canvas.webgl_circle!);
    }
  }

  private map_ra_de(
    _i: number,
    ra: number,
    de: number,
  ): [number, number, number] {
    const de_c = Math.cos(de);
    const de_s = Math.sin(de);
    const ra_c = Math.cos(ra);
    const ra_s = Math.sin(ra);
    return [ra_c * de_c, ra_s * de_c, de_s];
  }

  // 8 bezier per
  create_declination_circle_beziers(
    control_points: Float32Array,
    offset: number,
    result: CachedBezier[],
    de: number,
  ): number {
    const de_r = de * this.vp.deg2rad;
    const da = this.vp.deg2rad * 45;
    for (let i = 0; i < 360; i += 45) {
      const ra = i * da;
      result.push(
        CachedBezier.create_mapped(
          this.application.wasm_memory,
          control_points,
          offset,
          [1, 1, 1, 1],
          this.map_ra_de.bind(this),
          [ra, de_r],
          [ra + da, de_r],
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
    const da = this.vp.deg2rad * 10;
    for (let i = -80; i <= 70; i += 10) {
      const de = i * this.vp.deg2rad;
      result.push(
        CachedBezier.create_mapped(
          this.application.wasm_memory,
          control_points,
          offset,
          [1, 1, 1, 1],
          this.map_ra_de.bind(this),
          [ra_r, de],
          [ra_r, de + da],
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

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}

  user_rotate(_xy: [number, number], angle: number): void {
    const v = new WasmVec3f64(1, 0, 0);
    const q = WasmQuatf64.of_axis_angle(v, -angle);
    this.vp.view_q_post_mul(q);
  }

  drag_start(_start_xy: [number, number], xy: [number, number]): void {
    const wh = this.vp.get_resizable_content_size();
    const cx = xy[0] - wh[0] / 2;
    const cy = xy[1] - wh[1] / 2;
    const d2 = cx * cx + cy * cy;
    if (d2 > (wh[0] * wh[1]) / 8) {
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
    // this.tan_pixh and tan_pixv is the 'tan' space of a horizontal pixel and vertical pixel
    const wh = this.vp.get_resizable_content_size();
    const tan_pixh = (2 * this.vp.tan_hfovh) / wh[0];
    const tan_pixv = 2 * tan_pixh;

    if (this.drag_rotate == "x") {
      const cx0 = cxy0[0] - wh[0] / 2;
      const cy0 = cxy0[1] - wh[1] / 2;
      const cx1 = cxy1[0] - wh[0] / 2;
      const cy1 = cxy1[1] - wh[1] / 2;
      const angle = Math.atan2(cy1, cx1) - Math.atan2(cy0, cx0);
      const q = WasmQuatf64.unit().rotate_z(angle);
      this.vp.view_q_post_mul(q);
    } else {
      const dcx = (cxy0[0] - cxy1[0]) * tan_pixh;
      const dcy = (cxy0[1] - cxy1[1]) * tan_pixv;
      const qz = WasmQuatf64.unit().rotate_y(Math.atan(dcx));
      const qy = WasmQuatf64.unit().rotate_x(Math.atan(dcy));
      const q = qz.mul(qy);
      this.vp.view_q_post_mul(q);
    }
  }

  user_release(_start_xy: [number, number], cxy: [number, number]): void {
    const wh = this.vp.get_resizable_content_size();

    const catalog = this.vp.catalog;
    const fx = (-cxy[0] / wh[0] + 0.5) * 2;
    const fy = (-cxy[1] / wh[1] + 0.5) * 2;

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
}
