import {
  WasmMat4f32,
  WasmBezierBuilder3f32,
} from "../pkg/star_catalog_wasm.js";
import {
  Webgl,
  Webgl3DObj,
  WebglUniform,
  WebglCubicBezierObj,
} from "./web_gl.js";

import { Planet } from "./planet.js";

export class SolarSystem {
  mat: WasmMat4f32;
  sun_color: [number, number, number, number] = [1, 1, 1, 1];
  sun_scale: number = 0.005;
  planet_scale: number = 0.002;
  distance_scale: number = 1 / 3e9;
  objects: Planet[];

  constructor() {
    this.mat = WasmMat4f32.identity();
    this.objects = [];
    this.objects.push(new Planet("Mercury"));
    this.objects.push(new Planet("Venus"));
    this.objects.push(new Planet("Earth"));
    this.objects.push(new Planet("Mars"));
    this.objects.push(new Planet("Jupiter"));
    this.objects.push(new Planet("Saturn"));
    this.objects.push(new Planet("Uranus"));
    this.objects.push(new Planet("Neptune"));
  }

  set_time(secs_since_epoch: number) {
    const builder = new WasmBezierBuilder3f32();
    for (const o of this.objects) {
      o.set_time(secs_since_epoch, builder);
    }
  }

  draw_sun(webgl: Webgl, icosphere: Webgl3DObj) {
    webgl.set_color(this.sun_color);
    this.mat.set_identity();
    this.mat.set_scale3(this.sun_scale);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, false);
    webgl.draw(icosphere);
  }

  draw_planets(webgl: Webgl, icosphere: Webgl3DObj) {
    for (const p of this.objects) {
      p.draw_planet(webgl, icosphere, this.distance_scale);
    }
  }

  draw_orbits(webgl: Webgl, bezier: WebglCubicBezierObj) {
    for (const p of this.objects) {
      p.draw_orbit(webgl, bezier, this.distance_scale);
    }
  }
}
