import { WasmVec3f32, WasmQuatf32, WasmMat4f32, } from "../pkg/star_catalog_wasm.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
import { WebglCanvas } from "./webgl_canvas.js";
export class TestCanvas {
    constructor(application, canvas_div_id) {
        this.webgl = null;
        this.sphere_program = 0;
        this.flat_program = 0;
        this.bezier_program = 0;
        this.star_program = 0;
        this.texture = null;
        this.triangle_q_ll = new WasmQuatf32(0, 0, 0, 1);
        this.webgl_icosphere = null;
        this.webgl_axis = null;
        this.webgl_bezier = null;
        this.model = WasmMat4f32.identity();
        this.application = application;
        this.vp = application.view_properties;
        this.logger = new Logger(application.log, "test");
        this.div = document.getElementById(canvas_div_id);
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
        this.vp.solar_sytem_orientation.set_premul(dqx);
        this.vp.solar_sytem_orientation.set_premul(dqy);
        // No content change, purely visual
        this.vp.view_updated();
    }
    user_release(_start_xy, _cxy) { }
    user_zoom(_cxy, factor) {
        this.vp.solar_system_fovh *= Math.pow(factor, 0.1);
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
