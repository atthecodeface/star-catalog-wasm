import {
  WasmOrbit,
  WasmVec3f32,
  WasmQuatf32,
  WasmMat4f32,
  WasmBezier3f32,
  WasmBezierBuilder3f32,
} from "../pkg/star_catalog_wasm.js";

import {
  Webgl,
  Webgl3DObj,
  WebglUniform,
  WebglCubicBezierObj,
} from "./web_gl.js";

export class Planet {
  orbit: WasmOrbit;
  orbit_to_parent: WasmQuatf32;
  orbit_bezier: WasmBezier3f32;
  mat: WasmMat4f32;
  vec: WasmVec3f32;
  planet_scale: number = 0.002;
  planet_color: [number, number, number, number] = [1, 1, 1, 1];
  constructor(name: string) {
    this.orbit = WasmOrbit.of_solar_system(name)!;
    this.orbit_bezier = new WasmBezier3f32();
    this.orbit_to_parent = this.orbit.orbit_to_parent();
    this.vec = new WasmVec3f32(0, 0, 0);
    this.mat = WasmMat4f32.identity();
  }

  set_time(secs_since_epoch: number, builder: WasmBezierBuilder3f32) {
    this.orbit_to_parent = this.orbit.orbit_to_parent();
    const orbit_period = this.orbit.period_of_orbit();
    builder.clear();

    for (let t = 0; t <= 3; t++) {
      const time = secs_since_epoch + orbit_period * (t - 1) * 0.025;
      this.orbit.orbit_vec_of_unix_time(time, this.vec);
      builder.add_vec_pt_at(t / 3.0, this.vec);
    }
    this.orbit_bezier.reconstruct(builder);
  }

  draw_orbit(
    webgl: Webgl,
    bezier: WebglCubicBezierObj,
    distance_scale: number,
  ) {
    this.orbit_to_parent.set_mat4_rotation(this.mat);
    this.mat.set_scale3(distance_scale);
    webgl.set_color(this.planet_color);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);
    bezier.set_bezier(this.orbit_bezier);
    webgl.draw(bezier);
  }

  draw_planet(webgl: Webgl, icosphere: Webgl3DObj, distance_scale: number) {
    this.orbit_bezier.set_vec_point_at(this.vec, 1 / 3.0);
    this.orbit_to_parent.set_vec_apply(this.vec);
    this.vec.set_mulf(distance_scale);
    this.mat.set_identity();
    this.mat.set_scale3(this.planet_scale);
    this.mat.set_translate_by_vec3(this.vec);
    webgl.set_color(this.planet_color);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);

    webgl.draw(icosphere);
  }
}
