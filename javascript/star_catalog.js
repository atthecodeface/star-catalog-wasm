//a To do
// Orbit, more names
// precession, catalog in j2000 precession maps j2000 to current ecef (sky map is in ecef, optionally j2000)
import star_catalog_init, { WasmCatalog, } from "../pkg/star_catalog_wasm.js";
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
import { SolarSystemCanvas } from "./solar_system_canvas.js";
import { Earth } from "./earth.js";
import { Styling } from "./styling.js";
import { ViewProperties } from "./view_properties.js";
var SelectedTab;
(function (SelectedTab) {
    SelectedTab[SelectedTab["Help"] = 0] = "Help";
    SelectedTab[SelectedTab["SkyView"] = 1] = "SkyView";
    SelectedTab[SelectedTab["SkyMap"] = 2] = "SkyMap";
    SelectedTab[SelectedTab["Location"] = 3] = "Location";
    SelectedTab[SelectedTab["Find"] = 4] = "Find";
    SelectedTab[SelectedTab["SolarSystem"] = 5] = "SolarSystem";
    SelectedTab[SelectedTab["Log"] = 6] = "Log";
    SelectedTab[SelectedTab["Info"] = 7] = "Info";
})(SelectedTab || (SelectedTab = {}));
class TabType {
    constructor(href, selected_tab) {
        this.web_canvas_client = null;
        this.has_controls = false;
        this.href = href;
        this.selected_tab = selected_tab;
    }
    set_client(web_canvas_view) {
        this.web_canvas_client = web_canvas_view;
        return this;
    }
    set_has_controls(has_controls) {
        this.has_controls = has_controls;
        return this;
    }
}
export class StarCatalog {
    constructor(wasm_instance, params) {
        this.view_needs_update = false;
        this.selected_css = "day";
        this.pending_resize = null;
        this.wasm_memory = new WasmMemory(wasm_instance.memory);
        this.log = new Log("Log", Severity.Info, Severity.Warning);
        this.logger = new Logger(this.log, "main");
        this.catalog = new WasmCatalog("hipp_bright");
        this.orientation_ctl = new Orientation(this);
        this.animate = new Animate(this.animate_cb.bind(this));
        let mode = "day";
        const e = document.querySelector("#js_detect_css");
        if (e !== null) {
            e.hidden = true;
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
        this.solar_system_canvas = new SolarSystemCanvas(this.vp, this.webgl_canvas);
        this.tab_types = [
            new TabType("#tab-help", SelectedTab.Help),
            new TabType("#tab-skyview", SelectedTab.SkyView)
                .set_client(this.sky_canvas)
                .set_has_controls(true),
            new TabType("#tab-solarsystem", SelectedTab.SolarSystem)
                .set_client(this.solar_system_canvas)
                .set_has_controls(true),
            new TabType("#tab-location", SelectedTab.Location).set_client(this.earth_canvas),
            new TabType("#tab-skymap", SelectedTab.SkyMap)
                .set_client(this.map_canvas)
                .set_has_controls(true),
            new TabType("#tab-find", SelectedTab.Find),
            new TabType("#tab-log", SelectedTab.Log),
            new TabType("#tab-info", SelectedTab.Info),
        ];
        this.selected_tab_type = this.tab_types[0];
        // this.find_canvas = new FindCanvas(this.vp, "FindCanvas");
        this.pending_resize = null;
        this.selected_css_changed();
        for (const resizable_content of document.getElementsByClassName("get_size_of_this")) {
            this.resize_observer.observe(resizable_content);
        }
        this.tabs = new Tabs("#tab-list", (id) => {
            this.tab_selected(id);
        });
        this.set_view_needs_update();
    }
    orientation_permitted(permitted) {
        if (permitted) {
            this.logger.info("Device orientation permitted");
            this.orientation_ctl.enable();
        }
        else {
            this.logger.warning("Device orientation not permitted");
        }
    }
    orientation(e) {
        console.log("Orientation", e.alpha, e.beta, e.gamma);
        let elev = 90 - e.gamma;
        let compass = e.alpha;
        if (e.gamma < 0) {
            elev = -90 - e.gamma;
            compass = 90 - e.alpha;
        }
        else {
            compass = -90 - e.alpha;
        }
        this.vp.view_observer_set(compass * this.vp.deg2rad, elev * this.vp.deg2rad);
    }
    set_playback(interval, seconds_per_interval) {
        this.vp.play_interval = interval;
        this.vp.play_seconds = seconds_per_interval;
        this.schedule_animation();
    }
    schedule_animation() {
        if (this.vp.play_interval != 0 && this.vp.play_seconds != 0) {
            this.animate.schedule(this.vp.play_interval * 1000);
        }
    }
    animate_cb(_time) {
        if (this.vp.play_interval != 0 && this.vp.play_seconds != 0) {
            this.vp.time_add(0, 0, this.vp.play_seconds);
            this.schedule_animation();
        }
    }
    resize_canvas(e) {
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
    tab_selected(tab_id) {
        this.selected_tab_type = this.tab_types[0];
        for (const tab_type of this.tab_types) {
            if (tab_id === tab_type.href) {
                this.selected_tab_type = tab_type;
            }
        }
        const e_ctl = document.getElementById("ctl_selectors");
        if (e_ctl != null) {
            e_ctl.hidden = !this.selected_tab_type.has_controls;
        }
        if (this.selected_tab_type.web_canvas_client === null) {
            this.webgl_canvas.canvas.hidden = true;
        }
        else {
            this.webgl_canvas.canvas.hidden = false;
            this.webgl_canvas.mouse.set_client(this.selected_tab_type.web_canvas_client);
        }
        this.set_view_needs_update();
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
        if (this.selected_tab_type.web_canvas_client !== null) {
            this.webgl_canvas.redraw(this.selected_tab_type.web_canvas_client);
        }
        /*
        if (this.selected_tab == SelectedTab.Find) {
          this.find_canvas.update();
        }
        */
        this.view_needs_update = false;
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
        const label = document.querySelector("#day_night_label");
        if (is_day) {
            this.selected_css = "day";
            label.innerText = "Night mode";
        }
        else {
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
    view_q_post_mul(q) {
        this.vp.view_q_post_mul(q);
        this.set_view_needs_update();
    }
}
//a Top level on load...
window.star_catalog = null;
function complete_init(star_catalog_wasm) {
    window.star_catalog = new StarCatalog(star_catalog_wasm, new URLSearchParams(window.location.search));
}
window.addEventListener("load", (_e) => {
    star_catalog_init().then((x) => {
        complete_init(x);
    });
});
