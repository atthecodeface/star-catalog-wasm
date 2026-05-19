import { WasmVec3f32, WasmVec3f64, WasmQuatf64, WasmBezier3f32, WasmBezierBuilder3f32, } from "../pkg/star_catalog_wasm.js";
import { WebglUniform } from "./web_gl.js";
import { CacheSingleton } from "./cache.js";
import { Logger } from "./log.js";
import { CachedBezier, MapFrameKey, } from "./webgl_canvas.js";
export class MapCanvas {
    constructor(application, webgl_canvas) {
        this.brightness = 4;
        this.last_drag_polar = [0, 0];
        this.drag_minutes = false;
        this.bezier = new WasmBezier3f32();
        this.builder = new WasmBezierBuilder3f32();
        this.vec = new WasmVec3f64(0, 0, 0);
        this.pt = new WasmVec3f32(0, 0, 0);
        this.to_left = false;
        this.application = application;
        this.vp = this.application.view_properties;
        this.webgl_canvas = webgl_canvas;
        this.logger = new Logger(application.log, "map");
        this.map_frame_beziers = new CacheSingleton();
        this.map_equatorial_grid_beziers = new CacheSingleton();
        this.map_azimuthal_grid_beziers = new CacheSingleton();
    }
    cache_beziers() {
        this.map_frame_beziers.set_contents(new MapFrameKey(this.vp.view_to_ecef_q, this.vp.fovh), () => this.create_frame_beziers());
        this.map_azimuthal_grid_beziers.set_contents(new MapFrameKey(this.vp.observer_to_ecef_q, 1.0), () => this.create_azimuthal_grid_beziers());
        this.map_equatorial_grid_beziers.set_contents(new MapFrameKey(WasmQuatf64.unit(), 1.0), () => this.create_equatorial_grid_beziers());
    }
    redraw(webgl, webgl_canvas) {
        this.cache_beziers();
        const w = this.vp.view_wh[0];
        const h = this.vp.view_wh[1];
        const view_scale = 1.0;
        const ar = 1.6;
        let xsc = 1.0;
        let ysc = w / h / ar;
        console.log(w, h, xsc, ysc);
        if (ysc > 1.0) {
            xsc /= ysc;
            ysc = 1.0;
        }
        webgl.webgl.viewport(0, 0, w, h);
        webgl.clear_buffer();
        webgl.use_program(webgl_canvas.star_map_program);
        webgl.set_uniform_float(WebglUniform.Extra0, this.vp.brightness);
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        const view = [
            view_scale * xsc,
            0,
            0,
            0,
            0,
            view_scale * ysc,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
        ];
        webgl.set_color([1, 1, 1, 1]);
        webgl.set_uniform_mat4(WebglUniform.View, view, true);
        webgl.draw(webgl_canvas.star_field);
        webgl.use_program(webgl_canvas.bezier_program);
        webgl.set_uniform_mat4(WebglUniform.Projection, identity, false);
        webgl.set_uniform_mat4(WebglUniform.View, view, true);
        webgl.set_uniform_mat4(WebglUniform.Model, identity, true);
        for (const bezier_sets of [
            this.map_frame_beziers.get_contents(),
            this.map_azimuthal_grid_beziers.get_contents(), //       if (this.vp.show_azimuthal) {
            this.map_equatorial_grid_beziers.get_contents(), //       if (this.vp.show_equatorial) {
        ]) {
            if (bezier_sets === null) {
                continue;
            }
            for (const b of bezier_sets) {
                webgl.set_color(b.color);
                webgl_canvas.webgl_bezier.set_control_points(b.control_pts, b.offset);
                webgl.draw(webgl_canvas.webgl_bezier);
            }
        }
        if (this.vp.selected_star) {
            const star = this.vp.catalog.star(this.vp.selected_star);
            webgl.use_program(webgl_canvas.flat_program);
            webgl.set_uniform_mat4(WebglUniform.Projection, identity, false);
            webgl.set_uniform_mat4(WebglUniform.View, view, true);
            webgl.set_color([1, 0.26, 0.16, 0.1]);
            const radius = 0.02;
            let cx = (star.right_ascension / Math.PI) * 1.0;
            let cy = (star.declination / Math.PI) * 2.0;
            if (cx > 1) {
                cx -= 2;
            }
            if (cy > 1) {
                cy -= 2;
            }
            webgl.set_uniform_mat4(WebglUniform.Model, [
                radius,
                0,
                0,
                cx,
                /**/ 0,
                radius * ar,
                0,
                cy,
                /**/ 0,
                0,
                1,
                0,
                /**/ 0,
                0,
                0,
                1,
            ], true);
            webgl.draw(webgl_canvas.webgl_circle);
        }
    }
    get_wh() {
        const wh = this.vp.get_resizable_content_size();
        let w = wh[0];
        let h = wh[1];
        const ar = 2.0;
        if (w > h * ar) {
            w = h * ar;
        }
        if (h > w / ar) {
            h = w / ar;
        }
        return [w, h];
    }
    //mi ra_de_of_cxy
    ra_de_of_cxy(cxy) {
        const wh = this.get_wh();
        const fx = cxy[0] / wh[0];
        const fy = cxy[1] / wh[1];
        const ra = (fx - 0.5) * 2 * Math.PI;
        const de = (0.5 - fy) * Math.PI;
        return [ra, de];
    }
    //mi cxy_of_ra_de
    // Canvas XY of RA and DE
    //
    // Canvas coordinates are X+ right Y+ down
    //
    // Declination 0 at the moddle, +DE up (PI for the height)
    //
    // RA is 0 at the middle RA+ right (2PI for the width)
    cxy_of_ra_de(ra, de) {
        const wh = this.get_wh();
        const x = 0.5 + ra / (2 * Math.PI);
        const y = 0.5 - de / Math.PI;
        const fx = x - Math.floor(x);
        const fy = y - Math.floor(y);
        const cx = fx * wh[0];
        const cy = fy * wh[1];
        return [cx, cy];
    }
    map_ra_de(i, ra, de) {
        const de_c = Math.cos(de);
        const de_s = Math.sin(de);
        const vxyz = this.application.wasm_memory.float_array_of_vec3f64(this.vec);
        vxyz[0] = de_c * Math.cos(ra);
        vxyz[1] = de_c * Math.sin(ra);
        vxyz[2] = de_s;
        this.vp.observer_to_ecef_q.set_vec_apply(this.vec);
        let de_frame = (Math.asin(vxyz[2]) / Math.PI) * 2.0;
        let ra_frame = (Math.atan2(vxyz[1], vxyz[0]) / Math.PI) * 1.0;
        if (i == 0) {
            this.to_left = ra_frame < 0.0;
        }
        else {
            if (this.to_left && ra_frame > 0.5) {
                ra_frame -= 2.0;
            }
            else if (!this.to_left && ra_frame < -0.5) {
                ra_frame += 2.0;
            }
        }
        return [ra_frame, de_frame, 0.0];
    }
    // 8 bezier per
    create_declination_circle_beziers(control_points, offset, result, de) {
        const de_r = de * this.vp.deg2rad;
        const da = this.vp.deg2rad;
        for (let i = 0; i < 360; i += 45) {
            const ra = i * da;
            result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, offset, [1, 1, 0, 1], this.map_ra_de.bind(this), [ra, de_r], [ra + da * 45, de_r]));
            offset += 16;
        }
        return offset;
    }
    // -80 to 80 in steps of 10 is 17; so 17 bezier per
    create_ra_great_circle_half_beziers(control_points, offset, result, ra) {
        const ra_r = ra * this.vp.deg2rad;
        const da = this.vp.deg2rad;
        for (let i = -80; i <= 70; i += 10) {
            const de = i * da;
            result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, offset, [1, 0, 1, 1], this.map_ra_de.bind(this), [ra_r, de], [ra_r, de + da * 10]));
            offset += 16;
        }
        return offset;
    }
    create_azimuthal_grid_beziers() {
        const result = [];
        const control_points = new Float32Array((160 + 408) * 16); // 4 axes each of 10 Beziers each of one mat4 (16 control point coordinates)
        let b = 0;
        // Each of these is 8 beziers; this is 19 circles (call it 20 for now)
        // Equator
        b = this.create_declination_circle_beziers(control_points, b, result, 0.0); // color
        // Above / below horizon
        for (let de = 10; de <= 80; de += 10) {
            b = this.create_declination_circle_beziers(control_points, b, result, de);
            b = this.create_declination_circle_beziers(control_points, b, result, -de);
        }
        // Each of these is 17 beziers; this is 24 circles (408 beziers)
        // Longitude 0
        b = this.create_ra_great_circle_half_beziers(control_points, b, result, 0);
        // Longitude 180
        b = this.create_ra_great_circle_half_beziers(control_points, b, result, 180);
        // Other longitudes
        for (let ra = 15; ra <= 165; ra += 15) {
            b = this.create_ra_great_circle_half_beziers(control_points, b, result, ra);
            b = this.create_ra_great_circle_half_beziers(control_points, b, result, -ra);
        }
        return result;
    }
    map_xy_view_frame(i, x, y) {
        this.application.sky_view_frame_to_ecef_set_vec(x, y, this.vec);
        const vxyz = this.application.wasm_memory.float_array_of_vec3f64(this.vec);
        let de = (Math.asin(vxyz[2]) / Math.PI) * 2.0;
        let ra = (Math.atan2(vxyz[1], vxyz[0]) / Math.PI) * 1.0;
        if (i == 0) {
            this.to_left = ra < 0.0;
        }
        else {
            if (this.to_left && ra > 0.75) {
                ra -= 2.0;
            }
            else if (!this.to_left && ra < -0.75) {
                ra += 2.0;
            }
        }
        return [ra, de, 0.0];
    }
    static map_xy_identity(_i, x, y) {
        return [x, y, 0.0];
    }
    create_equatorial_grid_beziers() {
        const result = [];
        const control_points = new Float32Array(30 * 16);
        let b = 0;
        for (const ra of [
            0.9999,
            5 / 6.0,
            4 / 6.0,
            3 / 6.0,
            2 / 6.0,
            1 / 6.0,
            0.001,
        ]) {
            for (const side of [-1, 1]) {
                result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, b, [0, 1, 0, 1], MapCanvas.map_xy_identity, [ra * side, -1], [ra * side, 1]));
                b += 16;
            }
        }
        for (let y = 0; y <= 3; y++) {
            let de = y / 3.0;
            for (const side of [-1, 1]) {
                result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, b, [0, 1, 0, 1], MapCanvas.map_xy_identity, [-1, de * side], [1, de * side]));
                b += 16;
                if (y == 0) {
                    break;
                }
            }
        }
        return result;
    }
    create_frame_beziers() {
        const result = [];
        const control_points = new Float32Array(4 * 10 * 16); // 4 axes each of 10 Beziers each of one mat4 (16 control point coordinates)
        let b = 0;
        for (const xy of [-1, 1]) {
            for (let i = 0; i < 10; i++) {
                let lx = i / 5.0 - 1.0;
                let rx = (i + 1) / 5.0 - 1.0;
                result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, b, [1, 0, 0, 1], this.map_xy_view_frame.bind(this), [lx, xy], [rx, xy]));
                b += 16;
                result.push(CachedBezier.create_mapped(this.application.wasm_memory, control_points, b, [1, 0, 0, 1], this.map_xy_view_frame.bind(this), [xy, lx], [xy, rx]));
                b += 16;
            }
        }
        return result;
    }
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_pan(_xy, _dxy) { }
    user_rotate(_xy, _angle) { }
    user_zoom(_cxy, factor) {
        this.application.sky_view_zoom_by(factor);
    }
    drag_start(_start_xy, xy) {
        const ra_de = this.ra_de_of_cxy(xy);
        this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
    }
    drag_to(_start_xy, _old_xy, new_xy) {
        const ra_de = this.ra_de_of_cxy(new_xy);
        this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
    }
    drag_end(_start_xy, xy) {
        const ra_de = this.ra_de_of_cxy(xy);
        this.application.sky_view_center_on_ra_de(ra_de[0], ra_de[1]);
        this.vp.log_compass_elevation_update();
    }
    user_release(_start_xy, xy) {
        const catalog = this.application.catalog;
        const ra_de = this.ra_de_of_cxy(xy);
        catalog.clear_filter();
        catalog.filter_max_magnitude(this.brightness);
        this.application.select_star(catalog.closest_to_ra_de(ra_de[0], ra_de[1]));
    }
}
