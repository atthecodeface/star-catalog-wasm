import {
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
  WasmIcosphere,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

import { StarShader, SphereShader } from "./shaders.js";

import { SolarSystem } from "./solar_system.js";
import { StarField } from "./star_field.js";

import {
  WebglTexture,
  Webgl,
  Webgl3DObj,
  WebglCubicBezierShader,
  WebglFlatShader,
  WebglFlatObj,
  WebglUniform,
  WebglCubicBezierObj,
} from "./web_gl.js";

export class TestCanvas {
  application: Application;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  icos: WasmIcosphere;

  mouse: Mouse;

  webgl: Webgl | null = null;

  sphere_program: number = 0;
  flat_program: number = 0;
  bezier_program: number = 0;
  star_program: number = 0;

  texture: WebglTexture | null = null;
  q: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_axis: WebglFlatObj | null = null;
  webgl_bezier: WebglCubicBezierObj | null = null;
  view_scale: number = 3.0;

  solar_system: SolarSystem;
  star_field: StarField;
  model: WasmMat4f32 = WasmMat4f32.identity();

  current_wh: [number, number];

  constructor(application: Application, canvas_div_id: string) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "test");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.canvas.height = 900;
    this.current_wh = [50, 50];
    this.webgl = new Webgl(application.log, this.canvas);
    this.icos = new WasmIcosphere();
    this.icos.subdivide(4);

    this.mouse = new Mouse(this, this.canvas);

    this.solar_system = new SolarSystem();
    this.star_field = new StarField(application);
    this.derive_data();

    let webgl_okay: boolean = true;
    if (!this.webgl!.start_webgl()) {
      webgl_okay = false;
    }
    if (webgl_okay) {
      const program = this.webgl!.compile_program(new SphereShader());
      if (program === null) {
        webgl_okay = false;
      } else {
        this.sphere_program = program;
      }
    }
    if (webgl_okay) {
      const program = this.webgl!.compile_program(new StarShader());
      if (program === null) {
        webgl_okay = false;
      } else {
        this.star_program = program;
      }
    }
    if (webgl_okay) {
      const program = this.webgl!.compile_program(new WebglFlatShader());
      if (program === null) {
        webgl_okay = false;
      } else {
        this.flat_program = program;
      }
    }
    if (webgl_okay) {
      const program = this.webgl!.compile_program(new WebglCubicBezierShader());
      if (program === null) {
        webgl_okay = false;
      } else {
        this.bezier_program = program;
      }
    }
    if (webgl_okay) {
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
    }
    if (webgl_okay) {
      this.webgl_axis = WebglFlatObj.axis(2, [
        [10, 0.05],
        [2, 0.1],
      ]);
      this.webgl!.create(this.webgl_axis);
    }
    if (webgl_okay) {
      this.webgl_bezier = new WebglCubicBezierObj();
      this.webgl!.create(this.webgl_bezier);
    }
    if (webgl_okay) {
      this.webgl!.create(this.star_field);
    }

    if (!webgl_okay) {
      this.webgl = null;
    }
    this.logger.info(`Created sky canvas`);
  }

  derive_data() {}

  update() {
    let wh = this.vp.get_resizable_content_size();
    if (this.current_wh != wh) {
      this.canvas.width = wh[0];
      this.canvas.height = wh[1];
      this.current_wh = wh;
    }

    this.redraw_canvas();
  }

  redraw_canvas() {
    // const style = this.star_catalog.styling.clock;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ar = w / h;

    if (this.webgl === null) {
      return;
    }

    this.webgl.webgl!.viewport(0, 0, w, h);
    this.webgl.clear_buffer();

    // +Y moves it right
    // +Z moves it up
    // +X moves it out of screen
    const origin = new WasmVec3f32(0, 0.0, 0.0);
    const secs = this.vp.days_since_epoch * 86400;
    this.solar_system.set_time(secs);

    let projection = WasmMat4f32.identity().transpose().array;
    projection = WasmMat4f32.perspective(1.6, ar, 2.0, -20.0).transpose().array;
    projection = WasmMat4f32.identity().transpose().array;

    const view_matrix = WasmMat4f32.identity();
    this.q.set_mat4_rotation(view_matrix);
    view_matrix.set_scale3(this.view_scale);
    view_matrix.set_translate_by_vec3(origin);

    this.webgl.use_program(this.star_program);
    this.webgl.set_color([1, 1, 1, 1]);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
    this.webgl.draw(this.star_field);

    if (this.star_field === null) {
      return;
    }

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

    this.webgl.use_program(this.sphere_program);
    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
    this.solar_system.draw_sun(this.webgl, this.webgl_icosphere!);
    this.solar_system.draw_planets(this.webgl, this.webgl_icosphere!);
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
    this.q.set_premul(dqx);
    this.q.set_premul(dqy);
    // No content change, purely visual
    this.vp.view_updated();
  }

  user_release(_start_xy: [number, number], _cxy: [number, number]): void {}

  user_zoom(_cxy: [number, number], factor: number): void {
    this.view_scale *= factor;
    // No content change, purely visual
    this.vp.view_updated();
  }

  user_rotate(_xy: [number, number], angle: number): void {
    const dqz = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 0, 1), angle);
    this.q.set_premul(dqz);
    // No content change, purely visual
    this.vp.view_updated();
  }
}
