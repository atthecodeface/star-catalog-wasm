import { WasmOrbit, WasmVec3f64, WasmVec3f32, WasmQuatf32, WasmMat4f32, WasmIcosphere, WasmBezier3f32, WasmBezierBuilder3f32, } from "../pkg/star_catalog_wasm.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
import { Webgl, Webgl3DObj, WebglCubicBezierShader, WebglFlatShader, WebglFlatObj, WebglUniform, WebglCubicBezierObj, } from "./web_gl.js";
class SphereShader {
    constructor() {
        this.id = "sphere";
        this.extra_uniforms = [];
        this.vertex = `
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
        this.fragment = `
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
}
export class TestCanvas {
    constructor(star_catalog, catalog, canvas_div_id) {
        this.webgl = null;
        this.program = 0;
        this.flat_program = 0;
        this.bezier_program = 0;
        this.texture = null;
        this.q = new WasmQuatf32(0, 0, 0, 1);
        this.triangle_q_ll = new WasmQuatf32(0, 0, 0, 1);
        this.webgl_icosphere = null;
        this.webgl_axis = null;
        this.webgl_bezier = null;
        this.view_scale = 3.0;
        this.model = WasmMat4f32.identity();
        this.objects = [];
        this.star_catalog = star_catalog;
        this.catalog = catalog;
        this.vp = this.star_catalog.vp;
        this.logger = new Logger(star_catalog.log, "test");
        this.styling = this.star_catalog.styling;
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        this.canvas.height = 900;
        this.current_wh = [50, 50];
        this.webgl = new Webgl(star_catalog.log, this.canvas);
        this.icos = new WasmIcosphere();
        this.icos.subdivide(4);
        this.mouse = new Mouse(this, this.canvas);
        this.objects.push(WasmOrbit.of_solar_system("Mercury"));
        this.objects.push(WasmOrbit.of_solar_system("Venus"));
        this.objects.push(WasmOrbit.of_solar_system("Earth"));
        this.objects.push(WasmOrbit.of_solar_system("Mars"));
        this.objects.push(WasmOrbit.of_solar_system("Jupiter"));
        this.objects.push(WasmOrbit.of_solar_system("Saturn"));
        this.objects.push(WasmOrbit.of_solar_system("Uranus"));
        this.objects.push(WasmOrbit.of_solar_system("Neptune"));
        this.derive_data();
        let webgl_okay = true;
        if (!this.webgl.start_webgl()) {
            webgl_okay = false;
        }
        if (webgl_okay) {
            const program = this.webgl.compile_program(new SphereShader());
            if (program === null) {
                webgl_okay = false;
            }
            else {
                this.program = program;
            }
        }
        if (webgl_okay) {
            const program = this.webgl.compile_program(new WebglFlatShader());
            if (program === null) {
                webgl_okay = false;
            }
            else {
                this.flat_program = program;
            }
        }
        if (webgl_okay) {
            const program = this.webgl.compile_program(new WebglCubicBezierShader());
            if (program === null) {
                webgl_okay = false;
            }
            else {
                this.bezier_program = program;
            }
        }
        if (webgl_okay) {
            this.webgl_icosphere = new Webgl3DObj(this.icos.num_vertices, this.icos.num_faces * 3);
            for (var i = 0; i < this.icos.num_vertices; i++) {
                const v = this.icos.subdiv_vertex(i);
                this.webgl_icosphere.add_vertex(v.position.array, v.texture.array);
            }
            for (var i = 0; i < this.icos.num_faces; i++) {
                const f = this.icos.subdiv_face(i);
                this.webgl_icosphere.add_face([f[0], f[1], f[2]]);
            }
            this.webgl.create(this.webgl_icosphere);
        }
        if (webgl_okay) {
            this.webgl_axis = WebglFlatObj.axis(2, [
                [10, 0.05],
                [2, 0.1],
            ]);
            this.webgl.create(this.webgl_axis);
        }
        if (webgl_okay) {
            this.webgl_bezier = new WebglCubicBezierObj();
            this.webgl.create(this.webgl_bezier);
        }
        if (!webgl_okay) {
            this.webgl = null;
        }
        this.logger.info(`Created sky canvas`);
    }
    derive_data() { }
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
        var _a;
        // const style = this.star_catalog.styling.clock;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ar = w / h;
        if (this.webgl === null) {
            return;
        }
        this.webgl.webgl.viewport(0, 0, w, h);
        this.webgl.clear_buffer();
        // +Y moves it right
        // +Z moves it up
        // +X moves it out of screen
        const origin = new WasmVec3f32(0, 0.0, 0.0);
        const sun_scale = 0.005;
        const planet_scale = 0.002;
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
        this.webgl.set_uniform_mat4(WebglUniform.Model, [1, 0, 0, -1, /**/ 0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1], true);
        this.webgl.draw(this.webgl_axis);
        // purple for Z axis
        this.webgl.set_color([1, 0.2, 1.0, 1]);
        this.webgl.set_uniform_mat4(WebglUniform.Model, [0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 0, 1], true);
        this.webgl.draw(this.webgl_axis);
        // white for Y axis
        this.webgl.set_color([1, 1, 1, 1]);
        this.webgl.set_uniform_mat4(WebglUniform.Model, [0, 1, 0, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1], true);
        this.webgl.draw(this.webgl_axis);
        this.webgl.use_program(this.bezier_program);
        this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        this.webgl.use_program(this.program);
        this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        // Set model
        this.webgl.set_color([1, 1, 1, 1]);
        this.model = WasmMat4f32.identity();
        this.model.scale3(sun_scale);
        this.webgl.set_uniform_mat4(WebglUniform.Model, this.model.array, true);
        this.webgl.draw(this.webgl_icosphere);
        this.webgl.set_color([1, 0.5, 0.7, 0.7]);
        const secs = this.vp.days_since_epoch * 86400;
        const v = new WasmVec3f64(0, 0, 0);
        for (const o of this.objects) {
            const q = o.orbit_to_parent();
            const orbit_period = o.period_of_orbit();
            const builder = new WasmBezierBuilder3f32();
            for (let t = 0; t <= 3; t++) {
                const time = secs + orbit_period * (t - 1) * 0.025;
                o.orbit_vec_of_unix_time(time, v);
                const v2 = q.apply3(v);
                const p = new WasmVec3f32(v2.array[0] * distance_scale, v2.array[1] * distance_scale, v2.array[2] * distance_scale);
                builder.add_vec_pt_at(t / 3.0, p);
            }
            const bezier = WasmBezier3f32.construct(builder);
            const p = new WasmVec3f32(0, 0, 0);
            for (const ab of [
                [0, 0.25],
                [0.166, 0.25],
                [0.333, 1.0],
                [0.5, 0.25],
                [0.666, 0.25],
                [1.0, 0.25],
            ]) {
                bezier === null || bezier === void 0 ? void 0 : bezier.set_vec_point_at(p, ab[0]);
                this.model = WasmMat4f32.identity();
                this.model.scale3(planet_scale * ab[1]);
                this.model.translate3(p);
                this.webgl.set_uniform_mat4(WebglUniform.Model, this.model.array, true);
                this.webgl.draw(this.webgl_icosphere);
            }
            this.webgl.use_program(this.bezier_program);
            this.model = WasmMat4f32.identity();
            this.webgl.set_color([1, 0.5, 0.7, 0.7]);
            this.webgl.set_uniform_mat4(WebglUniform.Model, this.model.array, false);
            (_a = this.webgl_bezier) === null || _a === void 0 ? void 0 : _a.set_bezier(bezier);
            this.webgl.draw(this.webgl_bezier);
            this.webgl.use_program(this.program);
        }
        return;
    }
    drag_end(_start_xy, _xy) { }
    user_press(_xy, actions) {
        actions.can_drag = true;
    }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_pan(_xy, _dxy) { }
    drag_start(_start_xy, _xy) { }
    drag_to(_start_xy, cxy0, cxy1) {
        const dx = cxy1[0] - cxy0[0];
        const dy = cxy1[1] - cxy0[1];
        const dqx = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 1, 0), dx * 0.01);
        const dqy = WasmQuatf32.of_axis_angle(new WasmVec3f32(1, 0, 0), dy * 0.01);
        this.q.premul(dqx);
        this.q.premul(dqy);
        this.star_catalog.set_view_needs_update();
    }
    user_release(_start_xy, _cxy) { }
    user_zoom(_cxy, factor) {
        this.view_scale *= factor;
        this.star_catalog.set_view_needs_update();
    }
    user_rotate(_xy, _angle) { }
}
