import { WasmVec3f64, WasmPolynomial, } from "../pkg/star_catalog_wasm.js";
import { Draw } from "./draw.js";
import { Mouse } from "./mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "./log.js";
import { HtmlElement } from "./html.js";
class LensMappingRectilinear {
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        const f = mm_equiv / 18.0;
        return Math.atan(sensor_r / f);
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        const f = mm_equiv / 18.0;
        return Math.tan(world_yaw) * f;
    }
}
class LensMappingStereoGraphic {
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        const f = mm_equiv / 18.0;
        return Math.atan(sensor_r / f / 2) * 2;
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        const f = mm_equiv / 18.0;
        return Math.tan(world_yaw / 2) * f * 2;
    }
}
class LensMappingEquisolid {
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        const f = mm_equiv / 18.0;
        return Math.asin(sensor_r / f / 2) * 2;
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        const f = mm_equiv / 18.0;
        return Math.sin(world_yaw / 2) * f * 2;
    }
}
class LensMappingEquidistant {
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        const f = mm_equiv / 18.0;
        return sensor_r / f;
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        const f = mm_equiv / 18.0;
        return f * world_yaw;
    }
}
class LensMappingOrthographic {
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        const f = mm_equiv / 18.0;
        return Math.asin(sensor_r / f);
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        const f = mm_equiv / 18.0;
        return Math.sin(world_yaw) * f;
    }
}
class LensMappingPolynomial {
    constructor() {
        this.sensor_to_world = new WasmPolynomial(new Float64Array([0, 1]));
        this.world_to_sensor = new WasmPolynomial(new Float64Array([0, 1]));
    }
    approximate(degree, sensor_to_world_fn) {
        const length = degree * 8;
        let xs = new Float64Array(length);
        let ys = new Float64Array(length);
        for (let i = 0; i < length; i++) {
            xs[i] = i / length;
            ys[i] = sensor_to_world_fn(i / length);
        }
        const okay = this.sensor_to_world.min_squares(degree, xs, ys) &&
            this.world_to_sensor.min_squares(degree, ys, xs);
        this.sensor_to_world.set(0, 0);
        this.world_to_sensor.set(0, 0);
        let dsq_error = 0.0;
        for (let i = 0; i < length; i++) {
            const v = i / length;
            const d = this.world_to_sensor.calc(this.sensor_to_world.calc(v)) - v;
            dsq_error += d * d;
        }
        console.log("dsq_error from stw to wts ", dsq_error);
        return okay;
    }
    map_sensor_r_to_world_yaw(mm_equiv, sensor_r) {
        return this.sensor_to_world.calc((sensor_r * 18.0) / mm_equiv);
    }
    map_world_yaw_to_sensor_r(mm_equiv, world_yaw) {
        return (this.world_to_sensor.calc(world_yaw) * mm_equiv) / 18.0;
    }
}
class FindOrientation {
    constructor(catalog, vectors, max_magnitude, max_angle_delta) {
        this.catalog = catalog;
        this.vectors = [];
        for (const v of vectors) {
            this.vectors.push(v.normalize());
        }
        this.max_magnitude = max_magnitude;
        this.max_angle_delta = max_angle_delta;
    }
    find_best_star_mappings() {
        console.log("find_best_star_mappings()");
        this.catalog.clear_filter();
        this.catalog.filter_max_magnitude(this.max_magnitude);
        return this.catalog.find_best_star_mappings(this.vectors, (this.max_angle_delta * 3.14159) / 180);
    }
}
export class FindCanvas {
    constructor(star_catalog, catalog, canvas_div_id) {
        this.img = null;
        this.img_w = 0;
        this.img_h = 0;
        this.img_cx = 0;
        this.img_cy = 0;
        this.max_angle_delta = 1.0;
        this.star_catalog = star_catalog;
        this.catalog = catalog;
        this.vp = this.star_catalog.vp;
        this.logger = new Logger(star_catalog.log, "find");
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        this.star_vector = new WasmVec3f64(0, 0, 0);
        this.current_wh = [10, 10];
        this.canvas.width = this.current_wh[0];
        this.canvas.height = this.current_wh[1];
        this.zoomed_window = new ZoomedWindow(this.current_wh);
        const lm = new LensMappingPolynomial();
        lm.approximate(8, (x) => Math.atan(x));
        this.lens_mapping = lm;
        this.lens_mapping = new LensMappingRectilinear();
        const get_image = document.querySelector("#find_get_image");
        get_image.addEventListener("change", this.get_image.bind(this));
        const best_matches = document.querySelector("#find_best_matches");
        best_matches.addEventListener("click", this.best_matches.bind(this));
        const clear_selection = document.querySelector("#find_clear_selection");
        clear_selection.addEventListener("click", this.clear_selection.bind(this));
        const find_max_angle = document.querySelector("#find_max_angle");
        find_max_angle.addEventListener("input", this.set_parameters.bind(this));
        find_max_angle.value = this.max_angle_delta.toString();
        const lens_mappings = document.getElementById("LensMappings");
        if (lens_mappings !== null) {
            const h = new HtmlElement(lens_mappings);
            const table = h.add_ele("table");
            const tr = table.add_ele("tr");
            {
                const e = tr.add_ele("td");
                e.add_input_radio("radio_lens_mappings", "Rectiliinear", true, this.set_lens_mapping.bind(this)).set_input_checked(true);
                e.add_label("Rectilinear").add_content("Rectilinear");
            }
            for (const x of [
                "Stereographic",
                "Equidistant",
                "Equisolid",
                "Orthographic",
            ]) {
                const e = tr.add_ele("td");
                e.add_input_radio("radio_lens_mappings", x, true, this.set_lens_mapping.bind(this));
                e.add_label(x).add_content(x);
            }
        }
        this.set_parameters();
        this.selected_stars = [];
        let mrk_contents = [
            ["push"],
            ["b"],
            ["c", 0, 0, 6.0],
            ["w", 1],
            ["S", "sun"],
            ["s"],
            ["pop"],
        ];
        this.marker = new Draw(mrk_contents);
        let cross_contents = [
            ["b"],
            ["m", -5, -5],
            ["L", 10, 10],
            ["m", -5, 5],
            ["L", 10, -10],
            ["w", 1],
            ["S", "sun"],
            ["s"],
        ];
        this.cross = new Draw(cross_contents);
        this.mouse = new Mouse(this, this.canvas);
        this.logger.info(`Created find canvas`);
    }
    image_loaded(_event) {
        // const ctx = this.canvas.getContext("2d");
        this.img_w = this.img.naturalWidth;
        this.img_h = this.img.naturalHeight;
        this.img_cx = this.img_w / 2;
        this.img_cy = this.img_h / 2;
        const img_ar = this.img_w / this.img_h;
        this.zoomed_window.set_img(this.img_w, this.img_h);
        this.canvas.height = this.canvas.width / img_ar;
        const scr_w = this.zoomed_window.get_scr_wh()[0];
        this.zoomed_window.scr_resize(scr_w, scr_w / img_ar);
        this.redraw_canvas();
    }
    data_fetched(event) {
        this.img = new Image();
        this.img.src = event.target.result;
        this.img.addEventListener("load", this.image_loaded.bind(this));
    }
    get_image(e) {
        const myFile = e.srcElement.files[0];
        const reader = new FileReader();
        reader.addEventListener("load", this.data_fetched.bind(this));
        reader.readAsDataURL(myFile);
    }
    clear_selection(_e) {
        this.selected_stars = [];
        this.redraw_canvas();
    }
    set_lens_mapping(_event, value) {
        switch (value) {
            case "Orthographic": {
                this.lens_mapping = new LensMappingOrthographic();
                break;
            }
            case "Equidistant": {
                this.lens_mapping = new LensMappingEquidistant();
                break;
            }
            case "Stereographic": {
                this.lens_mapping = new LensMappingStereoGraphic();
                break;
            }
            case "Equisolid": {
                this.lens_mapping = new LensMappingEquisolid();
                break;
            }
            default: {
                this.lens_mapping = new LensMappingRectilinear();
                break;
            }
        }
        this.star_catalog.set_view_needs_update();
    }
    populate_html() {
        const a = document.getElementById("find_max_angle");
        if (a instanceof HTMLInputElement) {
            a.value = this.max_angle_delta.toString();
        }
    }
    set_parameters() {
        const a = document.getElementById("find_max_angle");
        if (a instanceof HTMLInputElement) {
            this.max_angle_delta = Number.parseFloat(a.value);
            document.getElementById("find_ma").innerText =
                `Max angle ${this.max_angle_delta}`;
        }
    }
    best_matches() {
        if (this.selected_stars.length < 3) {
            return;
        }
        const star_vectors = [];
        for (const ixy of this.selected_stars) {
            star_vectors.push(this.vector_of_img_xy(ixy));
        }
        console.log(this.selected_stars);
        const find_orientation = new FindOrientation(this.catalog, star_vectors, this.vp.brightness, this.max_angle_delta);
        const mappings = find_orientation.find_best_star_mappings();
        /*
        find_orientation.find_best_star_mappings();
    
        const q_err = find_orientation.find_best_candidate();
        if (q_err === null) {
          console.log("No matches found");
          return;
        }
        console.log("Best candidate", q_err![0]!.array);
        const find_results = document.querySelector(
          "#find_results",
        )! as HTMLTableCellElement;
        if (q_err === null) {
          find_results.innerHTML =
            "Failed to find any matches - try adjusting the parameters";
        } else {
          find_results.innerHTML = find_orientation.find_results(
            q_err![0],
            q_err![1],
            q_err![2],
          );
          */
        this.star_catalog.sky_view_set_orientation(
        //        q_err![0].rotate_y(-Math.PI / 2).rotate_x(Math.PI / 2),
        mappings[0]);
    }
    vector_of_img_xy(ixy) {
        const rdx = ((ixy[0] - this.img_w / 2) / this.img_w) * 2;
        const rdy = ((ixy[1] - this.img_h / 2) / this.img_w) * 2;
        const sensor_rf = Math.sqrt(rdx * rdx + rdy * rdy);
        const roll = Math.atan2(rdy, rdx);
        //    const sensor_yaw = Math.atan(this.vp.tan_hfovh * sensor_rf);
        const world_yaw = this.lens_mapping.map_sensor_r_to_world_yaw(this.vp.mm_equiv, sensor_rf);
        //    const world_yaw = Math.atan((sensor_rf * 18.0) / this.vp.mm_equiv);
        // const world_yaw = sensor_yaw;
        //
        // viewer is right +x, up +y, out of screen +z
        const world_dir = new WasmVec3f64(Math.cos(world_yaw), -Math.cos(roll) * Math.sin(world_yaw), -Math.sin(roll) * Math.sin(world_yaw));
        world_dir.set_normalized();
        return world_dir;
    }
    img_xy_of_vector(vec) {
        const v = vec.array;
        const x = v[0];
        const y = -v[1];
        const z = -v[2];
        const r = Math.sqrt(y * y + z * z);
        const world_yaw = Math.atan2(r, x);
        const roll = Math.atan2(z, y);
        const img_r = this.lens_mapping.map_world_yaw_to_sensor_r(this.vp.mm_equiv, world_yaw);
        //const img_r = (Math.tan(world_yaw) / 18.0) * this.vp.mm_equiv; // / this.vp.tan_hfovh;
        const ix = (Math.cos(roll) * img_r * this.img_w) / 2 + this.img_w / 2;
        const iy = (Math.sin(roll) * img_r * this.img_w) / 2 + this.img_h / 2;
        return [ix, iy];
    }
    update() {
        const wh = this.vp.get_resizable_content_size();
        if (this.current_wh != wh) {
            this.canvas.width = wh[0];
            this.canvas.height = (wh[0] * this.img_h) / this.img_w;
            this.zoomed_window.scr_resize(wh[0], wh[1]);
            this.current_wh = wh;
        }
        this.redraw_canvas();
    }
    redraw_canvas() {
        const style = this.star_catalog.styling.clock;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.canvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        if (this.img !== null) {
            const ib = this.zoomed_window.get_zoomed_img_bounds();
            ctx.drawImage(this.img, ib[0], ib[1], ib[2], ib[3], 0, 0, w, h);
        }
        const v = new WasmVec3f64(0, 0, 0);
        const fa = new Float64Array(3);
        for (let degree = 1; degree < 90; degree += 1) {
            ctx.strokeStyle = "#353";
            if (degree % 5 == 0) {
                ctx.strokeStyle = "#474";
            }
            if (degree % 15 == 0) {
                ctx.strokeStyle = "#696";
            }
            ctx.beginPath();
            const d = (degree * 3.14159265) / 180;
            const cos_yaw = Math.cos(d);
            const sin_yaw = Math.sin(d);
            fa[0] = cos_yaw;
            for (let x = 0.0; x < 6.283; x += 0.02) {
                fa[1] = sin_yaw * Math.cos(x);
                fa[2] = sin_yaw * Math.sin(x);
                v.set(fa);
                const ixy = this.img_xy_of_vector(v);
                const sxy = this.zoomed_window.scr_xy_of_img_xy(ixy);
                ctx.lineTo(sxy[0], sxy[1]);
            }
            ctx.closePath();
            ctx.stroke();
        }
        const stars = this.star_catalog.sky_canvas.star_cache.get();
        for (const star of stars.stars) {
            star.set_vector(this.star_vector);
            this.star_vector.set_apply_q3(this.vp.ecef_to_view_q);
            const ixy = this.img_xy_of_vector(this.star_vector);
            const sxy = this.zoomed_window.scr_xy_of_img_xy(ixy);
            ctx.save();
            Draw.set_transform(ctx, [sxy[0], sxy[1]]);
            this.cross.draw(ctx, (x) => style[x]);
            ctx.restore();
        }
        for (const ixy of this.selected_stars) {
            ctx.save();
            const sxy = this.zoomed_window.scr_xy_of_img_xy(ixy);
            Draw.set_transform(ctx, [sxy[0], sxy[1]]);
            this.marker.draw(ctx, (x) => style[x]);
            ctx.restore();
        }
    }
    drag_start(_start_xy, _xy) { }
    drag_end(_start_xy, _xy) { }
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_rotate(_xy, _angle) { }
    user_pan(_xy, dxy) {
        this.zoomed_window.zoom_scr_by(dxy[0], dxy[1]);
        this.redraw_canvas();
    }
    user_zoom(cxy, factor) {
        const zoom = factor * this.zoomed_window.get_zoom();
        this.zoomed_window.zoom_set(zoom, cxy);
        this.zoomed_window.recalculate_zoom();
        this.redraw_canvas();
    }
    drag_to(_start_xy, old_xy, new_xy) {
        this.zoomed_window.zoom_scr_by(old_xy[0] - new_xy[0], old_xy[1] - new_xy[1]);
        this.redraw_canvas();
    }
    user_release(_start_xy, xy) {
        this.selected_stars.push(this.zoomed_window.img_xy_of_scr_xy(xy));
        this.redraw_canvas();
    }
}
