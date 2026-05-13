import {
  WasmCatalog,
  WasmOrbit,
  WasmVec3f64,
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
  WasmIcosphere,
} from "../pkg/star_catalog_wasm.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Styling } from "./styling.js";
import { StarCatalog } from "./star_catalog.js";
import {
  WebglTexture,
  WebglShaderSrc,
  Webgl,
  Webgl3DObj,
  WebglFlatShader,
  WebglFlatObj,
  WebglUniform,
} from "./web_gl.js";

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
  star_catalog: StarCatalog;
  catalog: WasmCatalog;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  icos: WasmIcosphere;

  mouse: Mouse;

  styling: Styling;

  webgl: Webgl | null = null;
  program: number = 0;
  flat_program: number = 0;
  texture: WebglTexture | null = null;
  q: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  triangle_q_ll: WasmQuatf32 = new WasmQuatf32(0, 0, 0, 1);
  webgl_icosphere: Webgl3DObj | null = null;
  webgl_axis: WebglFlatObj | null = null;
  view_scale: number = 3.0;
  model: WasmMat4f32 = WasmMat4f32.identity();

  current_wh: [number, number];

  objects: WasmOrbit[] = [];
  constructor(
    star_catalog: StarCatalog,
    catalog: WasmCatalog,
    canvas_div_id: string,
  ) {
    this.star_catalog = star_catalog;
    this.catalog = catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "test");
    this.styling = this.star_catalog.styling;

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.canvas.height = 900;
    this.current_wh = [50, 50];
    this.webgl = new Webgl(star_catalog.log, this.canvas);
    this.icos = new WasmIcosphere();
    this.icos.subdivide(4);

    this.mouse = new Mouse(this, this.canvas);

    this.objects.push(WasmOrbit.of_solar_system("Mercury")!);
    this.objects.push(WasmOrbit.of_solar_system("Venus")!);
    this.objects.push(WasmOrbit.of_solar_system("Earth")!);
    this.objects.push(WasmOrbit.of_solar_system("Mars")!);
    this.objects.push(WasmOrbit.of_solar_system("Jupiter")!);
    this.objects.push(WasmOrbit.of_solar_system("Saturn")!);
    this.objects.push(WasmOrbit.of_solar_system("Uranus")!);
    this.objects.push(WasmOrbit.of_solar_system("Neptune")!);

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
        this.program = program;
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
      this.webgl_axis = WebglFlatObj.axis(2, [[10, 0.2]]);
      this.webgl!.create(this.webgl_axis);
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
    const sun_scale = 0.015;
    const planet_scale = 0.006;
    const distance_scale = 1 / 3000.0e6;

    let projection = WasmMat4f32.identity().transpose().array;
    projection = WasmMat4f32.perspective(1.6, ar, 2.0, -20.0).transpose().array;
    projection = WasmMat4f32.identity().transpose().array;

    const view_matrix = WasmMat4f32.identity();
    this.q.set_rotation4(view_matrix);
    view_matrix.scale3(this.view_scale);

    view_matrix.translate3(origin);

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
      [0, 0, 1, 0, /**/ 1, 0, 0, -1, /**/ 0, 1, 0, 0, /**/ 0, 0, 0, 1],
      true,
    );
    this.webgl.draw(this.webgl_axis!);

    this.webgl.use_program(this.program);

    this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
    this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);

    // Set model
    this.webgl.set_color([1, 1, 1, 1]);
    this.model = WasmMat4f32.identity();
    this.model.scale3(sun_scale);
    this.webgl.set_uniform_mat4(WebglUniform.Model, this.model.array, true);
    this.webgl.draw(this.webgl_icosphere!);

    this.webgl.set_color([1, 0.5, 0.7, 0.7]);

    const secs = this.vp.days_since_epoch * 86400;
    const v = new WasmVec3f64(0, 0, 0);
    for (const o of this.objects) {
      const q = o.orbit_to_parent();
      o.orbit_vec_of_unix_time(secs, v);
      const v2 = q.apply3(v);
      console.log(v2.array);
      this.model = WasmMat4f32.from_array(
        new Float32Array([
          planet_scale,
          0,
          0,
          v2.array[0]! * distance_scale,
          //
          0,
          planet_scale,
          0,
          v2.array[1]! * distance_scale,
          //
          0,
          0,
          planet_scale,
          v2.array[2]! * distance_scale,
          //
          0,
          0,
          0,
          1,
        ]),
      );

      this.webgl.set_uniform_mat4(WebglUniform.Model, this.model.array, true);
      this.webgl.draw(this.webgl_icosphere!);
    }
    // const scale = 1 / 1.0e6 / 2;

    // this.triangle_q_ll.set_rotation4(matrix);
    // this.webgl.programs[this.program]?.set_model(matrix.transpose().array);
    return;
  }
  /*
    this.webgl_triangle!.draw(this.webgl!.webgl!);

    const ctx = this.canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.clearRect(0, 0, w, h);

    const v = new WasmVec3f64(0, 0, 0);

    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 10, 0, 360);
    ctx.fillStyle = "#ec9";
    ctx.fill();

    const scale = 1 / 1.0e6 / 2;
    for (const o of this.objects) {
      // console.log("Object", o);

      const q = o.orbit_to_parent();
      ctx.strokeStyle = "#696";
      ctx.beginPath();
      for (let x = 0.0; x < 6.283; x += 0.02) {
        o.orbit_vec_of_true_anomaly(x, v);
        const v2 = q.apply3(v);
        ctx.lineTo(w / 2 + v2.array[0]! * scale, h / 2 + v2.array[1]! * scale);
      }
      ctx.closePath();
      ctx.stroke();
      const secs = this.vp.days_since_epoch * 86400;
      o.orbit_vec_of_unix_time(secs, v);
      const v2 = q.apply3(v);
      ctx.beginPath();
      ctx.arc(
        w / 2 + v2.array[0]! * scale,
        h / 2 + v2.array[1]! * scale,
        3,
        0,
        360,
      );
      ctx.fillStyle = "#993";
      ctx.fill();
    }
    }*/

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
    this.q.premul(dqx);
    this.q.premul(dqy);
    this.star_catalog.set_view_needs_update();
  }

  user_release(_start_xy: [number, number], _cxy: [number, number]): void {}

  user_zoom(_cxy: [number, number], factor: number): void {
    this.view_scale *= factor;
    this.star_catalog.set_view_needs_update();
  }

  user_rotate(_xy: [number, number], _angle: number): void {}
}
