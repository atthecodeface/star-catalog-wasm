import { WasmMat4f32 } from "../pkg/star_catalog_wasm.js";
import { Logger } from "./log.js";
import { WebglUniform } from "./web_gl.js";
export class Earth {
    constructor(application, webgl_canvas) {
        this.application = application;
        this.vp = application.view_properties;
        this.webgl_canvas = webgl_canvas;
        this.logger = new Logger(application.log, "earth");
    }
    redraw(webgl, webgl_canvas) {
        const w = this.vp.view_wh[0];
        const h = this.vp.view_wh[1];
        const view_scale = 0.9;
        const ar = w / h;
        const q = this.vp.earth.q;
        const triangle_q_ll = this.vp.earth.triangle_q_ll;
        webgl.webgl.viewport(0, 0, w, h);
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
            webgl.set_texture(t);
        }
        webgl.set_color(styling.earth.color);
        const model = WasmMat4f32.identity();
        webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
        webgl.draw(webgl_canvas.webgl_icosphere);
        webgl.set_color([1, 0, 0, 0]);
        triangle_q_ll.set_mat4_rotation(matrix);
        webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
        webgl.draw(webgl_canvas.webgl_triangle);
    }
    drag_start(_start_xy, _xy) { }
    drag_end(_start_xy, _xy) { }
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_pan(_xy, _dxy) { }
    user_rotate(_xy, _angle) { }
    drag_to(_start_xy, old_xy, new_xy) {
        const dcx = old_xy[0] - new_xy[0];
        const dcy = old_xy[1] - new_xy[1];
        this.vp.earth.center_on_lat -= dcy;
        this.vp.earth.center_on_lon -= dcx;
        this.application.view_updated();
    }
    user_release(_start_xy, cxy) {
        const lat_lon = this.vp.earth.latlon_of_cxy(this.vp, cxy);
        if (lat_lon == null) {
            return;
        }
        this.vp.update_latlon(lat_lon[0], lat_lon[1]);
        console.log(lat_lon[0], lat_lon[1]);
        this.application.location_updated();
    }
    user_zoom(_cxy, factor) {
        if (factor < 1.0) {
            this.vp.earth.center_on_lon -= 1.0 / factor;
        }
        else {
            this.vp.earth.center_on_lon += factor;
        }
        this.application.view_updated();
    }
}
