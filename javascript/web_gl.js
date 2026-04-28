import { Logger } from "./log.js";
export class WebglObj {
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
export class WebGlProgram {
    constructor(webgl, program) {
        this.u_projection = null;
        this.u_view = null;
        this.u_model = null;
        this.u_color = null;
        this.u_sampler = null;
        this.matrix = new Float32Array(16);
        this.program = program;
        this.u_projection = webgl.getUniformLocation(program, "projection");
        this.u_view = webgl.getUniformLocation(program, "view");
        this.u_model = webgl.getUniformLocation(program, "model");
        this.u_color = webgl.getUniformLocation(program, "color");
        this.u_sampler = webgl.getUniformLocation(program, "uSampler");
        this.webgl = webgl;
    }
    set_projection(matrix) {
        if (this.u_projection != null) {
            this.matrix.set(matrix.array);
            this.webgl.uniformMatrix4fv(this.u_projection, false, this.matrix);
        }
    }
    set_view(matrix) {
        if (this.u_view != null) {
            this.matrix.set(matrix.array);
            this.webgl.uniformMatrix4fv(this.u_view, false, this.matrix);
        }
    }
    set_model(matrix) {
        if (this.u_model != null) {
            this.matrix.set(matrix.array);
            this.webgl.uniformMatrix4fv(this.u_model, false, this.matrix);
        }
    }
    set_color(color) {
        if (this.u_color !== null) {
            this.webgl.uniform4fv(this.u_color, color);
        }
    }
    set_texture(texture) {
        this.webgl.activeTexture(this.webgl.TEXTURE0);
        this.webgl.bindTexture(this.webgl.TEXTURE_2D, texture.texture);
        this.webgl.uniform1i(this.u_sampler, 0);
    }
}
export class WebGlTexture {
    constructor(webgl) {
        const texture = webgl.createTexture();
        webgl.bindTexture(webgl.TEXTURE_2D, texture);
        webgl.bindTexture(webgl.TEXTURE_2D, texture);
        webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, 1, 1, 0, webgl.RGBA, webgl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.LINEAR);
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
        webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
        this.webgl = webgl;
        this.texture = texture;
    }
    bind_to_image(source) {
        const webgl = this.webgl;
        webgl.bindTexture(webgl.TEXTURE_2D, this.texture);
        webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, webgl.RGBA, webgl.UNSIGNED_BYTE, source);
    }
}
export class WebGl {
    constructor(log, canvas_div_id, width, height) {
        this.programs = [];
        this.webgl = null;
        this.logger = new Logger(log, "webgl");
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }
    /** Start WebGL - invoke this when the window has loaded
     *
     */
    start_webgl() {
        var gl;
        try {
            gl = this.canvas.getContext("webgl");
        }
        catch (x) {
            this.logger.error("webgl", `Failed to get WebGL context`);
            return "Failed to get context";
        }
        this.webgl = gl;
        if (this.webgl === null) {
            return "WebGL context was none";
        }
        return null;
    }
    /** Load a shader
     *
     */
    load_shader(vertex, src) {
        const webgl = this.webgl;
        let kind = webgl.VERTEX_SHADER;
        if (!vertex) {
            kind = webgl.FRAGMENT_SHADER;
        }
        const shader = webgl.createShader(kind);
        if (shader == null) {
            this.logger.error("Failed to create shader");
            return null;
        }
        webgl.shaderSource(shader, src);
        webgl.compileShader(shader);
        if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
            this.logger.error(`Failed to compile shader ${webgl.getShaderInfoLog(shader)}`);
            return null;
        }
        return shader;
    }
    compile_program(vertex_src, fragment_src) {
        if (this.webgl === null) {
            return null;
        }
        const webgl = this.webgl;
        const program = webgl.createProgram();
        const vs = this.load_shader(true, vertex_src);
        if (vs == null) {
            this.logger.error("webgl", `Failed to compile vertex shader`);
            return null;
        }
        webgl.attachShader(program, vs);
        webgl.deleteShader(vs);
        const fs = this.load_shader(false, fragment_src);
        if (fs == null) {
            this.logger.error("webgl", `Failed to compile fragment shader`);
            return null;
        }
        webgl.attachShader(program, fs);
        webgl.deleteShader(fs);
        webgl.linkProgram(program);
        webgl.useProgram(program);
        if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
            this.logger.error("webgl", `Failed to load shaders ${webgl.getProgramInfoLog(program)}`);
            return null;
        }
        const n = this.programs.length;
        this.programs.push(new WebGlProgram(webgl, program));
        return n;
    }
    use_program(p) {
        if (this.webgl === null) {
            return;
        }
        this.webgl.useProgram(this.programs[p].program);
        this.webgl.enable(this.webgl.DEPTH_TEST); // Enable depth testing
        this.webgl.depthFunc(this.webgl.LEQUAL); // Near things obscure far things
        this.webgl.clear(this.webgl.COLOR_BUFFER_BIT | this.webgl.DEPTH_BUFFER_BIT);
    }
}
