import {
  WasmVec3f32,
  WasmVec3f64,
  WasmQuatf64,
} from "../pkg/star_catalog_wasm.js";
import { Draw } from "../javascript/draw.js";
import { Mouse } from "../javascript/mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "../javascript/log.js";

//a FindOrientation
class FindOrientation {
  //cp constructor
  constructor(catalog, vectors, max_magnitude, max_angle_delta) {
    this.catalog = catalog;
    this.candidates = [];
    this.vectors = [];

    for (const v of vectors) {
      this.vectors.push(v.normalize());
    }
    this.max_magnitude = max_magnitude;
    this.max_angle_delta = max_angle_delta;
  }

  //mp find_results
  find_results(q_err) {
    const rad2deg = 180 / Math.PI;
    const q = q_err[0];
    const err = q_err[1];
    const c = q_err[2];
    const candidate = this.candidates[c];
    let result = "";
    result += `Quality: ${err}  ${c}<br>`;
    result += "Stars:<br> ";
    for (let i = 0; i < this.vectors.length; i++) {
      const star = this.catalog.star(this.catalog.find("" + candidate[i + 1]));
      const angle =
        (Math.acos(q.apply3(this.vectors[i]).dot(star.vector)) * 180) / Math.PI;
      result += `${star.id}: mag ${star.magnitude.toFixed(2)} @ ( ${(star.right_ascension * rad2deg).toFixed(2)}, ${(star.declination * rad2deg).toFixed(2)}) ${angle.toFixed(2)}<br>`;
      const d = 1.0 - q.apply3(this.vectors[i]).dot(star.vector);
      console.log(d, q.apply3(this.vectors[i]).array, star.vector.array);
    }
    result += "<p>";
    return result;
  }

  //mp find_best_candidate
  find_best_candidate() {
    let best_err = 100000;
    let best_q = null;
    let best_c = null;
    for (const i in this.candidates) {
      const err_q = this.candidate_quality(i);
      if (err_q[0] < best_err) {
        best_err = err_q[0];
        best_q = err_q[1];
        best_c = i;
        console.log(i, best_q, best_err);
      }
    }
    if (best_q === null) {
      return null;
    }
    return [best_q, best_err, best_c];
  }

  //mp candidate_quality
  candidate_quality(c) {
    if (c >= this.candidates.length) {
      return null;
    }
    const candidate = this.candidates[c];
    const nvectors = this.vectors.length;
    const stars = [];
    for (let i = 0; i < nvectors; i++) {
      stars.push(this.catalog.star(this.catalog.find("" + candidate[i + 1])));
    }
    let qs = [];
    for (let i = 0; i < nvectors; i++) {
      for (let j = i + 1; j < nvectors; j++) {
        qs.push(
          WasmQuatf64.mapping_vector_pair_to_vector_pair(
            this.vectors[i],
            this.vectors[j],
            stars[i].vector,
            stars[j].vector,
          ),
        );
      }
    }
    while (qs.length > 1) {
      const merged_qs = [];
      for (let i = 0; i < qs.length; i += 4) {
        if (i + 1 >= qs.length) {
          merged_qs.push(qs[i]);
        } else if (i + 2 >= nvectors) {
          merged_qs.push(WasmQuatf64.average(qs[i], qs[i + 1]));
        } else if (i + 3 >= nvectors) {
          merged_qs.push(WasmQuatf64.average(qs[i], qs[i + 1], qs[i + 2]));
        } else {
          merged_qs.push(
            WasmQuatf64.average(qs[i], qs[i + 1], qs[i + 2], qs[i + 3]),
          );
        }
      }
      qs = merged_qs;
    }
    const q_avg = qs[0];
    let total_dsq = 0;
    for (let i = 0; i < nvectors; i++) {
      const cos = q_avg.apply3(this.vectors[i]).dot(stars[i].vector);
      total_dsq += Math.acos(cos);
    }
    return [total_dsq, q_avg];
  }

