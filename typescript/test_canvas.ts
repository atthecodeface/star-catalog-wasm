import {
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

import { WebglCanvas } from "./webgl_canvas.js";

import {
  WebglTexture,
  Webgl,
  Webgl3DObj,
  WebglFlatObj,
  WebglCubicBezierObj,
} from "./web_gl.js";

export class TestCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;

  mouse: Mouse;

  webgl: Webgl | null = null;

  sphere_program: number = 0;
  flat_program: number = 0;
  bezier_program: number = 0;
  star_program: number = 0;

  texture: WebglTexture | null = null;
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_axis: WebglFlatObj | null = null;
  webgl_bezier: WebglCubicBezierObj | null = null;

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

    this.mouse.set_client(this.vp.star_catalog.earth_canvas);
  }

  update() {
    this.redraw_canvas();
  }

  redraw_canvas() {
    this.webgl_canvas.redraw_canvas();
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
    this.vp.solar_system_fovh *= Math.pow(factor, 0.1);
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
