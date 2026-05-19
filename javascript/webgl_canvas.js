import { WasmVec3f32, WasmMat4f32, WasmIcosphere, WasmQuatf64, WasmBezier3f32, WasmBezierBuilder3f32, } from "../pkg/star_catalog_wasm.js";
import { Webgl, Webgl3DObj, WebglCubicBezierShader, WebglFlatShader, WebglFlatObj, WebglCubicBezierObj, } from "./web_gl.js";
import { Logger } from "./log.js";
import { Mouse } from "./mouse.js";
import { EarthShader, StarShader, SphereShader, StarMapShader, StarShaderProjectedOntoNear, } from "./shaders.js";
import { SolarSystem } from "./solar_system.js";
import { StarField } from "./star_field.js";
export class CachedBezier {
    constructor(color, control_pts, offset = 0) {
        this.control_pts = control_pts;
        this.color = color;
        this.offset = offset;
    }
    static init() {
        this.bezier = new WasmBezier3f32();
        this.builder = new WasmBezierBuilder3f32();
        this.pt = new WasmVec3f32(0, 0, 0);
    }
    static create_mapped(wasm_memory, control_points, offset, color, map, x0_y0, x1_y1) {
        if (!this.initialized) {
            this.init();
        }
        this.builder.clear();
        for (let j = 0; j < 4; j++) {
            const x = (x0_y0[0] * (3 - j) + x1_y1[0] * j) / 3;
            const y = (x0_y0[1] * (3 - j) + x1_y1[1] * j) / 3;
            const pt0 = wasm_memory.float_array_of_vec3f32(this.pt);
            pt0.set(map(j, x, y), 0);
            this.builder.add_vec_pt_at(j / 3.0, this.pt);
        }
        this.bezier.reconstruct(this.builder);
        for (let j = 0; j < 4; j++) {
            this.bezier.set_vec_control_pt(this.pt, j);
            const pt0 = wasm_memory.float_array_of_vec3f32(this.pt);
            control_points.set(pt0, offset + j * 4);
        }
        return new CachedBezier(color, control_points, offset);
    }
}
CachedBezier.initialized = false;
export class MapFrameKey {
    constructor(q, fovh) {
        this.q = new WasmQuatf64(q.i, q.j, q.k, q.r);
        this.fovh = fovh;
    }
    key_is_equal(other) {
        return this.q.distance_sq(other.q) == 0.0 && this.fovh == other.fovh;
    }
}
export class WebglCanvas {
    constructor(application, div_id) {
        this.webgl = null;
        this.earth_program = 0;
        this.sphere_program = 0;
        this.flat_program = 0;
        this.bezier_program = 0;
        this.star_program = 0;
        this.star_projected_onto_near_program = 0;
        this.star_map_program = 0;
        this.webgl_icosphere = null;
        this.webgl_axis = null;
        this.webgl_bezier = null;
        this.webgl_triangle = null;
        this.webgl_circle = null;
        this.model = WasmMat4f32.identity();
        this.application = application;
        this.vp = application.view_properties;
        this.logger = new Logger(application.log, "webgl_canvas");
        const div = document.getElementById(div_id);
        this.canvas = document.createElement("canvas");
        div.appendChild(this.canvas);
        this.mouse = new Mouse(this, this.canvas);
        this.canvas.height = 900;
        this.current_wh = [50, 50];
        this.webgl = new Webgl(application.log, this.canvas);
        this.solar_system = new SolarSystem();
        this.star_field = new StarField(application);
        if (!this.start_webgl(8)) {
            throw "Webgl was not created correctly; aborting webgl canvas";
        }
    }
    start_webgl(icos_division) {
        if (!this.webgl.start_webgl()) {
            return false;
        }
        {
            const program = this.webgl.compile_program(new EarthShader());
            if (program === null) {
                return false;
            }
            this.earth_program = program;
        }
        {
            const program = this.webgl.compile_program(new SphereShader());
            if (program === null) {
                return false;
            }
            else {
                this.sphere_program = program;
            }
        }
        {
            const program = this.webgl.compile_program(new StarShader());
            if (program === null) {
                return false;
            }
            else {
                this.star_program = program;
            }
        }
        {
            const program = this.webgl.compile_program(new StarShaderProjectedOntoNear());
            if (program === null) {
                return false;
            }
            else {
                this.star_projected_onto_near_program = program;
            }
        }
        {
            const program = this.webgl.compile_program(new StarMapShader());
            if (program === null) {
                return false;
            }
            else {
                this.star_map_program = program;
            }
        }
        {
            const program = this.webgl.compile_program(new WebglFlatShader());
            if (program === null) {
                return false;
            }
            else {
                this.flat_program = program;
            }
        }
        {
            const program = this.webgl.compile_program(new WebglCubicBezierShader());
            if (program === null) {
                return false;
            }
            else {
                this.bezier_program = program;
            }
        }
        this.webgl_triangle = new Webgl3DObj(3, 3);
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0, 0.05773]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, -0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_face([0, 2, 1]);
        this.webgl.create(this.webgl_triangle);
        const icos = new WasmIcosphere();
        icos.subdivide(icos_division);
        this.webgl_icosphere = new Webgl3DObj(icos.num_vertices, icos.num_faces * 3);
        for (var i = 0; i < icos.num_vertices; i++) {
            const v = icos.subdiv_vertex(i);
            this.webgl_icosphere.add_vertex(v.position.array, v.texture.array);
        }
        for (var i = 0; i < icos.num_faces; i++) {
            const f = icos.subdiv_face(i);
            this.webgl_icosphere.add_face([f[0], f[1], f[2]]);
        }
        this.webgl.create(this.webgl_icosphere);
        this.webgl_axis = WebglFlatObj.axis(2, [
            [10, 0.05],
            [2, 0.1],
        ]);
        this.webgl.create(this.webgl_axis);
        this.webgl_circle = WebglFlatObj.circle(1.0, 20);
        this.webgl.create(this.webgl_circle);
        this.webgl_bezier = new WebglCubicBezierObj();
        this.webgl.create(this.webgl_bezier);
        this.webgl.create(this.star_field);
        this.solar_system.webgl_init(this.webgl);
        this.logger.info(`Created full webgl content`);
        return true;
    }
    redraw(client) {
        if (this.webgl !== null) {
            const wh = this.vp.get_resizable_content_size();
            if (this.current_wh != wh) {
                this.canvas.width = wh[0];
                this.canvas.height = wh[1];
                this.current_wh = wh;
            }
            client.redraw(this.webgl, this);
        }
    }
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_release(_start_xy, _cxy) { }
    drag_start(_start_xy, _xy) { }
    drag_to(_start_xy, _cxy0, _cxy1) { }
    drag_end(_start_xy, _xy) { }
    user_pan(_xy, _dxy) { }
    user_zoom(_cxy, _factor) { }
    user_rotate(_xy, _angle) { }
}
