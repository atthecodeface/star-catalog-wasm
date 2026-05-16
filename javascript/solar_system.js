import { WasmMat4f32, WasmBezierBuilder3f32, } from "../pkg/star_catalog_wasm.js";
import { WebglTexture, WebglUniform, } from "./web_gl.js";
import { Planet } from "./planet.js";
export class SolarSystem {
    constructor() {
        this.sun_color = [1, 1, 1, 1];
        this.sun_scale = 0.005;
        this.planet_scale = 0.002;
        this.distance_scale = 1 / 3e9;
        this.texture = null;
        this.image_filename = "images/solarSphere304A.0200.jpg";
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
    earth_texture() {
        return this.planets[2].texture;
    }
    set_time(secs_since_epoch) {
        const builder = new WasmBezierBuilder3f32();
        for (const o of this.planets) {
            o.set_time(secs_since_epoch, builder);
        }
    }
    webgl_init(webgl) {
        for (const p of this.planets) {
            p.webgl_init(webgl);
        }
        this.texture = new WebglTexture(webgl, new Image());
        this.texture.image.src = this.image_filename;
    }
    draw_sun(webgl, icosphere) {
        webgl.set_color(this.sun_color);
        this.mat.set_identity();
        this.mat.set_scale3(this.sun_scale);
        webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, false);
        if (this.texture !== null) {
            webgl.set_texture(this.texture);
        }
        webgl.draw(icosphere);
    }
    draw_planets(webgl, icosphere) {
        for (const p of this.planets) {
            p.draw_planet(webgl, icosphere, this.distance_scale);
        }
    }
    draw_orbits(webgl, bezier) {
        for (const p of this.planets) {
            p.draw_orbit(webgl, bezier, this.distance_scale);
        }
    }
}
