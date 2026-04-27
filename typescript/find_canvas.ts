import {
  WasmVec3f64,
  WasmQuatf64,
  WasmCatalog,
  WasmStar,
} from "../pkg/star_catalog_wasm.js";
import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { StarCatalog } from "./star_catalog.js";

/*

Alkaid 67301
   67301 : 206.88560879999997, 49.31330288 : 100.69652 :1.85
Mizar 65378
   65378 : 200.98091604, 54.92541525 : 78.15864 :2.23
Alioth 62956
   62956 : 193.5068041, 55.95984300999999 : 80.932014 :1.76
Megrez 59774
   59774 : 183.85603794999997, 57.03259792000001 : 81.43721 :3.32
Phecda 58001
   58001 : 178.45725536, 53.69473296 : 83.65119 :2.41

   67301 to 62956 is 10.462028363468304 degrees
   67301 to 58001 is 18.097067345576527 degrees
   62956 to 58001 is 8.94023727303248 degrees



54061 Dubhe
   54061 : 165.93265365000002, 61.75111888 : 123.63761 :1.81

*/
/**
 * Candidate for one triangle in finding an orientation
 */
class Candidate {
  /**
   * Orientation of the candidate
   */
  q: WasmQuatf64;
  /**
   * star_ids is the same lengh (guaranteed) as FindOrientation.vectors
   */
  stars: Array<WasmStar | undefined>;
  constructor(
    nvectors: number,
    q: WasmQuatf64,
    v_i0: number,
    v_i1: number,
    v_i2: number,
    s0: WasmStar,
    s1: WasmStar,
    s2: WasmStar,
  ) {
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
  static mapping_vectors_to_stars(
    vectors: WasmVec3f64[],
    v_i0: number,
    v_i1: number,
    v_i2: number,
    s0: WasmStar,
    s1: WasmStar,
    s2: WasmStar,
  ): Candidate | null {
    const q01 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
      vectors[v_i0]!,
      vectors[v_i1]!,
      s0.vector,
      s1.vector,
    );
    const q12 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
      vectors[v_i1]!,
      vectors[v_i2]!,
      s1.vector,
      s2.vector,
    );
    const q20 = WasmQuatf64.mapping_vector_pair_to_vector_pair(
      vectors[v_i2]!,
      vectors[v_i0]!,
      s2.vector,
      s0.vector,
    );
    const d1 = q01.distance_sq(q12);
    const d2 = q12.distance_sq(q20);
    const d3 = q20.distance_sq(q01);

    let d_sum = d1 + d2 + d3;
    if (d_sum > 0.01) {
      return null;
    }

