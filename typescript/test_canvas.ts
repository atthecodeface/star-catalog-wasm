import {
  WasmOrbit,
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
  WasmIcosphere,
  WasmBezier3f32,
  WasmBezierBuilder3f32,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Application } from "./application.js";

import {
  WebglTexture,
  WebglShaderSrc,
  Webgl,
  Webgl3DObj,
  WebglCubicBezierShader,
  WebglFlatShader,
  WebglFlatObj,
  WebglUniform,
  WebglCubicBezierObj,
} from "./web_gl.js";

class Planet {
  orbit: WasmOrbit;
  orbit_to_parent: WasmQuatf32;
  orbit_bezier: WasmBezier3f32;
  mat: WasmMat4f32;
  vec: WasmVec3f32;
  planet_scale: number = 0.002;
  planet_color: [number, number, number, number] = [1, 1, 1, 1];
  constructor(name: string) {
    this.orbit = WasmOrbit.of_solar_system(name)!;
    this.orbit_bezier = new WasmBezier3f32();
    this.orbit_to_parent = this.orbit.orbit_to_parent();
    this.vec = new WasmVec3f32(0, 0, 0);
    this.mat = WasmMat4f32.identity();
  }

  set_time(secs_since_epoch: number, builder: WasmBezierBuilder3f32) {
    this.orbit_to_parent = this.orbit.orbit_to_parent();
    const orbit_period = this.orbit.period_of_orbit();
    builder.clear();

    for (let t = 0; t <= 3; t++) {
      const time = secs_since_epoch + orbit_period * (t - 1) * 0.025;
      this.orbit.orbit_vec_of_unix_time(time, this.vec);
      builder.add_vec_pt_at(t / 3.0, this.vec);
    }
    this.orbit_bezier.reconstruct(builder);
  }

  draw_orbit(
    webgl: Webgl,
    bezier: WebglCubicBezierObj,
    distance_scale: number,
  ) {
    this.orbit_to_parent.set_mat4_rotation(this.mat);
    this.mat.set_scale3(distance_scale);
    webgl.set_color(this.planet_color);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);
    bezier.set_bezier(this.orbit_bezier);
    webgl.draw(bezier);
  }

  draw_planet(webgl: Webgl, icosphere: Webgl3DObj, distance_scale: number) {
    this.orbit_bezier.set_vec_point_at(this.vec, 1 / 3.0);
    this.orbit_to_parent.set_vec_apply(this.vec);
    this.vec.set_mulf(distance_scale);
    this.mat.set_identity();
    this.mat.set_scale3(this.planet_scale);
    this.mat.set_translate_by_vec3(this.vec);
    webgl.set_color(this.planet_color);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);

    webgl.draw(icosphere);
  }
}

class SolarSystem {
  mat: WasmMat4f32;
  sun_color: [number, number, number, number] = [1, 1, 1, 1];
  sun_scale: number = 0.005;
  planet_scale: number = 0.002;
  distance_scale: number = 1 / 3e9;
  objects: Planet[];

  constructor() {
    this.mat = WasmMat4f32.identity();
    this.objects = [];
    this.objects.push(new Planet("Mercury"));
    this.objects.push(new Planet("Venus"));
    this.objects.push(new Planet("Earth"));
    this.objects.push(new Planet("Mars"));
    this.objects.push(new Planet("Jupiter"));
    this.objects.push(new Planet("Saturn"));
    this.objects.push(new Planet("Uranus"));
    this.objects.push(new Planet("Neptune"));
  }

  set_time(secs_since_epoch: number) {
    const builder = new WasmBezierBuilder3f32();
    for (const o of this.objects) {
      o.set_time(secs_since_epoch, builder);
    }
  }

  draw_sun(webgl: Webgl, icosphere: Webgl3DObj) {
    webgl.set_color(this.sun_color);
    this.mat.set_identity();
    this.mat.set_scale3(this.sun_scale);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, false);
    webgl.draw(icosphere);
  }

  draw_planets(webgl: Webgl, icosphere: Webgl3DObj) {
    for (const p of this.objects) {
      p.draw_planet(webgl, icosphere, this.distance_scale);
    }
  }

  draw_orbits(webgl: Webgl, bezier: WebglCubicBezierObj) {
    for (const p of this.objects) {
      p.draw_orbit(webgl, bezier, this.distance_scale);
    }
  }
}

class SphereShader implements WebglShaderSrc {
  id: string = "sphere";
  extra_uniforms: string[] = [];

  vertex: string = `
  uniform mat4 projection;
  uniform mat4 view;
  uniform mat4 model;

  attribute vec4 position;
  attribute vec2 tex_coord;


  varying vec2 vTextureCoord;
  varying vec3 col;
  void main() {
            vec4 pos;
            pos = projection * view * model * position;
            gl_Position = pos;
            col.x = (2.0+tex_coord.x)/3.0;
            col.y = (2.0+tex_coord.y)/3.0;
            col.z = (2.0+tex_coord.y)/3.0;
            vTextureCoord = tex_coord;
  }
`;

  fragment: string = `
  precision mediump float;
  varying vec2 vTextureCoord;
  varying vec3 col;
  uniform vec4 color;
  void main() {
  gl_FragColor.r = color.r*col.r;
  gl_FragColor.g = color.g*col.g;
  gl_FragColor.b = color.b*col.b;
  gl_FragColor.a = color.a;
  }
  `;
}

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
  texture: WebglTexture | null = null;
  q: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_axis: WebglFlatObj | null = null;
  webgl_bezier: WebglCubicBezierObj | null = null;
  view_scale: number = 3.0;

  solar_system: SolarSystem;
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
