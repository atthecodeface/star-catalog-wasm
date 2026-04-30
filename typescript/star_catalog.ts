//a To do
// Orbit, more names

import init, {
  WasmCatalog,
  WasmVec3f64,
  WasmQuatf64,
} from "../pkg/star_catalog_wasm.js";

import * as html from "./html.js";
import { Tabs } from "./tabbed.js";
import { Log, Logger, Severity } from "./log.js";

import { CompassCanvas } from "./compass.js";
import { ClockCanvas } from "./clock.js";
import { CalendarCanvas } from "./calendar.js";
import { ElevationCanvas } from "./elevation.js";

import { MapCanvas } from "./map_canvas.js";
import { SkyCanvas } from "./sky_canvas.js";
import { FindCanvas } from "./find_canvas.js";
import { Earth } from "./earth.js";
import { Styling } from "./styling.js";
import { ViewProperties } from "./view_properties.js";

enum SelectedTab {
  Help,
  SkyView,
  SkyMap,
  Location,
  Find,
  Log,
  Info,
}

export class StarCatalog {
  log: Log;
  logger: Logger;
  catalog: WasmCatalog;
  tabs: Tabs;
  styling: Styling;
  vp: ViewProperties;
  sky_canvas: SkyCanvas;
  map_canvas: MapCanvas;
  earth_canvas: Earth;
  find_canvas: FindCanvas;
  control_compass: CompassCanvas;
  control_clock: ClockCanvas;
  control_calendar: CalendarCanvas;
  control_elevation: ElevationCanvas;

  view_needs_update: boolean = false;
  selected_css: string = "day";
  selected_tab: SelectedTab = SelectedTab.Help;

  tab_ids: Map<SelectedTab, string> = new Map([
    [SelectedTab.Help, "#tab-help"],
    [SelectedTab.SkyView, "#tab-skyview"],
    [SelectedTab.SkyMap, "#tab-skymap"],
    [SelectedTab.Location, "#tab-location"],
    [SelectedTab.Find, "#tab-find"],
    [SelectedTab.Log, "#tab-log"],
    [SelectedTab.Info, "#tab-info"],
  ]);

  constructor(params: URLSearchParams) {
    console.log(params);
    this.log = new Log("Log", Severity.Info, Severity.Warning);
    this.logger = new Logger(this.log, "main");

    this.catalog = new WasmCatalog("hipp_bright");

    this.tabs = new Tabs("#tab-list", (id) => {
      this.tab_selected(id);
    });

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

    this.sky_canvas = new SkyCanvas(this, this.catalog, "SkyCanvas", 800, 400);
    this.map_canvas = new MapCanvas(this, this.catalog, "MapCanvas", 800, 300);
    this.earth_canvas = new Earth(
      this,
      "EarthCanvas",
      800,
      400,
      this.vp.earth_webgl,
      this.vp.earth_division,
    );
    this.find_canvas = new FindCanvas(
      this,
      this.catalog,
      "FindCanvas",
      600,
      400,
    );
    this.control_compass = new CompassCanvas(this, "ControlCompass", 200, 100);
    this.control_clock = new ClockCanvas(this, "ControlClock", 100, 100);
    this.control_calendar = new CalendarCanvas(
      this,
      "ControlCalendar",
      100,
      100,
    );
    this.control_elevation = new ElevationCanvas(
      this,
      "ControlElevation",
      50,
      100,
    );

    this.selected_css_changed();
    this.set_view_needs_update();
  }

  //mp set_styling
  /// Invoked by events on the page to change the contents; such as selection of equatorial grid 'on'
  set_styling() {
    this.set_view_needs_update();
  }

  //mp set_view_needs_update
  /// Mark the view as needing an update
  set_view_needs_update() {
    if (!this.view_needs_update) {
      this.view_needs_update = true;
      requestAnimationFrame(() => {
        this.update_view();
      });
    }
  }

  //mp update_view
  /// Update the view, because of a view change, time change, etc
  update_view() {
    if (this.vp === undefined) {
      return;
    }
    if (!this.view_needs_update) {
      return;
    }
    this.vp.derive_data();

    this.control_clock.update();
    this.control_calendar.update();
    this.control_compass.update();
    this.control_elevation.update();

    if (this.selected_tab == SelectedTab.SkyView) {
      this.sky_canvas.update();
    }
    if (this.selected_tab == SelectedTab.SkyMap) {
      this.map_canvas.update();
    }
    if (this.selected_tab == SelectedTab.Location) {
      this.earth_canvas.update();
    }
    if (this.selected_tab == SelectedTab.Find) {
      this.find_canvas.update();
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

    const e_ctl = document.getElementById("controls");
    if (e_ctl !== null) {
      switch (this.selected_tab) {
        case SelectedTab.SkyMap:
        case SelectedTab.SkyView:
        case SelectedTab.Find: {
          e_ctl.hidden = false;
          break;
        }
        default: {
          e_ctl.hidden = true;
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
    this.vp.time_set();
    this.set_view_needs_update();
  }

  //mp update_latlon
  /// Update the view, because of a view change, time change, etc
  update_latlon(lat: number, lon: number) {
    this.vp.update_latlon(lat, lon);
    this.set_view_needs_update();
  }

  //mp view_q_post_mul
  view_q_post_mul(q: WasmQuatf64) {
    this.vp.view_q_post_mul(q);
    this.set_view_needs_update();
  }

  //mp view_q_pre_mul
  view_q_pre_mul(q: WasmQuatf64) {
    this.vp.view_q_pre_mul(q);
    this.set_view_needs_update();
  }

  //mp center_lat_lon
  /// Center the earth view on a specific lat lon
  center_lat_lon(lat: number, lon: number) {
    this.earth_canvas.center_lat_lon(lat, lon);
    this.set_view_needs_update();
  }

  //mp center_sky_view
  /// Center the sky view on a specific right ascension / declination
  center_sky_view(ra_de: [number, number]) {
    this.sky_canvas.center(ra_de);
  }

  //mp sky_view_set_orientation
  /// Set the whole quaternion
  sky_view_set_orientation(q: WasmQuatf64) {
    this.vp.view_to_ecef_q = q;
    this.set_view_needs_update();
  }

  //mp sky_view_vector_of_fxy
  /// Map a frame XY into a star unit direction vector
  sky_view_vector_of_fxy(fxy: [number, number]) {
    const v = new WasmVec3f64(0, 0, 0);
    this.sky_canvas.set_vector_of_fxy(v, fxy);
    v.set_apply_q3(this.vp.view_to_ecef_q);
    return v;
  }

  //mp sky_view_brightness_set
  /// Set the maximum magnitude of the stars shown in the sky view
  sky_view_brightness_set() {
    this.vp.brightness_set();
  }

  //mp sky_view_zoom_set
  /// Set the zoom of the sky view window
  sky_view_zoom_set() {
    this.vp.zoom_set();
  }

  //mp sky_view_zoom_by
  /// Set the zoom of the sky view window
  sky_view_zoom_by(factor: number) {
    this.sky_canvas.user_zoom([0, 0], factor);
  }
}

//a Top level on load...
(window as any).star_catalog = null;
function complete_init() {
  (window as any).star_catalog = new StarCatalog(
    new URLSearchParams(window.location.search),
  );
}

window.addEventListener("load", (_e) => {
  init().then(() => {
    complete_init();
  });
});
