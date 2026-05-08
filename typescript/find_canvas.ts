import {
  WasmVec3f64,
  WasmQuatf64,
  WasmCatalog,
  WasmStar,
  WasmPolynomial,
} from "../pkg/star_catalog_wasm.js";
import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { StarCatalog } from "./star_catalog.js";
import { HtmlElement } from "./html.js";

interface LensMapping {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number;
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number;
}

class LensMappingRectilinear {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    const f = mm_equiv / 18.0;
    return Math.atan(sensor_r / f);
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    const f = mm_equiv / 18.0;
    return Math.tan(world_yaw) * f;
  }
}

class LensMappingStereoGraphic {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    const f = mm_equiv / 18.0;
    return Math.atan(sensor_r / f / 2) * 2;
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    const f = mm_equiv / 18.0;
    return Math.tan(world_yaw / 2) * f * 2;
  }
}

class LensMappingEquisolid {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    const f = mm_equiv / 18.0;
    return Math.asin(sensor_r / f / 2) * 2;
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    const f = mm_equiv / 18.0;
    return Math.sin(world_yaw / 2) * f * 2;
  }
}

class LensMappingEquidistant {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    const f = mm_equiv / 18.0;
    return sensor_r / f;
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    const f = mm_equiv / 18.0;
    return f * world_yaw;
  }
}

class LensMappingOrthographic {
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    const f = mm_equiv / 18.0;
    return Math.asin(sensor_r / f);
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    const f = mm_equiv / 18.0;
    return Math.sin(world_yaw) * f;
  }
}

class LensMappingPolynomial {
  sensor_to_world: WasmPolynomial;
  world_to_sensor: WasmPolynomial;
  constructor() {
    this.sensor_to_world = new WasmPolynomial(new Float64Array([0, 1]));
    this.world_to_sensor = new WasmPolynomial(new Float64Array([0, 1]));
  }
  approximate(
    degree: number,
    sensor_to_world_fn: (sensor: number) => number,
  ): boolean {
    const length = degree * 8;
    let xs = new Float64Array(length);
    let ys = new Float64Array(length);
    for (let i = 0; i < length; i++) {
      xs[i] = i / length;
      ys[i] = sensor_to_world_fn(i / length);
    }
    const okay =
      this.sensor_to_world.min_squares(degree, xs, ys) &&
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
  map_sensor_r_to_world_yaw(mm_equiv: number, sensor_r: number): number {
    return this.sensor_to_world.calc((sensor_r * 18.0) / mm_equiv);
  }
  map_world_yaw_to_sensor_r(mm_equiv: number, world_yaw: number): number {
    return (this.world_to_sensor.calc(world_yaw) * mm_equiv) / 18.0;
  }
}

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

