import { WasmMat4f32 } from "../pkg/star_catalog_wasm.js";

import { MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { Webgl, WebglUniform } from "./web_gl.js";

import { Application } from "./application.js";
import { ViewProperties } from "./view_properties.js";
import { WebglCanvas, WebglCanvasClient } from "./webgl_canvas.js";

export class Earth implements WebglCanvasClient {
  application: Application;
  vp: ViewProperties;
  webgl_canvas: WebglCanvas;

  logger: Logger;

  constructor(application: Application, webgl_canvas: WebglCanvas) {
    this.application = application;
    this.vp = application.view_properties;
    this.webgl_canvas = webgl_canvas;
    this.logger = new Logger(application.log, "earth");
  }

  redraw(webgl: Webgl, webgl_canvas: WebglCanvas): void {
    const w = this.vp.view_wh[0];
    const h = this.vp.view_wh[1];

    const view_scale = 0.9;
    const ar = w / h;

    const q = this.vp.earth.q;
    const triangle_q_ll = this.vp.earth.triangle_q_ll;

    webgl.webgl!.viewport(0, 0, w, h);
    webgl.clear_buffer();

    const styling = this.vp.styling();
    webgl.use_program(webgl_canvas.earth_program);

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
    webgl.set_uniform_mat4(WebglUniform.Projection, projection);

    const matrix = WasmMat4f32.identity();
    q.set_mat4_rotation(matrix);
    webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);

    const t = webgl_canvas.solar_system.earth_texture();
    if (t !== null) {
      webgl.set_texture(t!);
    }

    webgl.set_color(styling.earth.color);

    const model = WasmMat4f32.identity();
    webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
    webgl.draw(webgl_canvas.webgl_icosphere!);

    webgl.set_color([1, 0, 0, 0]);

    triangle_q_ll.set_mat4_rotation(matrix);
    webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
    webgl.draw(webgl_canvas.webgl_triangle!);
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