    const q_avg = WasmQuatf64.average(q01, q12, q20);
    console.log(
      "Creating candidate d_sum",
      d_sum,
      " q_avg",
      q_avg.i,
      q_avg.j,
      q_avg.k,
      q_avg.r,
    );
    return new Candidate(vectors.length, q_avg, v_i0, v_i1, v_i2, s0, s1, s2);
  }

  maybe_merge(other_c: Candidate, max_dsq: number) {
    let d = this.q.distance_sq(other_c.q);
    if (d > max_dsq) {
      return;
    }
    for (let i = 0; i < this.stars.length; i++) {
      if (this.stars[i] !== undefined && other_c.stars[i] !== undefined) {
        if (this.stars[i]!.id != other_c.stars[i]!.id) {
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

  quality(vectors: WasmVec3f64[]): null | [number, WasmQuatf64] {
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
        qs.push(
          WasmQuatf64.mapping_vector_pair_to_vector_pair(
            vectors[v_i0]!,
            vectors[v_i1]!,
            s0.vector,
            s1.vector,
          ),
        );
      }
    }

    while (qs.length > 1) {
      const merged_qs = [];
      for (let i = 0; i < qs.length; i += 4) {
        if (i + 1 >= qs.length) {
          merged_qs.push(qs[i]);
        } else if (i + 2 >= qs.length) {
          merged_qs.push(WasmQuatf64.average(qs[i]!, qs[i + 1]!));
        } else if (i + 3 >= qs.length) {
          merged_qs.push(WasmQuatf64.average(qs[i]!, qs[i + 1]!, qs[i + 2]!));
        } else {
          merged_qs.push(
            WasmQuatf64.average(qs[i]!, qs[i + 1]!, qs[i + 2]!, qs[i + 3]!),
          );
        }
      }
      qs = merged_qs;
    }
    const q_avg = qs[0]!;

    let total_dsq = 0;
    for (let v_i = 0; v_i < this.stars.length; v_i++) {
      const s = this.stars[v_i];
      if (s === undefined) {
        continue;
      }
      const cos = q_avg.apply3(vectors[v_i]!).dot(s.vector);
      total_dsq += Math.acos(cos);
    }

    return [total_dsq, q_avg];
  }
}

class FindOrientation {
  /** The catalog to find stars in */
  catalog: WasmCatalog;

  /**
   * Normalized vectors in the direction of the user-identified 'stars'; subject
   * to an arbitrary quaternion rotation, of course. It is the relative
   * orientation between these that matters
   */
  vectors: WasmVec3f64[];

  /**
   * The max magnitude of stars in the catalog to consider for a match
   */
  max_magnitude: number;

  /**
   * The max angle delta in degrees between pairs of stars that counts as 'okay' for them
   * to match
   */
  max_angle_delta: number;

  /**
   * Candidates, one per triangle
   */
  candidates: Candidate[];

  constructor(
    catalog: WasmCatalog,
    vectors: WasmVec3f64[],
    max_magnitude: number,
    max_angle_delta: number,
  ) {
    this.catalog = catalog;
    this.vectors = [];

    for (const v of vectors) {
      this.vectors.push(v.normalize());
    }
    this.max_magnitude = max_magnitude;
    this.max_angle_delta = max_angle_delta;

    this.candidates = [];
  }

  /**
   * Find in the catalog candidate mappings (array of 3n catalog star indices) for a triangle of
   * identified-star-vectors given by their indices
   *
   * @param {number} vector_i0 Index into this.vectors for first identified-star-vector
   * @param {number} vector_i1 Index into this.vectors for second identified-star-vector
   * @param {number} vector_i2 Index into this.vectors for third identified-star-vector
   */
  private find_triangles(
    vector_i0: number,
    vector_i1: number,
    vector_i2: number,
  ): Uint32Array {
    const vectors = this.vectors;
    this.catalog.clear_filter();
    this.catalog.filter_max_magnitude(this.max_magnitude);

    const deg2rad = Math.PI / 180;

    const a12 = Math.acos(vectors[vector_i1]!.dot(vectors[vector_i2]!));
    const a20 = Math.acos(vectors[vector_i2]!.dot(vectors[vector_i0]!));
    const a01 = Math.acos(vectors[vector_i0]!.dot(vectors[vector_i1]!));

    //    console.log(
    //      "find triangles with angles",
    //      this.max_angle_delta,
    //      a01 * rad2deg,
    //      a12 * rad2deg,
    //      a20 * rad2deg,
    //    );
    return this.catalog.find_star_triangles(
      this.max_angle_delta * deg2rad,
      a12,
      a20,
      a01,
      // max_triangles is unused at present
      10000,
    );
  }

  find_results(q: WasmQuatf64, err: number, candidate_index: number) {
    const rad2deg = 180 / Math.PI;
    const candidate = this.candidates[candidate_index]!;
    let result = "";
    result += `Quality: ${err}  ${candidate_index}<br>`;
    result += "Stars:<br> ";

    for (let i = 0; i < this.vectors.length; i++) {
      const star = candidate.stars[i];
      if (star === undefined) {
        continue;
      }
      const angle =
        (Math.acos(q.apply3(this.vectors[i]!).dot(star.vector)) * 180) /
        Math.PI;
      result += `${star.id}: mag ${star.magnitude.toFixed(2)} @ ( ${(star.right_ascension * rad2deg).toFixed(2)}, ${(star.declination * rad2deg).toFixed(2)}) ${angle.toFixed(2)}<br>`;
      // const d = 1.0 - q.apply3(this.vectors[i]).dot(star.vector);
      // console.log(d, q.apply3(this.vectors[i]).array, star.vector.array);
    }
    result += "<p>";
    return result;
  }

  find_best_candidate(): null | [WasmQuatf64, number, number] {
    let best_err = 100000;
    let best_q: WasmQuatf64 | null = null;
    let best_c: number | null = null;
    for (let i = 0; i < this.candidates.length; i++) {
      const c = this.candidates[i]!;
      const err_q = c.quality(this.vectors);
      if (err_q === null) {
        continue;
      }
      console.log(
        "fbc:",
        c.stars[0],
        c.stars[1],
        c.stars[2],
        c.stars[3],
        err_q[0],
        err_q[1].array,
      );

      if ((err_q![0]! as number) < best_err) {
        best_err = err_q![0]! as number;
        best_q = err_q![1]! as WasmQuatf64;
        best_c = i;
      }
    }
    if (best_q === null) {
      return null;
    }
    return [best_q, best_err, best_c!];
  }

  /**
   * Find and add candidate mappings for the first three identified-star-vectors given by their indices
   *
   */
  add_initial_triangles() {
    const triangles_found = this.find_triangles(0, 1, 2);

    const allowed_candidates = [];
    let n = triangles_found.length;
    for (let i = 0; i < n; i += 3) {
      const c = Candidate.mapping_vectors_to_stars(
        this.vectors,
        0,
        1,
        2,
        this.catalog.star(triangles_found[i + 0]!)!,
        this.catalog.star(triangles_found[i + 1]!)!,
        this.catalog.star(triangles_found[i + 2]!)!,
      );
      if (c !== null) {
        allowed_candidates.push(c);
      }
    }
    this.candidates = allowed_candidates;
  }

  /**
   * Find and add candidate mappings for a triangle of three
   * identified-star-vectors given by their indices
   *
   * @param {number} vector_i0 Index into this.vectors for first identified-star-vector
   * @param {number} vector_i1 Index into this.vectors for second identified-star-vector
   * @param {number} vector_i2 Index into this.vectors for third identified-star-vector
   */
  add_further_triangle(
    vector_i0: number,
    vector_i1: number,
    vector_i2: number,
  ) {
    const triangles_found = this.find_triangles(
      vector_i0,
      vector_i1,
      vector_i2,
    );

    const allowed_candidates = [];
    let n = triangles_found.length;
    for (let i = 0; i < n; i += 3) {
      const c = Candidate.mapping_vectors_to_stars(
        this.vectors,
        vector_i0,
        vector_i1,
        vector_i2,
        this.catalog.star(triangles_found[i + 0]!)!,
        this.catalog.star(triangles_found[i + 1]!)!,
        this.catalog.star(triangles_found[i + 2]!)!,
      );
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
  star_catalog: StarCatalog;
  catalog: WasmCatalog;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;

  img: HTMLImageElement | null = null;
  img_w: number = 0;
  img_h: number = 0;
  img_cx: number = 0;
  img_cy: number = 0;

  max_magnitude: number = 3.5;
  max_angle_delta: number = 1.0;
  mm_equiv: number = 80.0;

  zoomed_window: ZoomedWindow;

  marker: Draw;
  cross: Draw;
  mouse: Mouse;

  star_vector: WasmVec3f64;
  selected_stars: [number, number][];

  constructor(
    star_catalog: StarCatalog,
    catalog: WasmCatalog,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.star_catalog = star_catalog;
    this.catalog = catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "find");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.star_vector = new WasmVec3f64(0, 0, 0);
    this.width = width;
    this.height = height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.zoomed_window = new ZoomedWindow([this.width, this.height]);

    const get_image = document.querySelector("#find_get_image")!;
    get_image.addEventListener("change", this.get_image.bind(this));

    const best_matches = document.querySelector("#find_best_matches")!;
    best_matches.addEventListener("click", this.best_matches.bind(this));

    const clear_selection = document.querySelector("#find_clear_selection")!;
    clear_selection.addEventListener("click", this.clear_selection.bind(this));

    const find_max_magnitude = document.querySelector(
      "#find_max_magnitude",
    )! as HTMLInputElement;
    find_max_magnitude.addEventListener(
      "input",
      this.set_parameters.bind(this),
    );
    find_max_magnitude.value = this.max_magnitude.toString();

    const find_max_angle = document.querySelector(
      "#find_max_angle",
    )! as HTMLInputElement;
    find_max_angle.addEventListener("input", this.set_parameters.bind(this));
    find_max_angle.value = this.max_angle_delta.toString();

    const find_fovh = document.querySelector("#find_fovh")! as HTMLInputElement;
    find_fovh.addEventListener("input", this.set_parameters.bind(this));
    find_fovh.value = this.mm_equiv.toString();

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

  image_loaded(_event: Event): void {
    // const ctx = this.canvas.getContext("2d");
    this.img_w = this.img!.naturalWidth;
    this.img_h = this.img!.naturalHeight;
    this.img_cx = this.img_w / 2;
    this.img_cy = this.img_h / 2;
    this.zoomed_window.set_img(this.img_w, this.img_h);
    this.redraw_canvas();
  }

  data_fetched(event: Event) {
    this.img = new Image();
    this.img.src = (event.target! as any).result;
    this.img.addEventListener("load", this.image_loaded.bind(this));
  }

  get_image(e: any) {
    const myFile = e.srcElement.files[0];
    const reader = new FileReader();
    reader.addEventListener("load", this.data_fetched.bind(this));
    reader.readAsDataURL(myFile);
  }

  clear_selection(_e: Event) {
    this.selected_stars = [];
    this.redraw_canvas();
  }

  populate_html() {
    const m = document.getElementById("find_max_magnitude");
    if (m instanceof HTMLInputElement) {
      m.value = this.max_magnitude.toString();
    }
    const a = document.getElementById("find_max_angle");
    if (a instanceof HTMLInputElement) {
      a.value = this.max_angle_delta.toString();
    }
    const f = document.getElementById("find_fovh");
    if (f instanceof HTMLInputElement) {
      f.value = this.mm_equiv.toString();
    }
  }
  set_parameters() {
    const m = document.getElementById("find_max_magnitude");
    if (m instanceof HTMLInputElement) {
      this.max_magnitude = Number.parseFloat(m.value);
      document.getElementById("find_mm")!.innerText =
        `Max magnitude ${this.max_magnitude}`;
    }
    const a = document.getElementById("find_max_angle");
    if (a instanceof HTMLInputElement) {
      this.max_angle_delta = Number.parseFloat(a.value);
      document.getElementById("find_ma")!.innerText =
        `Max angle ${this.max_angle_delta}`;
    }
    const f = document.getElementById("find_fovh");
    if (f instanceof HTMLInputElement) {
      this.mm_equiv = Number.parseFloat(f.value) / 1;
      const deg_fov = (Math.atan(18 / this.mm_equiv) * 2 * 180) / Math.PI;
      document.getElementById("find_fh")!.innerText =
        `${this.mm_equiv.toFixed(1)}mm (35mm eq) FOVH ${deg_fov.toFixed(1)}`;
    }
  }

  test_img_5005() {
    this.max_magnitude = 3.6;
    this.max_angle_delta = 1.5;
    this.mm_equiv = 23.5;
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
    (window as any).star_catalog.vp.view_to_ecef_q = new WasmQuatf64(
      -0.5213634481949257,
      0.3314587738455383,
      -0.2503160769281036,
      -0.7454241059681618,
    );
  }

  test_img_4924() {
    this.max_magnitude = 3.0;
    this.max_angle_delta = 0.5;
    this.mm_equiv = 82;
    this.selected_stars = [
      [1080, 1278.72],
      [3214.08, 1736.64],
      [4311.36, 3248.64],
    ];
    this.img_w = 5184;
    this.img_h = 3456;
    this.img_cx = this.img_w / 2;
    this.img_cy = this.img_h / 2;

    // The 'find best' is a quaternion that maps image to ECEF
    //
    // The crosses are placed at ecef_to_view_q * star.vector
    // view_to_ecef_q
    // ijkr
    (window as any).star_catalog.vp.view_to_ecef_q = new WasmQuatf64(
      0.463641308272434,
      -0.2982603805403334,
      0.831984844682261,
      0.06227921709839514,
    );
  }
  test() {
    this.test_img_5005();
    this.zoomed_window.set_img(this.img_w, this.img_h);

    this.populate_html();

    console.log(
      "Perfect-ish view q array",
      (window as any).star_catalog.vp.view_to_ecef_q.array,
    );

    this.set_parameters();
    this.update();

    const star_vectors = [];
    for (const ixy of this.selected_stars) {
      star_vectors.push(this.vector_of_img_xy(ixy));
    }

    const find_orientation = new FindOrientation(
      this.catalog,
      star_vectors,
      this.max_magnitude,
      this.max_angle_delta,
    );
    find_orientation.add_initial_triangles();
    if (star_vectors.length > 3) {
      const n = star_vectors.length;
      find_orientation.add_further_triangle(n - 3, n - 2, n - 1);
    }
    const q_err = find_orientation.find_best_candidate()!;
    console.log(q_err[0].array, q_err[1], q_err[2]);

    (window as any).star_catalog.set_view_needs_update();
  }

  best_matches() {
    if (this.selected_stars.length < 3) {
      return;
    }
    const star_vectors = [];
    for (const ixy of this.selected_stars) {
      star_vectors.push(this.vector_of_img_xy(ixy));
    }

    const find_orientation = new FindOrientation(
      this.catalog,
      star_vectors,
      this.max_magnitude,
      this.max_angle_delta,
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
        find_orientation.add_further_triangle(3, 4, 5);
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
      this.star_catalog.sky_view_set_orientation(
        //        q_err![0].rotate_y(-Math.PI / 2).rotate_x(Math.PI / 2),
        q_err![0],
      );
    }
  }

  //mi vector_of_img_xy
  vector_of_img_xy(ixy: [number, number]): WasmVec3f64 {
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
    let _x = world_yaw;
    _x = _x;
    // const world_yaw = sensor_yaw;
    //
    // viewer is right +x, up +y, out of screen +z
    const world_dir = new WasmVec3f64(
      1.0,
      -Math.cos(roll) * Math.tan(sensor_yaw),
      -Math.sin(roll) * Math.tan(sensor_yaw),
    );
    world_dir.set_normalized();
    return world_dir;
  }

  //mi img_xy_of_vector
  /// Assuming it is a unit vector with z into the page
  //
  // THIS IS NOT USED
  img_xy_of_vector(vector: WasmVec3f64): [number, number] {
    const xyz = vector.array;
    const roll = Math.atan2(xyz[1]!, xyz[0]!);
    const world_yaw = Math.acos(xyz[2]!);
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

  update() {
    this.redraw_canvas();
  }

  redraw_canvas() {
    const style = this.star_catalog.styling.clock;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    if (this.img !== null) {
      const ib = this.zoomed_window.get_zoomed_img_bounds();
      ctx.drawImage(this.img, ib[0], ib[1], ib[2], ib[3], 0, 0, w, h);
    }

    const stars = this.star_catalog.sky_canvas.star_cache.get();
    for (const star of stars.stars) {
      star.set_vector(this.star_vector);
      this.star_vector.set_apply_q3(this.vp.ecef_to_view_q);
      const v = this.star_vector.array;
      // star_vector now is in the observer with Z up, Y left, X +1 straight ahead
      const ixy: [number, number] = [
        this.img_w / 2 - ((v[1]! / v[0]!) * this.img_w * this.mm_equiv) / 36,
        this.img_h / 2 - ((v[2]! / v[0]!) * this.img_w * this.mm_equiv) / 36,
      ];
      const sxy = this.zoomed_window.scr_xy_of_img_xy(ixy);
      ctx.save();
      Draw.set_transform(ctx, [sxy[0], sxy[1]]);
      this.cross.draw(ctx, (x) => (style as any)[x]);
      ctx.restore();
    }

    for (const ixy of this.selected_stars) {
      ctx.save();
      const sxy = this.zoomed_window.scr_xy_of_img_xy(ixy);
      Draw.set_transform(ctx, [sxy[0], sxy[1]]);
      this.marker.draw(ctx, (x) => (style as any)[x]);
      ctx.restore();
    }
  }

  drag_start(_start_xy: [number, number], _xy: [number, number]): void {}
  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  user_pan(_xy: [number, number], dxy: [number, number]): void {
    this.zoomed_window.zoom_scr_by(dxy[0], dxy[1]);
    this.redraw_canvas();
  }

  user_zoom(cxy: [number, number], factor: number): void {
    const zoom = factor * this.zoomed_window.get_zoom();
    this.zoomed_window.zoom_set(zoom, cxy);
    this.zoomed_window.recalculate_zoom();
    this.redraw_canvas();
  }

  drag_to(
    _start_xy: [number, number],
    old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    this.zoomed_window.zoom_scr_by(
      old_xy[0] - new_xy[0],
      old_xy[1] - new_xy[1],
    );
    this.redraw_canvas();
  }

  user_release(_start_xy: [number, number], xy: [number, number]): void {
    this.selected_stars.push(this.zoomed_window.img_xy_of_scr_xy(xy));
    this.redraw_canvas();
  }
}
