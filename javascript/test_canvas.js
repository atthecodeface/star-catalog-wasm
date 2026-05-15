import { WasmVec3f32, WasmQuatf32, WasmMat4f32, WasmIcosphere, } from "../pkg/star_catalog_wasm.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
import { StarShader, SphereShader } from "./shaders.js";
import { SolarSystem } from "./solar_system.js";
import { StarField } from "./star_field.js";
import { Webgl, Webgl3DObj, WebglCubicBezierShader, WebglFlatShader, WebglFlatObj, WebglUniform, WebglCubicBezierObj, } from "./web_gl.js";
export class TestCanvas {
    constructor(application, canvas_div_id) {
        this.webgl = null;
        this.sphere_program = 0;
        this.flat_program = 0;
        this.bezier_program = 0;
        this.star_program = 0;
        this.texture = null;
        this.q = new WasmQuatf32(0, 0, 0, 1);
        this.triangle_q_ll = new WasmQuatf32(0, 0, 0, 1);
        this.webgl_icosphere = null;
        this.webgl_axis = null;
        this.webgl_bezier = null;
        this.view_scale = 3.0;
        this.model = WasmMat4f32.identity();
        this.application = application;
        this.vp = application.view_properties;
        this.logger = new Logger(application.log, "test");
        this.div = document.getElementById(canvas_div_id);
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
                this.sphere_program = program;
            }
        }
        if (webgl_okay) {
            const program = this.webgl.compile_program(new StarShader());
            if (program === null) {
                webgl_okay = false;
            }
            else {
                this.star_program = program;
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
        if (webgl_okay) {
            this.webgl.create(this.star_field);
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
        const origin = new WasmVec3f32(0.0, 0.0, -3.0);
        const secs = this.vp.days_since_epoch * 86400;
        this.solar_system.set_time(secs);
        let projection = WasmMat4f32.identity().transpose().array;
        projection = WasmMat4f32.perspective(1.6, ar, 2.0, -20.0).transpose().array;
        projection = WasmMat4f32.identity().transpose().array;
        const fov = 3.0 / (this.view_scale + 1);
        const f = 1.0 / Math.tan(fov / 2);
        const near = 1.0; // Maps to -1 in the Z, closest to the viewer, should scale by 1/near
        const far = 200.0; // Maps to +1 in the Z, furthest to the viewer, should scale by 1/far
        // W = -z
        // Z = (near + far) / (near - far) * z - (near * far * 2) / (near - far) = (near * z + far * z - near * far * 2) / (near - far)
        //  if z = near, Z(*w) = (near * near + far * near - near * far * 2) / (near - far) = (near * near - near * far) / (near - far) = near; Z = -1
        //  if z = far, Z(*w) = (near * far + far * far - near * far * 2) / (near - far) = (far * far - near * far) / (near - far) = -far; Z = 1
        // Note this has to flip the polarity of Z as the OpenGL clipping space is + into the screen, so -1 is near, +1 is far
        projection = new Float32Array([
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
            -1,
            0,
            0,
            (near * far * 2) / (near - far),
            0,
        ]);
        const view_matrix = WasmMat4f32.identity();
        this.q.set_mat4_rotation(view_matrix);
        this.webgl.use_program(this.star_program);
        this.webgl.set_color([1, 1, 1, 1]);
        this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        this.webgl.draw(this.star_field);
        this.webgl.clear_depth_buffer();
        if (this.star_field === null) {
            return;
        }
        view_matrix.set_translate_by_vec3(origin);
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
        this.solar_system.draw_orbits(this.webgl, this.webgl_bezier);
        this.webgl.use_program(this.sphere_program);
        this.webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        this.webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        this.solar_system.draw_sun(this.webgl, this.webgl_icosphere);
        this.solar_system.draw_planets(this.webgl, this.webgl_icosphere);
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
        this.q.set_premul(dqx);
        this.q.set_premul(dqy);
        // No content change, purely visual
        this.vp.view_updated();
    }
    user_release(_start_xy, _cxy) { }
    user_zoom(_cxy, factor) {
        this.view_scale *= factor;
        // No content change, purely visual
        this.vp.view_updated();
    }
    user_rotate(_xy, angle) {
        const dqz = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 0, 1), angle);
        this.q.set_premul(dqz);
        // No content change, purely visual
        this.vp.view_updated();
    }
}
