import { WasmVec3f64, WasmStar } from "../pkg/star_catalog_wasm.js";
import { Application } from "./application.js";

import { Webgl, WebglObjKind } from "./web_gl.js";

export class StarField implements WebglObjKind {
  application: Application;
  stars: Uint32Array;
  num_stars: number = 0;
  stars_buf: WebGLBuffer | null = null;
  constructor(application: Application) {
    this.stars = new Uint32Array(0);
    this.application = application;
    this.create();
  }

  create() {
    const catalog = this.application.catalog;
    this.num_stars = catalog.count;
    this.stars = new Uint32Array(this.num_stars * 3);
    const vec = new WasmVec3f64(0, 0, 0);
    let star = catalog.star(0)!;
    const vxyz = this.application.wasm_memory.float_array_of_vec3f64(vec);
    for (let i = 0; i < this.num_stars; i++) {
      catalog.set_star(star, i)!;
      star.set_vector(vec);
      this.stars.set(this.encode_star(vxyz, star), i * 3);
    }
  }

  encode_star(vxyz: Float64Array, star: WasmStar): [number, number, number] {
    const magnitude = star.magnitude;
    const abs_x = Math.abs(vxyz[0]!);
    const x_neg = vxyz[0]! < 0;
    const abs_y = Math.abs(vxyz[1]!);
    const y_neg = vxyz[1]! < 0;
    const abs_z = Math.abs(vxyz[2]!);
    const z_neg = vxyz[2]! < 0;

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
    // Bound the magnitude to 0 to 12 and provide it to
    const m = Math.min(Math.max(Math.round(magnitude * 4), 0), 63);
    v |= m << 24;
    const ra =
      Math.round((star.right_ascension * 16384.0) / 6.283185307179586 + 8192) &
      16383;
    const de =
      Math.round((star.declination * 4096) / 3.141592653589793 + 2048) & 4095;
    // If we assign x=(temperature - 2300k) / 7700k and clamp it to 0-0.9999
    //
    // color is a class with temperature of:
    //
    //   2300k-3900k x:0.1 => 4bit 1 => (255,185,113);
    //   3900k-5300k x:0.3 => 4bit 5 => (255,221,186);
    //   5300k-6000k x:0.45 => 4bit 7 => (255,239,228),
    //   6000k-7300k x:0.58 => 4bit 9 => (250,246,255);
    //   7300k-10000k x: 0.82 => 4 bit 12 => (215,225,255);
    //   10000k+ x:0.99 => 4 bit 15 => (171,193,255)
    //
    // A polynomial fitting 4bit to red has a reasonable polynomial of red = 5.8x + 256x^2 (clamp to 255)
    // A polynomial fitting 4bit to green has a reasonable polynomial of green = 18x + 167x^2 (clamp to 255)
    // A polynomial fitting 4bit to blue has a reasonable polynomial of blue = 111 + 16x
    //
    const color = Math.max(
      Math.min(Math.floor(((star.temperature - 2300) / 7700) * 15.9), 15),
      0,
    );
    const map = (ra << 0) | (de << 14) | (color << 26);
    return [u, v, map];
  }

  webgl_create(webgl: WebGLRenderingContext) {
    this.stars_buf = webgl.createBuffer();
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.stars_buf);
    webgl.bufferData(webgl.ARRAY_BUFFER, this.stars.buffer, webgl.STATIC_DRAW);
    console.log("Created!", this.stars_buf, this.stars);
  }

  webgl_draw(webgl: WebGLRenderingContext): void {
    webgl.bindBuffer(webgl.ARRAY_BUFFER, this.stars_buf);
    webgl.enableVertexAttribArray(0);
    (webgl as any).vertexAttribIPointer(0, 3, webgl.INT, false, 0, 0);

    webgl.drawArrays(webgl.POINTS, 0, this.num_stars);
  }
  webgl_set_uniforms(_wgl: Webgl): void {}
}
