//a To do
// Orbit, more names
// precession, catalog in j2000 precession maps j2000 to current ecef (sky map is in ecef, optionally j2000)

import star_catalog_init, {
  WasmCatalog,
  WasmQuatf64,
  InitOutput,
} from "../pkg/star_catalog_wasm.js";

import * as html from "./html.js";
import { WasmMemory } from "./wasm_memory.js";
import { Tabs } from "./tabbed.js";
import { Log, Logger, Severity } from "./log.js";
import { Orientation } from "./orientation.js";
import { Animate } from "./animate.js";

import { Controls } from "./controls.js";

import { WebglCanvas } from "./webgl_canvas.js";
import { MapCanvas } from "./map_canvas.js";
import { SkyCanvas } from "./sky_canvas.js";
// import { FindCanvas } from "./find_canvas.js";
import { TestCanvas } from "./test_canvas.js";

import { Earth } from "./earth.js";
import { Styling } from "./styling.js";
import { ViewProperties } from "./view_properties.js";

enum SelectedTab {
  Help,
  SkyView,
  SkyMap,
  Location,
  Find,
  Test,
  Log,
  Info,
}

export class StarCatalog {
  log: Log;
  logger: Logger;
  catalog: WasmCatalog;
  wasm_memory: WasmMemory;
  tabs: Tabs;
  orientation_ctl: Orientation;

  styling: Styling;
  vp: ViewProperties;

  webgl_canvas: WebglCanvas;

  sky_canvas: SkyCanvas;
  map_canvas: MapCanvas;
  earth_canvas: Earth;
  // find_canvas: FindCanvas;
  solar_system_canvas: TestCanvas;
  controls: Controls;

  animate: Animate;

  view_needs_update: boolean = false;
  selected_css: string = "day";
  selected_tab: SelectedTab = SelectedTab.Help;

  tab_ids: Map<SelectedTab, string> = new Map([
    [SelectedTab.Help, "#tab-help"],
    [SelectedTab.SkyView, "#tab-skyview"],
    [SelectedTab.SkyMap, "#tab-skymap"],
    [SelectedTab.Location, "#tab-location"],
    [SelectedTab.Find, "#tab-find"],
    [SelectedTab.Test, "#tab-test"],
    [SelectedTab.Log, "#tab-log"],
    [SelectedTab.Info, "#tab-info"],
  ]);

  resize_observer: ResizeObserver;
  pending_resize: [number, number] | null = null;

