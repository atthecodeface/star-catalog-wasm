import { WasmVec3f64, WasmQuatf64, WasmPolynomial, } from "../pkg/star_catalog_wasm.js";
import { Draw } from "./draw.js";
import { Mouse } from "./mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "./log.js";
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
/**
 * Candidate for one triangle in finding an orientation
 */
class Candidate {
    constructor(nvectors, q, v_i0, v_i1, v_i2, s0, s1, s2) {
        this.q = q;
        this.stars = new Array(nvectors);
        this.stars[v_i0] = s0;
        this.stars[v_i1] = s1;
        this.stars[v_i2] = s2;
    }
    /** Create a new candidate mapping vectors[v_i0] to star catalog star s_index0
     *
     * @param catalog
     * @param vectors
     * @param v_i0
     * @param v_i1
     * @param v_i2
     * @param s_index0
     * @param s_index1
     * @param s_index2
     * @returns
     */
    static mapping_vectors_to_stars(vectors, v_i0, v_i1, v_i2, s0, s1, s2) {
        const q01 = WasmQuatf64.mapping_vector_pair_to_vector_pair(vectors[v_i0], vectors[v_i1], s0.vector, s1.vector);
        const q12 = WasmQuatf64.mapping_vector_pair_to_vector_pair(vectors[v_i1], vectors[v_i2], s1.vector, s2.vector);
        const q20 = WasmQuatf64.mapping_vector_pair_to_vector_pair(vectors[v_i2], vectors[v_i0], s2.vector, s0.vector);
        const d1 = q01.distance_sq(q12);
        const d2 = q12.distance_sq(q20);
        const d3 = q20.distance_sq(q01);
        let d_sum = d1 + d2 + d3;
        if (d_sum > 0.01) {
            return null;
        }
        const q_avg = WasmQuatf64.average(q01, q12, q20);
        console.log("Creating candidate d_sum", d_sum, " q_avg", q_avg.i, q_avg.j, q_avg.k, q_avg.r);
        return new Candidate(vectors.length, q_avg, v_i0, v_i1, v_i2, s0, s1, s2);
    }
    maybe_merge(other_c, max_dsq) {
        let d = this.q.distance_sq(other_c.q);
        if (d > max_dsq) {
            return;
        }
        for (let i = 0; i < this.stars.length; i++) {
            if (this.stars[i] !== undefined && other_c.stars[i] !== undefined) {
                if (this.stars[i].id != other_c.stars[i].id) {
                    return;
                }
            }
        }
        for (let i = 0; i < this.stars.length; i++) {
            if (this.stars[i] === undefined && other_c.stars[i] !== undefined) {
                this.stars[i] = other_c.stars[i];
            }
        }
    }
    quality(vectors) {
        let qs = [];
        for (let v_i0 = 0; v_i0 < this.stars.length; v_i0++) {
            const s0 = this.stars[v_i0];
            if (s0 === undefined) {
                return null;
                // continue;
            }
            for (let v_i1 = 0; v_i1 < this.stars.length; v_i1++) {
                if (v_i1 === v_i0) {
                    continue;
                }
                const s1 = this.stars[v_i1];
                if (s1 === undefined) {
                    continue;
                }
                qs.push(WasmQuatf64.mapping_vector_pair_to_vector_pair(vectors[v_i0], vectors[v_i1], s0.vector, s1.vector));
            }
        }
        while (qs.length > 1) {
            const merged_qs = [];
            for (let i = 0; i < qs.length; i += 4) {
                if (i + 1 >= qs.length) {
                    merged_qs.push(qs[i]);
                }
                else if (i + 2 >= qs.length) {
                    merged_qs.push(WasmQuatf64.average(qs[i], qs[i + 1]));
                }
                else if (i + 3 >= qs.length) {
                    merged_qs.push(WasmQuatf64.average(qs[i], qs[i + 1], qs[i + 2]));
                }
                else {
                    merged_qs.push(WasmQuatf64.average(qs[i], qs[i + 1], qs[i + 2], qs[i + 3]));
                }
            }
            qs = merged_qs;
        }
        const q_avg = qs[0];
        let total_dsq = 0;
        for (let v_i = 0; v_i < this.stars.length; v_i++) {
            const s = this.stars[v_i];
            if (s === undefined) {
                continue;
            }
            const cos = q_avg.apply3(vectors[v_i]).dot(s.vector);
            total_dsq += Math.acos(cos);
        }
        return [total_dsq, q_avg];
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
        this.candidates = [];
    }
    find_best_star_mappings() {
        console.log("find_best_star_mappings()");
        this.catalog.clear_filter();
        this.catalog.filter_max_magnitude(this.max_magnitude);
        return this.catalog.find_best_star_mappings(this.vectors, (this.max_angle_delta * 3.14159) / 180);
    }
    /**
     * Find in the catalog candidate mappings (array of 3n catalog star indices) for a triangle of
     * identified-star-vectors given by their indices
     *
     * @param {number} vector_i0 Index into this.vectors for first identified-star-vector
     * @param {number} vector_i1 Index into this.vectors for second identified-star-vector
     * @param {number} vector_i2 Index into this.vectors for third identified-star-vector
     */
    find_triangles(vector_i0, vector_i1, vector_i2) {
        const vectors = this.vectors;
        this.catalog.clear_filter();
        this.catalog.filter_max_magnitude(this.max_magnitude);
        const deg2rad = Math.PI / 180;
        const a12 = Math.acos(vectors[vector_i1].dot(vectors[vector_i2]));
        const a20 = Math.acos(vectors[vector_i2].dot(vectors[vector_i0]));
        const a01 = Math.acos(vectors[vector_i0].dot(vectors[vector_i1]));
        const rad2deg = 180.0 / 3.14159265;
        console.log("find triangles with angles", this.max_angle_delta, a01 * rad2deg, a12 * rad2deg, a20 * rad2deg);
        return this.catalog.find_star_triangles(this.max_angle_delta * deg2rad, a12, a20, a01, 
        // max_triangles is unused at present
        10000);
    }
    find_results(q, err, candidate_index) {
        const rad2deg = 180 / Math.PI;
        const candidate = this.candidates[candidate_index];
        let result = "";
        result += `Quality: ${err}  ${candidate_index}<br>`;
        result += "Stars:<br> ";
        for (let i = 0; i < this.vectors.length; i++) {
            const star = candidate.stars[i];
            if (star === undefined) {
                continue;
            }
            const angle = (Math.acos(q.apply3(this.vectors[i]).dot(star.vector)) * 180) /
                Math.PI;
            result += `${star.id}: mag ${star.magnitude.toFixed(2)} @ ( ${(star.right_ascension * rad2deg).toFixed(2)}, ${(star.declination * rad2deg).toFixed(2)}) ${angle.toFixed(2)}<br>`;
            // const d = 1.0 - q.apply3(this.vectors[i]).dot(star.vector);
            // console.log(d, q.apply3(this.vectors[i]).array, star.vector.array);
        }
        result += "<p>";
        return result;
    }
    find_best_candidate() {
        let best_err = 100000;
        let best_q = null;
        let best_c = null;
        for (let i = 0; i < this.candidates.length; i++) {
            const c = this.candidates[i];
            const err_q = c.quality(this.vectors);
            if (err_q === null) {
                continue;
            }
            console.log("fbc:", c.stars[0], c.stars[1], c.stars[2], c.stars[3], err_q[0], err_q[1].array);
            if (err_q[0] < best_err) {
                best_err = err_q[0];
                best_q = err_q[1];
                best_c = i;
            }
        }
        if (best_q === null) {
            return null;
        }
        return [best_q, best_err, best_c];
    }
    /**
     * Find and add candidate mappings for the first three identified-star-vectors given by their indices
     *
     */
    add_initial_triangles() {
        const triangles_found = this.find_triangles(0, 1, 2);
        console.log(triangles_found);
        const allowed_candidates = [];
        let n = triangles_found.length;
        for (let i = 0; i < n; i += 3) {
            const c = Candidate.mapping_vectors_to_stars(this.vectors, 0, 1, 2, this.catalog.star(triangles_found[i + 0]), this.catalog.star(triangles_found[i + 1]), this.catalog.star(triangles_found[i + 2]));
            if (c !== null) {
                allowed_candidates.push(c);
            }
        }
        this.candidates = allowed_candidates;
        console.log(this.candidates);
    }
    /**
     * Find and add candidate mappings for a triangle of three
     * identified-star-vectors given by their indices
     *
     * @param {number} vector_i0 Index into this.vectors for first identified-star-vector
     * @param {number} vector_i1 Index into this.vectors for second identified-star-vector
     * @param {number} vector_i2 Index into this.vectors for third identified-star-vector
     */
    add_further_triangle(vector_i0, vector_i1, vector_i2) {
        const triangles_found = this.find_triangles(vector_i0, vector_i1, vector_i2);
        console.log(triangles_found);
        const allowed_candidates = [];
        let n = triangles_found.length;
        for (let i = 0; i < n; i += 3) {
            const c = Candidate.mapping_vectors_to_stars(this.vectors, vector_i0, vector_i1, vector_i2, this.catalog.star(triangles_found[i + 0]), this.catalog.star(triangles_found[i + 1]), this.catalog.star(triangles_found[i + 2]));
            if (c !== null) {
                allowed_candidates.push(c);
            }
        }
        for (const c of this.candidates) {
            for (const ac of allowed_candidates) {
                c.maybe_merge(ac, 0.01);
            }
        }
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
        this.lens_mapping = new LensMappingRectilinear();
        this.lens_mapping = new LensMappingOrthographic();
        this.lens_mapping = new LensMappingEquidistant();
        this.lens_mapping = new LensMappingStereoGraphic();
        const lm = new LensMappingPolynomial();
        lm.approximate(8, (x) => Math.atan(x));
        this.lens_mapping = lm;
        this.lens_mapping = new LensMappingEquisolid();
        const get_image = document.querySelector("#find_get_image");
        get_image.addEventListener("change", this.get_image.bind(this));
        const best_matches = document.querySelector("#find_best_matches");
        best_matches.addEventListener("click", this.best_matches.bind(this));
        const clear_selection = document.querySelector("#find_clear_selection");
        clear_selection.addEventListener("click", this.clear_selection.bind(this));
        const find_max_angle = document.querySelector("#find_max_angle");
        find_max_angle.addEventListener("input", this.set_parameters.bind(this));
        find_max_angle.value = this.max_angle_delta.toString();
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
    test_img_5005() {
        this.vp.brightness = 3.6;
        this.max_angle_delta = 1.5;
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(24.31);
        //    this.vp.fovh = 74.7 * this.vp.deg2rad;
        this.selected_stars = [
            [1677.4173872350161, 1979.4762361019548],
            [1774.5592213798122, 1778.9920252073755],
            [2068.0515713491964, 1791.3931104173496],
            [2026.714620649283, 1489.633370307983],
        ];
        this.img_w = 5184;
        this.img_h = 3456;
        this.img_cx = this.img_w / 2;
        this.img_cy = this.img_h / 2;
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(-0.5213634481949257, 0.3314587738455383, -0.2503160769281036, -0.7454241059681618);
    }
    test_img_4924() {
        this.vp.brightness = 5.0;
        this.max_angle_delta = 0.5;
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(82);
        this.selected_stars = [
            [1080, 1278.72], // 67301
            [3214.08, 1736.64], // 62956
            [4311.36, 3248.64], // 58001
            [2473.346228239845, 1203.2495164410057], // 65378
            [4184.634429400387, 2306.228239845261], // 59774
            [3135.409722778692, 1534.0050032141362],
            [3258.4039286232983, 3029.461980940876],
            [2129.345460257321, 828.5614073759784],
            /*
             */
        ];
        /*
        ];
        */
        this.img_w = 5184;
        this.img_h = 3456;
        this.img_cx = this.img_w / 2;
        this.img_cy = this.img_h / 2;
        // The 'find best' is a quaternion that maps image to ECEF
        //
        // The crosses are placed at ecef_to_view_q * star.vector
        // view_to_ecef_q
        // ijkr
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(0.463641308272434, // i
        -0.2982603805403334, // j
        0.831984844682261, // k
        0.06227921709839514);
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(0.07938171626516351, 0.6471673802906424, 0.5671660193751167, 0.503185484167348);
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(0.8423682738731703, -0.3180209253383709, -0.3343984084258816, 0.27830933628087184);
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(0.46210719995613386, -0.30248622147573956, 0.8311959196828219, 0.06381508182756979);
    }
    test_img_5362() {
        this.vp.brightness = 3.2;
        this.max_angle_delta = 0.5;
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(27.15); // 27,15 measured on photo on Apr 28 2026 on iphone 17
        this.selected_stars = [
            [975.3465426853106, 1499.0187564811429],
            [1234.689852832872, 1468.893018433699],
            [1365.6713226043678, 2170.6231944025917],
            [2819.186515471793, 1842.9496588425773],
        ];
        this.img_w = 4032;
        this.img_h = 3024;
        this.img_cx = this.img_w / 2;
        this.img_cy = this.img_h / 2;
        // The 'find best' is a quaternion that maps image to ECEF
        //
        // The crosses are placed at ecef_to_view_q * star.vector
        // view_to_ecef_q
        // ijkr
        window.star_catalog.vp.view_to_ecef_q = new WasmQuatf64(0.0431495295840751, -0.5034733698270468, 0.5860184618327926, 0.6334311693963323);
    }
    test() {
        this.lens_mapping = new LensMappingPolynomial();
        this.test_img_4924();
        this.vp.update_html_elements();
        this.zoomed_window.set_img(this.img_w, this.img_h);
        this.populate_html();
        this.vp.derive_data();
        console.log(this.vp.fovh, this.vp.tan_hfovh);
        console.log("Perfect-ish view q array", window.star_catalog.vp.view_to_ecef_q.array);
        this.set_parameters();
        this.update();
        const star_vectors = [];
        for (const ixy of this.selected_stars) {
            star_vectors.push(this.vector_of_img_xy(ixy));
        }
        const find_orientation = new FindOrientation(this.catalog, star_vectors, this.vp.brightness, this.max_angle_delta);
        const mappings = find_orientation.find_best_star_mappings();
        window.star_catalog.vp.view_to_ecef_q = mappings[0];
        window.star_catalog.set_view_needs_update();
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
