import { WasmVec3f64 } from "../pkg/star_catalog_wasm.js";
export class StarField {
    constructor(application) {
        this.num_stars = 0;
        this.stars_buf = null;
        this.stars = new Uint32Array(0);
        this.application = application;
        this.create();
    }
    create() {
        const catalog = this.application.catalog;
        this.num_stars = catalog.count;
        this.stars = new Uint32Array(this.num_stars * 2);
        const vec = new WasmVec3f64(0, 0, 0);
        let star = catalog.star(0);
        const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);
        for (let i = 0; i < this.num_stars; i++) {
            catalog.set_star(star, i);
            star.set_vector(vec);
            this.stars.set(this.encode_star(vxyz, star.magnitude, star.temperature), i * 2);
        }
    }
    encode_star(vxyz, magnitude, _temperature) {
        const abs_x = Math.abs(vxyz[0]);
        const x_neg = vxyz[0] < 0;
        const abs_y = Math.abs(vxyz[1]);
        const y_neg = vxyz[1] < 0;
        const abs_z = Math.abs(vxyz[2]);
        const z_neg = vxyz[2] < 0;
        const x_is_u = abs_x >= abs_y || abs_x >= abs_z;
        const z_is_v = abs_z > abs_x || abs_z >= abs_y;
        const u_abs = x_is_u ? abs_x : abs_y;
        const v_abs = z_is_v ? abs_z : abs_y;
        const u_neg = x_is_u ? x_neg : y_neg;
        const v_neg = z_is_v ? z_neg : y_neg;
        const w_neg = x_is_u ? (z_is_v ? y_neg : z_neg) : x_neg;
        let u = Math.round(u_abs * 0x1000000);
        let v = Math.round(v_abs * 0x1000000);
        if (u >= 0xffffff) {
            u = 0xffffff;
        }
        if (v >= 0xffffff) {
            v = 0xffffff;
        }
        if (u_neg) {
            u |= 0x01000000;
        }
        if (v_neg) {
            u |= 0x02000000;
        }
        if (w_neg) {
            u |= 0x04000000;
        }
        if (x_is_u) {
            u |= 0x08000000;
        }
        if (z_is_v) {
            u |= 0x10000000;
        }
        // The shader uses m/4 as the point size; mag 0-3 are all about the same size, maybe m/4=4, and above that (up to mag 8) it should drop to m/4=1
        //
        // So 0-3 => 4*4; 3-8 => 4*( 4 - (m-3)*3/5); 8+=> 4
        let m = Math.round(3 * (4 - (magnitude - 3) * 0.6));
        if (m > 16) {
            m = 16;
        }
        if (m < 0) {
            m = 0;
        }
        v |= m << 24;
        return [u, v];
    }
    webgl_create(webgl) {
        this.stars_buf = webgl.createBuffer();
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.stars_buf);
        webgl.bufferData(webgl.ARRAY_BUFFER, this.stars.buffer, webgl.STATIC_DRAW);
        console.log("Created!", this.stars_buf, this.stars);
    }
    webgl_draw(webgl) {
        webgl.bindBuffer(webgl.ARRAY_BUFFER, this.stars_buf);
        webgl.enableVertexAttribArray(0);
        webgl.vertexAttribIPointer(0, 2, webgl.INT, false, 0, 0);
        webgl.drawArrays(webgl.POINTS, 0, this.num_stars);
    }
    webgl_set_uniforms(_wgl) { }
}