  constructor(wasm_instance: InitOutput, params: URLSearchParams) {
    this.wasm_memory = new WasmMemory(wasm_instance.memory);
    this.log = new Log("Log", Severity.Info, Severity.Warning);
    this.logger = new Logger(this.log, "main");

    this.catalog = new WasmCatalog("hipp_bright");

    this.tabs = new Tabs("#tab-list", (id) => {
      this.tab_selected(id);
    });

    this.orientation_ctl = new Orientation(this);
    this.animate = new Animate(this.animate_cb.bind(this));

    let mode = "day";
    const e = document.querySelector("#js_detect_css");
    if (e !== null) {
      (e as any).hidden = true;
      const color_string = window.getComputedStyle(e).getPropertyValue("color");
      const m = color_string.match(/^rgb\s*\(\s*(\d+).*/i);
      if (m && m[1]) {
        if (parseInt(m[1]) == 0) {
          mode = "night";
        }
      }
    }

    if (params.get("mode") == "day") {
      mode = "day";
    }
    html.set_input_checked("day_night", mode == "day");
    this.styling = new Styling(mode);

    this.vp = new ViewProperties(this, params);

    this.resize_observer = new ResizeObserver(this.resize_canvas.bind(this));

    this.controls = new Controls(this, "controls");

    this.webgl_canvas = new WebglCanvas(this.vp, "WebCanvas");
    this.sky_canvas = new SkyCanvas(this.vp, this.webgl_canvas);
    this.map_canvas = new MapCanvas(this.vp, this.webgl_canvas);
    this.earth_canvas = new Earth(this.vp, this.webgl_canvas);
    this.solar_system_canvas = new TestCanvas(this.vp, this.webgl_canvas);

    // this.find_canvas = new FindCanvas(this.vp, "FindCanvas");

    this.pending_resize = null;
    this.selected_css_changed();

    for (const resizable_content of document.getElementsByClassName(
      "get_size_of_this",
    )) {
      this.resize_observer.observe(resizable_content);
    }

    this.set_view_needs_update();
  }

  orientation_permitted(permitted: boolean): void {
    if (permitted) {
      this.logger.info("Device orientation permitted");
      this.orientation_ctl.enable();
    } else {
      this.logger.warning("Device orientation not permitted");
    }
  }

  orientation(e: DeviceOrientationEvent): void {
    console.log("Orientation", e.alpha, e.beta, e.gamma);
    let elev = 90 - e.gamma!;
    let compass = e.alpha!;
    if (e.gamma! < 0) {
      elev = -90 - e.gamma!;
      compass = 90 - e.alpha!;
    } else {
      compass = -90 - e.alpha!;
    }
    this.vp.view_observer_set(
      compass * this.vp.deg2rad,
      elev * this.vp.deg2rad,
    );
  }

  set_playback(interval: number, seconds_per_interval: number) {
    this.vp.play_interval = interval;
    this.vp.play_seconds = seconds_per_interval;
    this.schedule_animation();
  }

  schedule_animation(): void {
    if (this.vp.play_interval != 0 && this.vp.play_seconds != 0) {
      this.animate.schedule(this.vp.play_interval * 1000);
    }
  }

  animate_cb(_time: number): void {
    if (this.vp.play_interval != 0 && this.vp.play_seconds != 0) {
      this.vp.time_add(0, 0, this.vp.play_seconds);
      this.schedule_animation();
    }
  }

  resize_canvas(e: ResizeObserverEntry[]): void {
    for (const ele of e) {
      console.log(ele.contentRect, ele.target.id);
      if (ele.contentRect.width > 0 && ele.contentRect.height > 0) {
        this.pending_resize = [ele.contentRect.width, ele.contentRect.height];
        this.set_view_needs_update();
      }
    }
  }

  /// Invoked by events on the page to change the contents; such as selection of equatorial grid 'on'
  set_styling() {
    this.set_view_needs_update();
  }

  /// Mark the view as needing an update
  set_view_needs_update() {
    if (!this.view_needs_update) {
      this.view_needs_update = true;
      requestAnimationFrame(() => {
        this.update_view();
      });
    }
  }

  /// Update the view, because of a view change, time change, etc
  update_view() {
    if (this.vp === undefined) {
      return;
    }
    if (this.pending_resize !== null) {
      this.vp.set_resizable_content_size(this.pending_resize);
      this.pending_resize = null;
    }
    if (!this.view_needs_update) {
      return;
    }
    this.vp.derive_data();

    this.controls.update();
    this.map_canvas.derive_data();

    if (this.selected_tab == SelectedTab.SkyView) {
      this.sky_canvas.update();
    }
    if (this.selected_tab == SelectedTab.SkyMap) {
      this.map_canvas.update();
    }
    if (this.selected_tab == SelectedTab.Location) {
      this.earth_canvas.update();
    }
    /*
    if (this.selected_tab == SelectedTab.Find) {
      this.find_canvas.update();
    }
    */
    if (this.selected_tab == SelectedTab.Test) {
      this.solar_system_canvas.update();
    }
    this.view_needs_update = false;
  }

  tab_selected(tab_id: string) {
    this.selected_tab = SelectedTab.Help;
    for (const x of this.tab_ids) {
      if (x[1] === tab_id) {
        this.selected_tab = x[0];
      }
    }

    const e_ctl = document.getElementById("ctl_selectors");
    const e_resizable = document.getElementById("resizable-tabs");
    switch (this.selected_tab) {
      case SelectedTab.SkyMap:
      case SelectedTab.SkyView:
      case SelectedTab.Location:
      case SelectedTab.Test:
      case SelectedTab.Find: {
        if (e_ctl !== null) {
          e_ctl.hidden = false;
        }
        if (e_resizable !== null) {
          new html.HtmlElement(e_resizable).set_style("display", "");
        }
        break;
      }
      default: {
        if (e_ctl !== null) {
          e_ctl.hidden = true;
        }
        if (e_resizable !== null) {
          new html.HtmlElement(e_resizable).set_style("display", "none");
        }
      }
    }

    this.set_view_needs_update();
  }

  //mp selected_css_toggle
  /// Invoked by the web page when day/night mode is toggled
  selected_css_toggle() {
    const is_day = html.get_input_checked("day_night_checkbox");
    html.set_input_checked("day_night_checkbox", !is_day);
    this.selected_css_changed();
  }

  //mp selected_css_changed
  /// Invoked by the web page when day/night mode is set, and
  /// initially to configure the styling properly.
  selected_css_changed() {
    const is_day = !html.get_input_checked("day_night_checkbox");
    const label = document.querySelector("#day_night_label")! as HTMLElement;

    if (is_day) {
      this.selected_css = "day";
      label.innerText = "Night mode";
    } else {
      this.selected_css = "night";
      label.innerText = "Day mode";
    }
    this.styling.set(this.selected_css);
    this.set_view_needs_update();
  }

  //mp date_set
  /// Set the date to *today*
  date_set() {
    this.vp.date_set();
    this.set_view_needs_update();
  }

  //mp time_set
  /// Set the time-of-day to *now*
  time_set() {
    this.vp.time_set_to_now();
    this.set_view_needs_update();
  }

  //mp view_q_post_mul
  view_q_post_mul(q: WasmQuatf64) {
    this.vp.view_q_post_mul(q);
    this.set_view_needs_update();
  }
}

//a Top level on load...
(window as any).star_catalog = null;
function complete_init(star_catalog_wasm: InitOutput) {
  (window as any).star_catalog = new StarCatalog(
    star_catalog_wasm,
    new URLSearchParams(window.location.search),
  );
}

window.addEventListener("load", (_e) => {
  star_catalog_init().then((x) => {
    complete_init(x);
  });
});
