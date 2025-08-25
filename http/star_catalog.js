//a To do
// Cache
// Orbit
// S

//a Imports
import init, {WasmCatalog, WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import {tabbed_configure} from "./tabbed.js";
import {Log} from "./log.js";
import * as html from "./html.js";
import * as utils from "./utils.js";
import * as map from "./map_canvas.js";
import * as sky from "./sky_canvas.js";
import {Earth} from "./earth.js";
import {CompassCanvas} from "./compass.js";
import {ClockCanvas} from "./clock.js";
import {ElevationCanvas} from "./elevation.js";
import {Styling} from "./styling.js";
import {ViewProperties} from "./view_properties.js";

//a Useful functions
//fi fract
function fract(x) {
    return x - Math.floor(x);
}

//a StarCatalog
//c StarCatalog
class StarCatalog {
    //cp constructor
    constructor(params) {
        this.WasmCatalog = WasmCatalog;
        this.WasmStar = WasmStar;
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;
        this.catalog = new WasmCatalog("hipp_bright");

        let mode = "day";
        const e = document.querySelector("#js_detect_css");
        if (e) {
            e.hidden = true;
            const color_string = window.getComputedStyle(e).getPropertyValue("color");
            const m = color_string.match(/^rgb\s*\(\s*(\d+).*/i);
            if (m && m[1]) {
                if (parseInt(m[1]) == 0) {
                    mode = "night";
                }
            }
        }

        const day_night_e = document.querySelector('input[name=day_night]');
        if (params.get("mode") == "day") {
            mode = "day";
        }
        if (day_night_e) {
            day_night_e.checked = (mode == "day");
        }
        this.styling = new Styling(mode);
        
        this.view_needs_update = false;

        this.vp = new ViewProperties(this, params);

        this.sky_canvas = new sky.SkyCanvas(this, this.catalog, "SkyCanvas",800,400);
        this.map_canvas = new map.MapCanvas(this, this.catalog, "MapCanvas",800,300);
        this.earth_canvas = new Earth(this, "EarthCanvas", 800, 400, this.vp.earth_webgl, this.vp.earth_division);
        this.control_compass = new CompassCanvas(this, "ControlCompass", 200, 100 );
        this.control_clock = new ClockCanvas(this, "ControlClock", 100, 100 );
        this.control_elevation = new ElevationCanvas(this, "ControlElevation", 50, 100 );

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
            setTimeout(() => { this.update_view() } );
        }
    }

    //mp update_view
    /// Update the view, because of a view change, time change, etc
    update_view() {
        if (!this.view_needs_update) {
            return;
        }
        this.vp.derive_data();
        
        this.sky_canvas.update();
        this.map_canvas.update();
        this.control_compass.update();
        this.control_clock.update();
        this.control_elevation.update();
        this.earth_canvas.update();

        this.view_needs_update = false;
    }

    //mp tab_selected
    tab_selected(tab_id) {
        const e = document.getElementById("controls");
        if (!e) {
            return;
        }

        if ((tab_id=="#tab-skyview") || (tab_id=="#tab-skymap")) {
            e.hidden = false;
        } else {
            e.hidden = true;
        }
    }

    //mp selected_css_toggle
    /// Invoked by the web page when day/night mode is toggled
    selected_css_toggle() {
        const checkbox = document.querySelector('input[name=day_night]');
        checkbox.checked = !checkbox.checked;
        this.selected_css_changed();
    }

    //mp selected_css_changed
    /// Invoked by the web page when day/night mode is set, and
    /// initially to configure the styling properly.
    selected_css_changed() {
        const checkbox = document.querySelector('input[name=day_night]');
        const label = document.querySelector('#day_night_label');
        this.selected_css = "night";
        label.innerText = "Day mode";
        if (checkbox.checked) {
            this.selected_css = "day";
            label.innerText = "Night mode";
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
    update_latlon(lat_lon) {
        this.vp.update_latlon(lat_lon);
        this.set_view_needs_update();
    }

    //mp view_q_post_mul
    view_q_post_mul(q) {
        this.vp.view_q_post_mul(q);
        this.set_view_needs_update();
    }

    //mp view_q_pre_mul
    view_q_pre_mul(q) {
        this.vp.view_q_pre_mul(q);
        this.set_view_needs_update();
    }

    //mp center_sky_view
    /// Center the sky view on a specific right ascension / declination
    center_sky_view(ra_de) {
        this.sky_canvas.center(ra_de);
    }

    //mp sky_view_vector_of_fxy
    /// Map a frame XY into a star unit direction vector
    sky_view_vector_of_fxy(fxy) {
        const v = this.sky_canvas.vector_of_fxy(fxy);
        return this.vp.view_to_ecef_q.apply3(v);
    }

    //mp sky_view_brightness_set
    /// Set the maximum magnitude of the stars shown in the sky view
    sky_view_brightness_set() {
        this.sky_canvas.brightness_set();
    }

    //mp sky_view_zoom_set
    /// Set the zoom of the sky view window
    sky_view_zoom_set() {
        this.sky_canvas.zoom_set();
    }
    //mp sky_view_zoom_by
    /// Set the zoom of the sky view window
    sky_view_zoom_by(factor) {
        this.sky_canvas.zoom(factor);
    }
}

//a Top level on load...
window.star_catalog = null;
function complete_init() {
    const location_url = new URL(location);
    window.log = new Log(document.getElementById("Log"));
    window.star_catalog = new StarCatalog(location_url.searchParams);
}

window.addEventListener("load", (e) => {
    init().then(() => {
        complete_init();
        tabbed_configure("#tab-list", 
                         (id) => {if (window.star_catalog) {window.star_catalog.tab_selected(id);}});
    }
)});