  //mp find_triangles
  find_triangles(i0, i1, i2) {
    const vectors = this.vectors;
    this.catalog.clear_filter();
    this.catalog.filter_max_magnitude(this.max_magnitude);

    const a12 = Math.acos(vectors[i1].dot(vectors[i2]));
    const a20 = Math.acos(vectors[i2].dot(vectors[i0]));
    const a01 = Math.acos(vectors[i0].dot(vectors[i1]));

    return this.catalog.find_star_triangles(
      this.max_angle_delta,
      a12,
      a20,
      a01,
      10000,
    );
  }

  //mp add_initial_triangles
  add_initial_triangles() {
    const vectors = this.vectors;
    const nvectors = this.vectors.length;
    const candidates = this.find_triangles(0, 1, 2);
    let n = candidates.length;
    for (let i = 0; i < n; i += 3) {
      const s0 = this.catalog.star(candidates[i + 0]);
      const s1 = this.catalog.star(candidates[i + 1]);
      const s2 = this.catalog.star(candidates[i + 2]);
      const q01 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[0],
        vectors[1],
        s0.vector,
        s1.vector,
      );
      const q12 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[1],
        vectors[2],
        s1.vector,
        s2.vector,
      );
      const q20 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[2],
        vectors[0],
        s2.vector,
        s0.vector,
      );
      let d1 = q01.distance_sq(q12);
      let d2 = q12.distance_sq(q20);
      let d3 = q20.distance_sq(q01);

      let d_sum = d1 + d2 + d3;
      if (d_sum > 0.01) {
        continue;
      }
      const q_avg = WasmQuatf64.average(q01, q12, q20);
      const c = [q_avg, s0.id, s1.id, s2.id];
      for (let j = 0; j < nvectors - 3; j++) {
        c.push(null);
      }
      this.candidates.push(c);
    }
  }

  //mp add_further_triangle
  add_further_triangle(i0, i1, i2) {
    const vectors = this.vectors;
    const candidates = this.find_triangles(i0, i1, i2);

    const allowed_candidates = [];
    let n = candidates.length;
    for (let i = 0; i < n; i += 3) {
      const s0 = this.catalog.star(candidates[i + 0]);
      const s1 = this.catalog.star(candidates[i + 1]);
      const s2 = this.catalog.star(candidates[i + 2]);
      const q01 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[i0],
        vectors[i1],
        s0.vector,
        s1.vector,
      );
      const q12 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[i1],
        vectors[i2],
        s1.vector,
        s2.vector,
      );
      const q20 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
        vectors[i2],
        vectors[i0],
        s2.vector,
        s0.vector,
      );
      let d1 = q01.distance_sq(q12);
      let d2 = q12.distance_sq(q20);
      let d3 = q20.distance_sq(q01);

      let d_sum = d1 + d2 + d3;
      if (d_sum > 0.01) {
        continue;
      }
      const q_avg = WasmQuatf64.average(q01, q12, q20);
      allowed_candidates.push([q_avg, s0.id, s1.id, s2.id]);
    }

    const merged_candidates = [];
    for (const c of this.candidates) {
      for (const ac of allowed_candidates) {
        let d = c[0].distance_sq(ac[0]);
        if (d > 0.01) {
          continue;
        }
        if (c[i0 + 1] !== null && c[i0 + 1] !== ac[1]) {
          continue;
        }
        if (c[i1 + 1] !== null && c[i1 + 1] !== ac[2]) {
          continue;
        }
        if (c[i2 + 1] !== null && c[i2 + 1] !== ac[3]) {
          continue;
        }
        const rc = c.slice();
        rc[i0 + 1] = ac[1];
        rc[i1 + 1] = ac[2];
        rc[i2 + 1] = ac[3];
        merged_candidates.push(rc);
      }
    }
    this.candidates = merged_candidates;
  }
}
//a FindCanvas
//c FindCanvas
export class FindCanvas {
  //fp constructor
  constructor(star_catalog, catalog, canvas_div_id, width, height) {
    this.star_catalog = star_catalog;
    this.catalog = catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "find");

    this.div = document.getElementById(canvas_div_id);
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.zoomed_window = new ZoomedWindow([this.width, this.height]);

    this.img = null;
    this.img_w = 0;
    this.img_h = 0;

    this.max_magnitude = 3.5;
    this.max_angle_delta = 1.0;
    this.mm_equiv = 35.0;

