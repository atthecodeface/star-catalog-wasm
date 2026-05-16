import {
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

import { WebglCanvas, WebglCanvasView } from "./webgl_canvas.js";

import { Webgl } from "./web_gl.js";

export class TestCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;

  mouse: Mouse;

  webgl: Webgl | null = null;

  model: WasmMat4f32 = WasmMat4f32.identity();

  webgl_canvas: WebglCanvas;

  constructor(application: Application, canvas_div_id: string) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "test");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.webgl_canvas = new WebglCanvas(application, this.canvas);

    this.mouse = new Mouse(this, this.canvas);
  }

  update() {
    this.redraw_canvas();
  }

  redraw_canvas() {
    switch (this.vp.webgl_canvas_view) {
      case WebglCanvasView.Earth: {
        this.webgl_canvas.draw_earth();
        this.mouse.set_client(this.vp.star_catalog.earth_canvas);
        break;
      }
      case WebglCanvasView.SolarSystem: {
        this.webgl_canvas.redraw_canvas();
        this.mouse.set_client(this);
        break;
      }
      case WebglCanvasView.StarMap: {
        this.vp.star_catalog.map_canvas.derive_data();

        this.webgl_canvas.draw_star_map();
        this.mouse.set_client(this.vp.star_catalog.map_canvas);
        break;
      }
    }
  }

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], actions: MousePressActions): void {
    actions.can_drag = true;
  }
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}

  drag_start(_start_xy: [number, number], _xy: [number, number]): void {}

  drag_to(
    _start_xy: [number, number],
    cxy0: [number, number],
    cxy1: [number, number],
  ): void {
    const dx = cxy1[0] - cxy0[0];
    const dy = cxy1[1] - cxy0[1];
    const dqx = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 1, 0), dx * 0.01);
    const dqy = WasmQuatf32.of_axis_angle(new WasmVec3f32(1, 0, 0), dy * 0.01);
    this.vp.solar_sytem_orientation.set_premul(dqx);
    this.vp.solar_sytem_orientation.set_premul(dqy);
    // No content change, purely visual
    this.vp.view_updated();
  }

  user_release(_start_xy: [number, number], _cxy: [number, number]): void {}

  user_zoom(_cxy: [number, number], factor: number): void {
    this.vp.solar_system_fovh += (1.0 - factor) * 0.1;
    console.log(factor, this.vp.solar_system_fovh);
    this.vp.solar_system_fovh = Math.min(
      Math.max(this.vp.solar_system_fovh, 0.01),
      1.5,
    );
    console.log(factor, this.vp.solar_system_fovh);
    // No content change, purely visual
    this.vp.view_updated();
  }

  user_rotate(_xy: [number, number], angle: number): void {
    const dqz = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 0, 1), angle);
    this.vp.solar_sytem_orientation.set_premul(dqz);
    // No content change, purely visual
    this.vp.view_updated();
  }
}
