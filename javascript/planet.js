import { WasmOrbit, WasmVec3f32, WasmMat4f32, WasmBezier3f32, } from "../pkg/star_catalog_wasm.js";
import { WebglTexture, WebglUniform, } from "./web_gl.js";
export class Planet {
    constructor(name, image_filename) {
        this.planet_scale = 0.002;
        this.planet_color = [1, 1, 1, 1];
        this.texture = null;
        this.orbit = WasmOrbit.of_solar_system(name);
        this.orbit_bezier = new WasmBezier3f32();
        this.orbit_to_parent = this.orbit.orbit_to_parent();
        this.vec = new WasmVec3f32(0, 0, 0);
        this.mat = WasmMat4f32.identity();
        this.image_filename = image_filename;
    }
    webgl_init(webgl) {
        this.texture = new WebglTexture(webgl, new Image());
        this.texture.image.src = this.image_filename;
    }
    set_time(secs_since_epoch, builder) {
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
    draw_orbit(webgl, bezier, distance_scale) {
        this.orbit_to_parent.set_mat4_rotation(this.mat);
        this.mat.set_scale3(distance_scale);
        webgl.set_color(this.planet_color);
        webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);
        bezier.set_bezier(this.orbit_bezier);
        webgl.draw(bezier);
    }
    draw_planet(webgl, icosphere, distance_scale) {
        this.orbit_bezier.set_vec_point_at(this.vec, 1 / 3.0);
        this.orbit_to_parent.set_vec_apply(this.vec);
        this.vec.set_mulf(distance_scale);
        this.mat.set_identity();
        this.mat.set_scale3(this.planet_scale);
        this.mat.set_translate_by_vec3(this.vec);
        webgl.set_color(this.planet_color);
        if (this.texture !== null) {
            webgl.set_texture(this.texture);
        }
        webgl.set_uniform_mat4(WebglUniform.Model, this.mat.array, true);
        webgl.draw(icosphere);
    }
}