    const get_image = document.querySelector("#find_get_image");
    get_image.addEventListener("change", this.get_image.bind(this));

    const best_matches = document.querySelector("#find_best_matches");
    best_matches.addEventListener("click", this.best_matches.bind(this));

    const clear_selection = document.querySelector("#find_clear_selection");
    clear_selection.addEventListener("click", this.clear_selection.bind(this));

    const find_max_magnitude = document.querySelector("#find_max_magnitude");
    find_max_magnitude.addEventListener(
      "input",
      this.set_parameters.bind(this),
    );
    find_max_magnitude.value = this.max_magnitude;

    const find_max_angle = document.querySelector("#find_max_angle");
    find_max_angle.addEventListener("input", this.set_parameters.bind(this));
    find_max_angle.value = this.max_angle_delta;

    const find_fovh = document.querySelector("#find_fovh");
    find_fovh.addEventListener("input", this.set_parameters.bind(this));
    find_fovh.value = this.mm_equiv;

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

  //mi image_loaded - invoked when image/photo data has been set into the image
  image_loaded(event) {
    const ctx = this.canvas.getContext("2d");
    this.img_w = this.img.naturalWidth;
    this.img_h = this.img.naturalHeight;
    this.img_cx = this.img_w / 2;
    this.img_cy = this.img_h / 2;
    this.zoomed_window.set_img(this.img_w, this.img_h);
    this.redraw_canvas();
  }

  //mi data_fetched - invoked when image/photo data arrives
  data_fetched(event) {
    this.img = new Image();
    this.img.src = event.target.result;
    this.img.addEventListener("load", this.image_loaded.bind(this));
  }

  //mi get_image - invoked when file/photo is selected
  get_image(e) {
    const myFile = e.srcElement.files[0];
    const reader = new FileReader();
    reader.addEventListener("load", this.data_fetched.bind(this));
    reader.readAsDataURL(myFile);
  }

  //mi clear_selection
  clear_selection(e) {
    this.selected_stars = [];
    this.redraw_canvas();
  }

  //mi set_parameters
  set_parameters(e) {
    const m = document.getElementById("find_max_magnitude");
    if (m) {
      this.max_magnitude = m.value;
      document.getElementById("find_mm").innerText =
        `Max magnitude ${this.max_magnitude}`;
    }
    const a = document.getElementById("find_max_angle");
    if (a) {
      this.max_angle_delta = a.value;
      document.getElementById("find_ma").innerText =
        `Max angle ${this.max_angle_delta}`;
    }
    const f = document.getElementById("find_fovh");
    if (f) {
      this.mm_equiv = f.value / 1;
      const deg_fov = (Math.atan(18 / this.mm_equiv) * 2 * 180) / Math.PI;
      document.getElementById("find_fh").innerText =
        `${this.mm_equiv.toFixed(1)}mm (35mm eq) FOVH ${deg_fov.toFixed(1)}`;
    }
  }

  //mi best_matches
  best_matches(e) {
    if (this.selected_stars.length < 3) {
      return;
    }
    const max_angle_delta = (this.max_angle_delta / 180) * Math.PI;
    const max_magnitude = this.max_magnitude;

    const star_vectors = [];
    for (const ixy of this.selected_stars) {
      star_vectors.push(this.vector_of_img_xy(ixy));
    }

    const find_orientation = new FindOrientation(
      this.catalog,
      star_vectors,
      max_magnitude,
      max_angle_delta,
    );
    find_orientation.add_initial_triangles();

    switch (this.selected_stars.length) {
      case 3: {
        break;
      }
      case 4: {
        find_orientation.add_further_triangle(0, 1, 3);
        break;
      }
      case 5: {
        find_orientation.add_further_triangle(0, 3, 4);
        break;
      }
      case 6: {
        find_orientation.add_further_triangle(3, 4, 5, 4);
        break;
      }
      default: {
        for (let i = this.selected_stars.length - 2; i >= 2; i -= 2) {
          find_orientation.add_further_triangle(i - 1, i, i + 1);
        }
        break;
      }
    }

    const q_err = find_orientation.find_best_candidate();
    const find_results = document.querySelector("#find_results");
    if (!q_err) {
      find_results.innerHTML =
        "Failed to find any matches - try adjusting the parameters";
    } else {
      find_results.innerHTML = find_orientation.find_results(q_err);
      this.star_catalog.sky_view_set_orientation(
        q_err[0].rotate_y(-Math.PI / 2).rotate_x(Math.PI / 2),
      );
    }
  }

