import {
  WasmVec3f64,
  WasmQuatf64,
  WasmCatalog,
  WasmPolynomial,
} from "../pkg/star_catalog_wasm.js";
import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { ZoomedWindow } from "./zoomed_window.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { HtmlElement } from "./html.js";
import { Application } from "./application.js";

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
}

export class FindCanvas {
  application: Application;
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
  constructor(application: Application, canvas_div_id: string) {
    this.application = application;
    this.vp = this.application.view_properties;
    this.logger = new Logger(application.log, "find");

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
          { id: x },
        );
        e.add_label(x).add_content(x);
      }
      tr.add_ele("td")
        .add_input_dropdown(
          "lens_mapping_dropdown",
          [
            ["select", "Select a camera/lens"],
            ["iphone17", "iPhone 17"],
            ["rebel_50mm", "Rebel + 50mm"],
            ["rebel_15mm", "Rebel + 15mm"],
          ],
          null,
          false,
          false,
          this.set_dropdown.bind(this),
          { id: "LensMappingDropdown" },
        )
        .set_input_value("");
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

  set_dropdown(event: Event, value: string) {
    console.log(value);
    switch (value) {
      case "iphone17": {
        let x = new HtmlElement(document.getElementById("Rectiliinear")!);
        x.set_input_checked(true);
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(27.05);
        this.vp.view_updated();
        break;
      }
      case "rebel_50mm": {
        let x = new HtmlElement(document.getElementById("Rectilinear")!);
        x.set_input_checked(true);
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(82.4);
        this.vp.view_updated();
        break;
      }
      case "rebel_15mm": {
        let x = new HtmlElement(document.getElementById("Stereographic")!);
        x.set_input_checked(true);
        this.vp.fovh = this.vp.map_mm_equiv_to_fovh(24.1);
        this.vp.view_updated();
        break;
      }
    }
    (event as any).target.value = "select";
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
    this.vp.view_updated();
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

    const find_orientation = new FindOrientation(
      this.application.catalog,
      star_vectors,
      this.vp.brightness,
      this.max_angle_delta,
    );

    const mappings = find_orientation.find_best_star_mappings();

    this.vp.view_observer_set_orientation(mappings[0]!);
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
    const style = this.application.styling().clock;
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

    const stars = this.vp.star_catalog.sky_canvas.star_cache.get();
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
