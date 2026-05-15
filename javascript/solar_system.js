import { WasmMat4f32, WasmBezierBuilder3f32, } from "../pkg/star_catalog_wasm.js";
import { WebglUniform, } from "./web_gl.js";
import { Planet } from "./planet.js";
export class SolarSystem {
    constructor() {
        this.sun_color = [1, 1, 1, 1];
        this.sun_scale = 0.005;
        this.planet_scale = 0.002;
        this.distance_scale = 1 / 3e9;
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
    set_time(secs_since_epoch) {
        const builder = new WasmBezierBuilder3f32();
        for (const o of this.objects) {
            o.set_time(secs_since_epoch, builder);
        }
    }
    draw_sun(webgl, icosphere) {
        webgl.set_color(this.sun_color);
        this.mat.set_identity();
        this.mat.set_scale3(this.sun_scale);
        webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, false);
        webgl.draw(icosphere);
    }
    draw_planets(webgl, icosphere) {
        for (const p of this.objects) {
            p.draw_planet(webgl, icosphere, this.distance_scale);
        }
    }
    draw_orbits(webgl, bezier) {
        for (const p of this.objects) {
            p.draw_orbit(webgl, bezier, this.distance_scale);
        }
    }
}
