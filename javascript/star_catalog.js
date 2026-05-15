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
import { MapCanvas } from "./map_canvas.js";
import { SkyCanvas } from "./sky_canvas.js";
import { FindCanvas } from "./find_canvas.js";
import { TestCanvas } from "./test_canvas.js";
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
    SelectedTab[SelectedTab["Test"] = 5] = "Test";
    SelectedTab[SelectedTab["Log"] = 6] = "Log";
    SelectedTab[SelectedTab["Info"] = 7] = "Info";
})(SelectedTab || (SelectedTab = {}));
export class StarCatalog {
    constructor(wasm_instance, params) {
        this.view_needs_update = false;
        this.selected_css = "day";
        this.selected_tab = SelectedTab.Help;
        this.tab_ids = new Map([
            [SelectedTab.Help, "#tab-help"],
            [SelectedTab.SkyView, "#tab-skyview"],
            [SelectedTab.SkyMap, "#tab-skymap"],
            [SelectedTab.Location, "#tab-location"],
            [SelectedTab.Find, "#tab-find"],
            [SelectedTab.Test, "#tab-test"],
            [SelectedTab.Log, "#tab-log"],
            [SelectedTab.Info, "#tab-info"],
        ]);
        this.pending_resize = null;
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
        this.sky_canvas = new SkyCanvas(this.vp, "SkyCanvas", 50, 50);
        this.map_canvas = new MapCanvas(this.vp, "MapCanvas", 50, 50);
        this.earth_canvas = new Earth(this.vp, "EarthCanvas", 800, 400, this.vp.earth_webgl, this.vp.earth_division);
        this.find_canvas = new FindCanvas(this.vp, "FindCanvas");
        this.test_canvas = new TestCanvas(this.vp, "TestCanvas");
        this.pending_resize = null;
        this.selected_css_changed();
        for (const resizable_content of document.getElementsByClassName("resizable-content")) {
            this.resize_observer.observe(resizable_content);
        }
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
            // console.log(ele.contentRect, ele.target.id);
            if (ele.contentRect.width > 0 && ele.contentRect.height > 0) {
                this.pending_resize = [ele.contentRect.width, ele.contentRect.height];
                this.set_view_needs_update();
            }
        }
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
        if (this.pending_resize !== null) {
            this.vp.set_resizable_content_size(this.pending_resize);
            this.pending_resize = null;
        }
        if (!this.view_needs_update) {
            return;
        }
        this.vp.derive_data();
        this.controls.update();
        this.sky_canvas.derive_data();
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
        if (this.selected_tab == SelectedTab.Find) {
            this.find_canvas.update();
        }
        if (this.selected_tab == SelectedTab.Test) {
            this.test_canvas.update();
        }
        this.view_needs_update = false;
    }
    tab_selected(tab_id) {
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
