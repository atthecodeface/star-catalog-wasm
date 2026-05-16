import {
  WasmMat4f32,
  WasmBezierBuilder3f32,
} from "../pkg/star_catalog_wasm.js";
import {
  Webgl,
  WebglTexture,
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
  planets: Planet[];
  texture: WebglTexture | null = null;
  image_filename: string = "images/solarSphere304A.0200.jpg";

  constructor() {
    this.mat = WasmMat4f32.identity();
    this.planets = [];
    this.planets.push(new Planet("Mercury", "images/mercury.jpg"));
    this.planets.push(new Planet("Venus", "images/venus.jpg"));
    this.planets.push(new Planet("Earth", "images/Blue_Marble_2002_x10.jpg"));
    this.planets.push(new Planet("Mars", "images/mars.jpg"));
    this.planets.push(new Planet("Jupiter", "images/jupiter.jpg"));
    this.planets.push(new Planet("Saturn", "images/saturn.jpg"));
    this.planets.push(new Planet("Uranus", "images/neptune.jpg"));
    this.planets.push(new Planet("Neptune", "images/neptune.jpg"));
  }

  earth_texture(): WebglTexture | null {
    return this.planets[2]!.texture;
  }

  set_time(secs_since_epoch: number) {
    const builder = new WasmBezierBuilder3f32();
    for (const o of this.planets) {
      o.set_time(secs_since_epoch, builder);
    }
  }

  webgl_init(webgl: Webgl) {
    for (const p of this.planets) {
      p.webgl_init(webgl);
    }
    this.texture = new WebglTexture(webgl, new Image());
    this.texture.image!.src = this.image_filename;
  }

  draw_sun(webgl: Webgl, icosphere: Webgl3DObj) {
    webgl.set_color(this.sun_color);
    this.mat.set_identity();
    this.mat.set_scale3(this.sun_scale);
    webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, false);
    if (this.texture !== null) {
      webgl.set_texture(this.texture);
    }
    webgl.draw(icosphere);
  }

  draw_planets(webgl: Webgl, icosphere: Webgl3DObj) {
    for (const p of this.planets) {
      p.draw_planet(webgl, icosphere, this.distance_scale);
    }
  }

  draw_orbits(webgl: Webgl, bezier: WebglCubicBezierObj) {
    for (const p of this.planets) {
      p.draw_orbit(webgl, bezier, this.distance_scale);
    }
  }
}
