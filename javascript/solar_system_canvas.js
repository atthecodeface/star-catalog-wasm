import { WasmVec3f32, WasmMat4f32, WasmQuatf32, } from "../pkg/star_catalog_wasm.js";
import { WebglUniform } from "./web_gl.js";
import { Logger } from "./log.js";
export class SolarSystemCanvas {
    constructor(application, webgl_canvas) {
        this.application = application;
        this.vp = application.view_properties;
        this.webgl_canvas = webgl_canvas;
        this.logger = new Logger(application.log, "test");
    }
    redraw(webgl, webgl_canvas) {
        const w = this.vp.view_wh[0];
        const h = this.vp.view_wh[1];
        const ar = w / h;
        webgl.webgl.viewport(0, 0, w, h);
        webgl.clear_buffer();
        // +Y moves it right
        // +Z moves it up
        // +X moves it out of screen
        const origin = new WasmVec3f32(0.0, 0.0, -3.0);
        const secs = this.vp.days_since_epoch * 86400;
        webgl_canvas.solar_system.set_time(secs);
        let projection = WasmMat4f32.identity().transpose().array;
        projection = WasmMat4f32.perspective(1.6, ar, 2.0, -20.0).transpose().array;
        projection = WasmMat4f32.identity().transpose().array;
        const f = 1.0 / Math.tan(this.vp.solar_system_fovh);
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
        this.vp.solar_sytem_orientation.set_mat4_rotation(view_matrix);
        webgl.use_program(webgl_canvas.star_projected_onto_near_program);
        webgl.set_color([1, 1, 1, 1]);
        webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);
        webgl.draw(webgl_canvas.star_field);
        webgl.clear_depth_buffer();
        view_matrix.set_translate_by_vec3(origin);
        // Set view
        webgl.use_program(webgl_canvas.flat_program);
        webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        // red for X axis
        webgl.set_color([1, 0.26, 0.16, 0.1]);
        webgl.set_uniform_mat4(WebglUniform.Model, [1, 0, 0, -1, /**/ 0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1], true);
        webgl.draw(webgl_canvas.webgl_axis);
        // purple for Z axis
        webgl.set_color([1, 0.2, 1.0, 1]);
        webgl.set_uniform_mat4(WebglUniform.Model, [0, 1, 0, 0, /**/ 0, 0, 1, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 0, 1], true);
        webgl.draw(webgl_canvas.webgl_axis);
        // white for Y axis
        webgl.set_color([1, 1, 1, 1]);
        webgl.set_uniform_mat4(WebglUniform.Model, [0, 1, 0, 0, /**/ 1, 0, 0, -1, /**/ 0, 0, 1, 0, /**/ 0, 0, 0, 1], true);
        webgl.draw(webgl_canvas.webgl_axis);
        webgl.use_program(webgl_canvas.bezier_program);
        webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        webgl_canvas.solar_system.draw_orbits(webgl, webgl_canvas.webgl_bezier);
        webgl.use_program(webgl_canvas.earth_program);
        webgl.set_uniform_mat4(WebglUniform.Projection, projection, false);
        webgl.set_uniform_mat4(WebglUniform.View, view_matrix.array, true);
        webgl_canvas.solar_system.draw_sun(webgl, webgl_canvas.webgl_icosphere);
        webgl_canvas.solar_system.draw_planets(webgl, webgl_canvas.webgl_icosphere);
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
        const dqx = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 0, 1), -dx * 0.01);
        const dqy = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 1, 0), dy * 0.01);
        this.vp.solar_sytem_orientation.set_premul(dqx);
        this.vp.solar_sytem_orientation.set_premul(dqy);
        // No content change, purely visual
        this.vp.view_updated();
    }
    user_release(_start_xy, _cxy) { }
    user_zoom(_cxy, factor) {
        this.vp.solar_system_fovh += (1.0 - factor) * 0.1;
        console.log(factor, this.vp.solar_system_fovh);
        this.vp.solar_system_fovh = Math.min(Math.max(this.vp.solar_system_fovh, 0.01), 1.5);
        console.log(factor, this.vp.solar_system_fovh);
        // No content change, purely visual
        this.vp.view_updated();
    }
    user_rotate(_xy, angle) {
        const dqz = WasmQuatf32.of_axis_angle(new WasmVec3f32(0, 0, 1), angle);
        this.vp.solar_sytem_orientation.set_premul(dqz);
        // No content change, purely visual
        this.vp.view_updated();
    }
}
