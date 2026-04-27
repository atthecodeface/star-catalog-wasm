import { WasmIcosphere } from "../pkg/star_catalog_wasm.js";
import { WasmVec3f32, WasmMat4f32, WasmQuatf32, } from "../pkg/star_catalog_wasm.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
class WebglObj {
    constructor(max_vertices, max_indices) {
        this.num_vertices = 0;
        this.num_indices = 0;
        this.position_buf = null;
        this.tex_coord_buf = null;
        this.indices_buf = null;
        this.positions = new Float32Array(3 * max_vertices);
        this.tex_coords = new Float32Array(2 * max_vertices);
        this.indices = new Uint16Array(3 * max_indices);
    }
    add_vertex(position, texcoord) {
        this.positions.set(position, this.num_vertices * 3);
        this.tex_coords.set(texcoord, this.num_vertices * 2);
        this.num_vertices += 1;
    }
    add_face(indices) {
        this.indices.set(indices, this.num_indices);
        this.num_indices += indices.length;
    }
    webgl_create(webgl) {
        this.position_buf = webgl.createBuffer();
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
        webgl.bufferData(webgl.ARRAY_BUFFER, this.positions.buffer, webgl.STATIC_DRAW);
        this.tex_coord_buf = webgl.createBuffer();
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
        webgl.bufferData(webgl.ARRAY_BUFFER, this.tex_coords.buffer, webgl.STATIC_DRAW);
        this.indices_buf = webgl.createBuffer();
        webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
        webgl.bufferData(webgl.ELEMENT_ARRAY_BUFFER, this.indices.buffer, webgl.STATIC_DRAW);
    }
    draw(webgl) {
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.position_buf);
        webgl.enableVertexAttribArray(0);
        webgl.vertexAttribPointer(0, 3, webgl.FLOAT, false, 0, 0);
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.tex_coord_buf);
        webgl.enableVertexAttribArray(1);
        webgl.vertexAttribPointer(1, 2, webgl.FLOAT, false, 0, 0);
        webgl.bindBuffer(webgl.ELEMENT_ARRAY_BUFFER, this.indices_buf);
        webgl.drawElements(webgl.TRIANGLES, this.num_indices, webgl.UNSIGNED_SHORT, 0);
    }
}
export class Earth {
    constructor(star_catalog, canvas_div_id, width, height, use_webgl, division) {
        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;
        this.webgl_icosphere = null;
        this.webgl_triangle = null;
        this.webgl = null;
        this.program = null;
        this.u_projection = null;
        this.u_view = null;
        this.u_model = null;
        this.u_color = null;
        this.u_sampler = null;
        this.texture = null;
        this.q = new WasmQuatf32(0, 0, 0, 1);
        this.triangle_q_ll = new WasmQuatf32(0, 0, 0, 1);
        this.star_catalog = star_catalog;
        this.vp = this.star_catalog.vp;
        this.logger = new Logger(star_catalog.log, "earth");
        this.styling = this.star_catalog.styling;
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        const size = Math.min(width, height);
        this.width = size;
        this.height = size;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        // console.log("Earh: constructor: created with size ", this.width, this.height, " in ", canvas_div_id);
        this.use_webgl = use_webgl;
        this.ctx = null;
        this.mouse = new Mouse(this, this.canvas);
        this.icos = new WasmIcosphere();
        this.icos.subdivide(division);
        this.view_scale = 0.9;
        this.center_on_lat = this.vp.lat;
        this.center_on_lon = -this.vp.lon;
        this.texture_image = new Image();
        this.texture_loaded = false;
        this.texture_created = false;
        this.texture_image.onload = () => {
            this.logger.info("webgl", `Loaded earth texture`);
            this.texture_loaded = true;
            this.draw();
        };
        this.texture_image.src = "Blue_Marble_2002_x10.jpg";
        this.window_loaded();
    }
    center_lat_lon(lat, lon) {
        this.center_on_lat = lat;
        this.center_on_lon = -lon;
    }
    update() {
        this.draw();
    }
    //mi window_loaded
    window_loaded() {
        this.webgl = null;
        if (this.use_webgl) {
            this.start_webgl(this.canvas);
        }
        // this.canvas.width = this.canvas.offsetWidth;
        // this.canvas.height = this.canvas.offsetHeight;
        if (this.webgl == null) {
            this.ctx = this.canvas.getContext("2d");
            this.logger.info("webgl", `Using 2D context for the earth sphere ${this.ctx}`);
        }
        else {
            this.logger.info("webgl", `Using 3D context for the earth sphere`);
        }
    }
    //mi start_webgl
    start_webgl(canvas) {
        var gl;
        try {
            gl = canvas.getContext("webgl");
        }
        catch (x) {
            this.logger.error("webgl", `Failed to get WebGL context`);
            return;
        }
        this.webgl = gl;
        if (this.webgl === null) {
            return;
        }
        const vertex_e = document.getElementById("vertex_src");
        const fragment_e = document.getElementById("fragment_src");
        if (vertex_e == null || fragment_e == null) {
            this.logger.error("webgl", `Could not find both vertex and fragment src in the page`);
            return;
        }
        const vertex_src = vertex_e.innerText;
        const fragment_src = fragment_e.innerText;
        this.program = this.webgl.createProgram();
        const vs = this.webgl_load_shader(this.webgl.VERTEX_SHADER, vertex_src);
        if (vs == null) {
            this.logger.error("webgl", `Failed to compile vertex shader`);
            return;
        }
        this.webgl.attachShader(this.program, vs);
        this.webgl.deleteShader(vs);
        const fs = this.webgl_load_shader(this.webgl.FRAGMENT_SHADER, fragment_src);
        if (fs == null) {
            this.logger.error("webgl", `Failed to compile fragment shader`);
            return;
        }
        this.webgl.attachShader(this.program, fs);
        this.webgl.deleteShader(fs);
        this.webgl.linkProgram(this.program);
        this.webgl.useProgram(this.program);
        if (!this.webgl.getProgramParameter(this.program, this.webgl.LINK_STATUS)) {
            this.logger.error("webgl", `Failed to load shaders ${this.webgl.getProgramInfoLog(this.program)}`);
            return;
        }
        this.webgl_icosphere = new WebglObj(this.icos.num_vertices, this.icos.num_faces * 3);
        for (var i = 0; i < this.icos.num_vertices; i++) {
            const v = this.icos.subdiv_vertex(i);
            this.webgl_icosphere.add_vertex(v.position.array, v.texture.array);
        }
        for (var i = 0; i < this.icos.num_faces; i++) {
            const f = this.icos.subdiv_face(i);
            this.webgl_icosphere.add_face([f[0], f[1], f[2]]);
        }
        this.webgl_icosphere.webgl_create(this.webgl);
        this.webgl_triangle = new WebglObj(3, 3);
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0, 0.05773]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, -0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_vertex(new Float32Array([1.0, 0.05, -0.02887]), new Float32Array([0, 0]));
        this.webgl_triangle.add_face([0, 2, 1]);
        this.webgl_triangle.webgl_create(this.webgl);
        this.u_projection = this.webgl.getUniformLocation(this.program, "projection");
        this.u_view = this.webgl.getUniformLocation(this.program, "view");
        this.u_model = this.webgl.getUniformLocation(this.program, "model");
        this.u_color = this.webgl.getUniformLocation(this.program, "color");
        ((this.u_sampler = this.webgl.getUniformLocation(this.program, "uSampler")),
            (this.texture = this.webgl.createTexture()));
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
        this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, 1, 1, 0, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_MIN_FILTER, this.webgl.LINEAR);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_S, this.webgl.CLAMP_TO_EDGE);
        this.webgl.texParameteri(this.webgl.TEXTURE_2D, this.webgl.TEXTURE_WRAP_T, this.webgl.CLAMP_TO_EDGE);
        this.webgl.viewport(0, 0, this.width, this.height);
        this.logger.info("webgl", `WebGl started successfully`);
    }
    webgl_load_shader(kind, src) {
        if (this.webgl === null) {
            return;
        }
        const shader = this.webgl.createShader(kind);
        if (shader == null) {
            this.logger.error("webgl", `Failed to create shader`);
            return null;
        }
        this.webgl.shaderSource(shader, src);
        this.webgl.compileShader(shader);
        if (!this.webgl.getShaderParameter(shader, this.webgl.COMPILE_STATUS)) {
            this.logger.error("webgl", `Failed to compile shader ${this.webgl.getShaderInfoLog(shader)}`);
            return null;
        }
        return shader;
    }
    webgl_draw() {
        if (this.webgl === null) {
            return;
        }
        const matrix = new Float32Array(16);
        const color = new Float32Array(4);
        this.webgl.useProgram(this.program);
        // this.webgl.enable(this.webgl.CULL_FACE);
        // this.webgl.cullFace(this.webgl.BACK);
        this.webgl.enable(this.webgl.DEPTH_TEST); // Enable depth testing
        this.webgl.depthFunc(this.webgl.LEQUAL); // Near things obscure far things
        // Clear the canvas before we start drawing on it.
        this.webgl.clear(this.webgl.COLOR_BUFFER_BIT | this.webgl.DEPTH_BUFFER_BIT);
        if (this.texture_loaded && !this.texture_created) {
            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            this.webgl.texImage2D(this.webgl.TEXTURE_2D, 0, this.webgl.RGBA, this.webgl.RGBA, this.webgl.UNSIGNED_BYTE, this.texture_image);
            this.texture_created = true;
        }
        if (this.u_projection != null) {
            // WebGL has a clip space of -1,-1,-1 to 1,1,1; negative z is more visible
            const x = WasmMat4f32.from_array(new Float32Array([
                0,
                this.view_scale,
                0,
                0,
                0,
                0,
                this.view_scale,
                0,
                -this.view_scale,
                0,
                0,
                0,
                0,
                0,
                0,
                1,
            ]));
            matrix.set(x.transpose().array, 0);
            this.webgl.uniformMatrix4fv(this.u_projection, false, matrix);
        }
        if (this.u_view != null) {
            const x = WasmMat4f32.identity();
            this.q.set_rotation4(x);
            matrix.set(x.transpose().array, 0);
            this.webgl.uniformMatrix4fv(this.u_view, false, matrix);
        }
        if (this.texture_created) {
            this.webgl.activeTexture(this.webgl.TEXTURE0);
            this.webgl.bindTexture(this.webgl.TEXTURE_2D, this.texture);
            this.webgl.uniform1i(this.u_sampler, 0);
        }
        if (this.u_color != null) {
            color.set(this.styling.earth.color, 0);
            this.webgl.uniform4fv(this.u_color, color);
        }
        if (this.u_model != null) {
            const x = WasmMat4f32.identity();
            matrix.set(x.transpose().array, 0);
            this.webgl.uniformMatrix4fv(this.u_model, false, matrix);
        }
        this.webgl_icosphere.draw(this.webgl);
        if (this.u_color != null) {
            color.set([1, 0, 0, 0], 0);
            this.webgl.uniform4fv(this.u_color, color);
        }
        if (this.u_model != null) {
            const x = WasmMat4f32.identity();
            this.triangle_q_ll.set_rotation4(x);
            matrix.set(x.transpose().array, 0);
            this.webgl.uniformMatrix4fv(this.u_model, false, matrix);
        }
        this.webgl_triangle.draw(this.webgl);
    }
    derive_data() {
        if (this.center_on_lat < -80) {
            this.center_on_lat = -80;
        }
        if (this.center_on_lat > 80) {
            this.center_on_lat = 80;
        }
        if (this.center_on_lon < -180) {
            this.center_on_lon += 360;
        }
        if (this.center_on_lon > 180) {
            this.center_on_lon -= 360;
        }
        {
            const qy = WasmQuatf32.unit().rotate_y(this.center_on_lat * this.vp.deg2rad);
            const qz = WasmQuatf32.unit().rotate_z(this.center_on_lon * this.vp.deg2rad);
            this.q = qy.mul(qz);
        }
        {
            const qy = WasmQuatf32.unit().rotate_y(-this.vp.lat * this.vp.deg2rad);
            const qz = WasmQuatf32.unit().rotate_z(this.vp.lon * this.vp.deg2rad);
            this.triangle_q_ll = qz.mul(qy);
        }
    }
    latlon_of_cxy(cxy) {
        this.derive_data();
        const dx = ((cxy[0] / this.width) * 2 - 1.0) / this.view_scale;
        const dy = (1.0 - (cxy[1] / this.height) * 2) / this.view_scale;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 0.98) {
            return null;
        }
        const d = Math.sqrt(d2);
        const dz = Math.sqrt(1 - d2);
        const yaw = Math.atan2(d, dz);
        const roll = Math.atan2(dy, dx);
        const v = new WasmVec3f32(Math.cos(yaw), Math.sin(yaw) * Math.cos(roll), Math.sin(yaw) * Math.sin(roll));
        const world = this.q.conjugate().apply3(v);
        // const world = this.q.apply3(v);
        const lat = this.rad2deg * Math.asin(world.array[2]);
        const lon = this.rad2deg * Math.atan2(world.array[1], world.array[0]);
        return [lat, lon];
    }
    v_of_p(xyz_vec) {
        let xyz = xyz_vec.array;
        xyz[2] += 4;
        // if (xyz[2] < 0.1) {
        // return null;
        // }
        const x = (xyz[0] / xyz[2] + 0.5) * this.width;
        const y = (xyz[1] / xyz[2] + 0.5) * this.height;
        return [x, y];
    }
    draw() {
        this.derive_data();
        if (!this.texture_loaded) {
            return;
        }
        if (this.webgl !== null) {
            this.webgl_draw();
            return;
        }
        const f0 = 0;
        const f1 = this.icos.num_faces;
        for (var f = f0; f < f1; f++) {
            const vertices = this.icos.subdiv_face(f);
            const p_t0 = this.icos.subdiv_vertex(vertices[0]);
            const p_t1 = this.icos.subdiv_vertex(vertices[1]);
            const p_t2 = this.icos.subdiv_vertex(vertices[2]);
            const p0 = this.q.apply3(p_t0.position);
            const p1 = this.q.apply3(p_t1.position);
            const p2 = this.q.apply3(p_t2.position);
            const n = p1.sub(p0).cross_product(p2.sub(p0));
            if (n.array[2] < 0) {
                continue;
            }
            const v0 = this.v_of_p(p0);
            const v1 = this.v_of_p(p1);
            const v2 = this.v_of_p(p2);
            if (v0 == null || v1 == null || v2 == null) {
                continue;
            }
            const t0 = p_t0.texture;
            const t1 = p_t1.texture;
            const t2 = p_t2.texture;
            this.draw_triangle(v0, t0, v1, t1, v2, t2);
        }
    }
    // Draw a triangle in this context with three canvas coorinates an
    // three corresponding texture coordinates (0 to 1)
    //
    // Set the clip path to that of the canvas coordinates
    //
    // Set a transformation that is translate by v0 of (matrix M * N)
    //
    // Draw image at nominal -t0
    //
    // where N = rotate+skew ( (t1-t0) to X, (t2-t0) to Y )
    //
    // and M = rotate+skew ( X to (v1-v0), Y to (v2-v0) )
    //
    // Hence nominal coordinate (0,0) is texture t0; this maps through
    // M*N to 0, and hence to v0
    //
    // Nominal coordinate t1-t0 is texture t1; this maps through
    // M*N to X to (v1-v0), and hence to v1
    //
    // Nominal coordinate t2-t0 is texture t2; this maps through
    // M*N to Y to (v2-v0), and hence to v21
    draw_triangle(v0, t0, v1, t1, v2, t2) {
        const ctx = this.ctx;
        const tw = this.texture_image.width;
        const th = this.texture_image.height;
        ctx.save();
        if (true) {
            ctx.beginPath();
            ctx.moveTo(v0[0], v0[1]);
            ctx.lineTo(v1[0], v1[1]);
            ctx.lineTo(v2[0], v2[1]);
            ctx.lineTo(v0[0], v0[1]);
            ctx.clip();
        }
        // Want to map t0 to v0, t1 to v1, t2 to v2
        //
        // Use a transform that maps (t1-t0) to (v1-v0)
        // and (t2-t0) to (v2-v0), and then adds v0
        //
        // Then draw the texture at -t0
        const tex0 = t0.array;
        const tex1 = t1.array;
        const tex2 = t2.array;
        const dt10 = [
            (tex1[0] - tex0[0]) * tw,
            (tex1[1] - tex0[1]) * th,
        ];
        const dt20 = [
            (tex2[0] - tex0[0]) * tw,
            (tex2[1] - tex0[1]) * th,
        ];
        const dv10 = [v1[0] - v0[0], v1[1] - v0[1]];
        const dv20 = [v2[0] - v0[0], v2[1] - v0[1]];
        const inv_det = dt10[0] * dt20[1] - dt10[1] * dt20[0];
        const inv = [
            dt20[1] / inv_det,
            -dt20[0] / inv_det,
            -dt10[1] / inv_det,
            dt10[0] / inv_det,
        ];
        const mat = [
            dv10[0] * inv[0] + dv20[0] * inv[2],
            dv10[0] * inv[1] + dv20[0] * inv[3],
            dv10[1] * inv[0] + dv20[1] * inv[2],
            dv10[1] * inv[1] + dv20[1] * inv[3],
        ];
        // console.log(mat[0] * dt20[0] + mat[1] * dt20[1],
        // mat[2] * dt20[0] + mat[3] * dt20[1],
        // );
        ctx.setTransform(mat[0], mat[2], mat[1], mat[3], v0[0], v0[1]);
        ctx.drawImage(this.texture_image, -tex0[0] * tw, -tex0[1] * th);
        ctx.restore();
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
        this.center_on_lat -= dcy;
        this.center_on_lon -= dcx;
        this.draw();
    }
    user_release(_start_xy, cxy) {
        const lat_lon = this.latlon_of_cxy(cxy);
        if (lat_lon == null) {
            return;
        }
        this.star_catalog.update_latlon(lat_lon[0], lat_lon[1]);
    }
    user_zoom(_cxy, factor) {
        if (factor < 1.0) {
            this.center_on_lon -= 1.0 / factor;
        }
        else {
            this.center_on_lon += factor;
        }
        this.draw();
    }
}