  //mi vector_of_img_xy
  vector_of_img_xy(ixy) {
    const px_per_mm_div_x_lens_to_sensor_mm = this.img_w / (36 / this.mm_equiv);
    const dx = ixy[0] - this.img_w / 2;
    const dy = ixy[1] - this.img_h / 2;
    const roll = Math.atan2(dy, dx);
    const sensor_yaw = Math.atan2(
      Math.sqrt(dx * dx + dy * dy),
      px_per_mm_div_x_lens_to_sensor_mm,
    );
    const world_yaw =
      (1 - 0.031) * sensor_yaw +
      0.3444 * sensor_yaw * sensor_yaw * sensor_yaw +
      0.2144 * sensor_yaw * sensor_yaw * sensor_yaw * sensor_yaw * sensor_yaw;
    // const world_yaw = sensor_yaw;
    const world_dir = new WasmVec3f64(
      Math.cos(roll) * Math.tan(sensor_yaw),
      Math.sin(roll) * Math.tan(sensor_yaw),
      1.0,
    );
    world_dir.set_normalized();
    return world_dir;
  }

  //mi img_xy_of_vector
  /// Assuming it is a unit vector with z into the page
  img_xy_of_vector(vector) {
    const xyz = vector.array;
    const roll = Math.atan2(xyz[1], xyz[0]);
    const world_yaw = Math.acos(xyz[2]);
    const sensor_yaw =
      (1 + 0.03212) * world_yaw +
      -0.393289 * world_yaw * world_yaw * world_yaw +
      0.2281345 * world_yaw * world_yaw * world_yaw * world_yaw * world_yaw;
    // const sensor_yaw = world_yaw;
    const iy =
      Math.sin(sensor_yaw) * Math.sin(roll) * this.img_w + this.img_h / 2;
    const ix =
      Math.sin(sensor_yaw) * Math.cos(roll) * this.img_w + this.img_w / 2;
    return [ix, iy];
  }

  //mp update
  update() {
    this.redraw_canvas();
  }

  //mp redraw_canvas
  redraw_canvas() {
    const style = this.star_catalog.styling.clock;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    if (this.img != null) {
      const ib = this.zoomed_window.get_zoomed_img_bounds();
      ctx.drawImage(this.img, ib[0], ib[1], ib[2], ib[3], 0, 0, w, h);
    }

    const stars = this.star_catalog.sky_canvas.star_cache.get();
    for (const star of stars.stars) {
      if (!this.star_vector) {
        this.star_vector = new WasmVec3f64();
      }
      star.set_vector(this.star_vector);
      this.star_vector.set_apply_q3(this.vp.ecef_to_view_q);
      const v = this.star_vector.array;
      // star_vector now is in the observer with Z up, Y left, X +1 straight ahead
      const ixy = [
        this.img_w / 2 - ((v[1] / v[0]) * this.img_w * this.mm_equiv) / 36,
        this.img_h / 2 - ((v[2] / v[0]) * this.img_w * this.mm_equiv) / 36,
      ];
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

  drag_start(_start_xy, xy) {}
  // drag_to(_start_xy, _old_xy, new_xy) {}
  drag_end(_start_xy, _xy) {}

  user_press(_xy, _actions) {}
  user_press_move(_start_xy, _xy) {}
  user_press_cancel(_start_xy) {}
  user_release(_start_xy, xy) {}
  user_zoom(cxy, factor) {}
  user_pan(_xy, dxy) {}
  user_rotate(_xy, _angle) {}

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
    this.zoomed_window.zoom_scr_by(
      old_xy[0] - new_xy[0],
      old_xy[1] - new_xy[1],
    );
    this.redraw_canvas();
  }

  user_release(_start_xy, xy) {
    this.selected_stars.push(this.zoomed_window.img_xy_of_scr_xy(xy));
    this.redraw_canvas();
  }
}