  find_best_star_mappings(): WasmQuatf64[] {
    console.log("find_best_star_mappings()");
    this.catalog.clear_filter();
    this.catalog.filter_max_magnitude(this.max_magnitude);
    return this.catalog.find_best_star_mappings(
      this.vectors,
      (this.max_angle_delta * 3.14159) / 180,
    );
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

    const rad2deg = 180.0 / 3.14159265;
    console.log(
      "find triangles with angles",
      this.max_angle_delta,
      a01 * rad2deg,
      a12 * rad2deg,
      a20 * rad2deg,
    );
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
    console.log(triangles_found);
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
    console.log(triangles_found);

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
  current_wh: [number, number];

  img: HTMLImageElement | null = null;
  img_w: number = 0;
  img_h: number = 0;
  img_cx: number = 0;
  img_cy: number = 0;

  max_angle_delta: number = 1.0;

  zoomed_window: ZoomedWindow;

  marker: Draw;
  cross: Draw;
  mouse: Mouse;

  star_vector: WasmVec3f64;
  selected_stars: [number, number][];

  lens_mapping: LensMapping;
  constructor(
    star_catalog: StarCatalog,
    catalog: WasmCatalog,
    canvas_div_id: string,
  ) {
    this.star_catalog = star_catalog;
    this.catalog = catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "find");

    this.div = document.getElementById(canvas_div_id)!;
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

    const get_image = document.querySelector("#find_get_image")!;
    get_image.addEventListener("change", this.get_image.bind(this));

    const best_matches = document.querySelector("#find_best_matches")!;
    best_matches.addEventListener("click", this.best_matches.bind(this));

    const clear_selection = document.querySelector("#find_clear_selection")!;
    clear_selection.addEventListener("click", this.clear_selection.bind(this));

    const find_max_angle = document.querySelector(
      "#find_max_angle",
    )! as HTMLInputElement;
    find_max_angle.addEventListener("input", this.set_parameters.bind(this));
    find_max_angle.value = this.max_angle_delta.toString();

    const lens_mappings = document.getElementById("LensMappings");
    if (lens_mappings !== null) {
      const h = new HtmlElement(lens_mappings);
      const table = h.add_ele("table");
      const tr = table.add_ele("tr");
      {
        const e = tr.add_ele("td");
        e.add_input_radio(
          "radio_lens_mappings",
          "Rectiliinear",
          true,
          this.set_lens_mapping.bind(this),
        ).set_input_checked(true);
        e.add_label("Rectilinear").add_content("Rectilinear");
      }
      for (const x of [
        "Stereographic",
        "Equidistant",
        "Equisolid",
        "Orthographic",
      ]) {
        const e = tr.add_ele("td");
        e.add_input_radio(
          "radio_lens_mappings",
          x,
          true,
          this.set_lens_mapping.bind(this),
        );
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

  image_loaded(_event: Event): void {
    // const ctx = this.canvas.getContext("2d");
    this.img_w = this.img!.naturalWidth;
    this.img_h = this.img!.naturalHeight;
    this.img_cx = this.img_w / 2;
    this.img_cy = this.img_h / 2;
    const img_ar = this.img_w / this.img_h;
    this.zoomed_window.set_img(this.img_w, this.img_h);
    this.canvas.height = this.canvas.width / img_ar;
    const scr_w = this.zoomed_window.get_scr_wh()[0];
    this.zoomed_window.scr_resize(scr_w, scr_w / img_ar);
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

  set_lens_mapping(_event: Event, value: string) {
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
      document.getElementById("find_ma")!.innerText =
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

    const find_orientation = new FindOrientation(
      this.catalog,
      star_vectors,
      this.vp.brightness,
      this.max_angle_delta,
    );

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
      mappings[0]!,
    );
  }

  vector_of_img_xy(ixy: [number, number]): WasmVec3f64 {
    const rdx = ((ixy[0] - this.img_w / 2) / this.img_w) * 2;
    const rdy = ((ixy[1] - this.img_h / 2) / this.img_w) * 2;
    const sensor_rf = Math.sqrt(rdx * rdx + rdy * rdy);
    const roll = Math.atan2(rdy, rdx);

    //    const sensor_yaw = Math.atan(this.vp.tan_hfovh * sensor_rf);
    const world_yaw = this.lens_mapping.map_sensor_r_to_world_yaw(
      this.vp.mm_equiv,
      sensor_rf,
    );
    //    const world_yaw = Math.atan((sensor_rf * 18.0) / this.vp.mm_equiv);

    // const world_yaw = sensor_yaw;
    //
    // viewer is right +x, up +y, out of screen +z
    const world_dir = new WasmVec3f64(
      Math.cos(world_yaw),
      -Math.cos(roll) * Math.sin(world_yaw),
      -Math.sin(roll) * Math.sin(world_yaw),
    );
    world_dir.set_normalized();
    return world_dir;
  }

  img_xy_of_vector(vec: WasmVec3f64): [number, number] {
    const v = vec.array;
    const x = v[0]!;
    const y = -v[1]!;
    const z = -v[2]!;
    const r = Math.sqrt(y * y + z * z);
    const world_yaw = Math.atan2(r, x);
    const roll = Math.atan2(z, y);
    const img_r = this.lens_mapping.map_world_yaw_to_sensor_r(
      this.vp.mm_equiv,
      world_yaw,
    );
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
    const ctx = this.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    if (this.img !== null) {
      const ib = this.zoomed_window.get_zoomed_img_bounds();
      ctx.drawImage(this.img, ib[0], ib[1], ib[2], ib[3], 0, 0, w, h);
    }

    const v = new WasmVec3f64(0, 0, 0);
    const fa = new Float64Array(3);
    for (let degree = 1; degree < 90; degree += 1) {
      ctx.strokeStyle = "green";
      if (degree % 5 == 0) {
        ctx.strokeStyle = "lightgreen";
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
