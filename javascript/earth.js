import { WasmIcosphere } from "../pkg/star_catalog_wasm.js";
import { WasmVec3f32, WasmMat4f32 } from "../pkg/star_catalog_wasm.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
import { WebglTexture, WebglUniform, Webgl, Webgl3DObj } from "./web_gl.js";
import { EarthShader } from "./shaders.js";
export class Earth {
    constructor(application, canvas_div_id, width, height, use_webgl, division) {
        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;
        this.webgl_icosphere = null;
        this.webgl_triangle = null;
        this.webgl = null;
        this.program = 0;
        this.texture = null;
        this.application = application;
        this.vp = application.view_properties;
        this.logger = new Logger(application.log, "earth");
        const size = Math.min(width, height);
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        this.width = size;
        this.height = size;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.webgl = new Webgl(application.log, this.canvas);
        this.use_webgl = use_webgl;
        this.ctx = null;
        this.mouse = new Mouse(this, this.canvas);
        this.icos = new WasmIcosphere();
        this.icos.subdivide(division);
        this.view_scale = 0.9;
        this.start_webgl();
    }
    update() {
        this.draw();
    }
    start_webgl() {
        if (!this.webgl.start_webgl()) {
            this.webgl = null;
            return;
        }
        const program = this.webgl.compile_program(new EarthShader());
        if (program === null) {
            this.webgl = null;
            return;
        }
        this.program = program;
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
        this.webgl_triangle = new Webgl3DObj(3, 3);
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0, 0.05773]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, -0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_face([0, 2, 1]);
        this.webgl.create(this.webgl_triangle);
        this.texture = new WebglTexture(this.webgl, new Image()); // on loaded call this.draw()!
        this.texture.image.src = "images/Blue_Marble_2002_x10.jpg";
        this.logger.info("webgl", `WebGl started successfully`);
    }
    webgl_draw() {
        const styling = this.vp.styling();
        if (this.webgl === null) {
            return;
        }
        this.webgl.webgl.viewport(0, 0, this.width, this.height);
        this.webgl.use_program(this.program);
        this.webgl.clear_buffer();
        this.vp.view_wh = [this.width, this.height];
        // WebGL has a clip space of -1,-1,-1 to 1,1,1; negative z is more visible
        const projection = [
            0,
            0,
            -this.view_scale,
            0,
            this.view_scale,
            0,
            0,
            0,
            0,
            this.view_scale,
            0,
            0,
            0,
            0,
            0,
            1,
        ];
        this.webgl.set_uniform_mat4(WebglUniform.Projection, projection);
        const matrix = WasmMat4f32.identity();
        this.vp.earth.q.set_mat4_rotation(matrix);
        this.webgl.set_uniform_mat4(WebglUniform.View, matrix.array, true);
        this.webgl.set_texture(this.texture);
        this.webgl.set_color(styling.earth.color);
        const model = WasmMat4f32.identity();
        this.webgl.set_uniform_mat4(WebglUniform.Model, model.array, false);
        this.webgl.draw(this.webgl_icosphere);
        this.webgl.set_color([1, 0, 0, 0]);
        this.vp.earth.triangle_q_ll.set_mat4_rotation(matrix);
        this.webgl.set_uniform_mat4(WebglUniform.Model, matrix.array, true);
        this.webgl.draw(this.webgl_triangle);
    }
    derive_data() { }
    // Used in user_release
    latlon_of_cxy(cxy) {
        // This should not be required; it ought to have been done before at any adjustment to the display
        //
        // This method does need this.vp.earth.q, which the derive_data finds
        this.derive_data();
        // Convert the location cxy into a position on the *circle* that is the drawing of the earth
        const dx = ((cxy[0] / this.width) * 2 - 1.0) / this.view_scale;
        const dy = (1.0 - (cxy[1] / this.height) * 2) / this.view_scale;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 0.98) {
            return null;
        }
        // Convert to a roll/yaw on the sphere that the circle is a projection of
        const d = Math.sqrt(d2);
        const dz = Math.sqrt(1 - d2);
        const yaw = Math.atan2(d, dz);
        const roll = Math.atan2(dy, dx);
        // Convert the roll/yaw to a unit vector on the sphere
        const v = new WasmVec3f32(Math.cos(yaw), Math.sin(yaw) * Math.cos(roll), Math.sin(yaw) * Math.sin(roll));
        // Undo the orientation that mapped the earth to the last displayed earth image
        const world = this.vp.earth.q.conjugate().apply(v);
        // Extract the lat/lon of this
        const lat = this.rad2deg * Math.asin(world.array[2]);
        const lon = this.rad2deg * Math.atan2(world.array[1], world.array[0]);
        return [lat, lon];
    }
    draw() {
        this.derive_data();
        if (!this.texture.texture_bound) {
            return;
        }
        if (this.webgl !== null) {
            this.webgl_draw();
        }
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
