//a Imports
import init, {WasmCatalog, WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import {tabbed_configure} from "./tabbed.js";
import {Log} from "./log.js";
import * as html from "./html.js";
import * as utils from "./utils.js";
import * as map from "./map_canvas.js";
import * as sky from "./sky_canvas.js";
import * as earth from "./earth.js";
import * as compass from "./compass.js";
import {Styling} from "./styling.js";
import {ViewProperties} from "./view_properties.js";

//a Useful functions
//fi fract
function fract(x) {
    return x - Math.floor(x);
}

//a StarCatalog
//c StarCatalog
/// There are *three* XYZ coordinate systems:
///
///  1. ECEF - earth centered, earth fixed; the stars are in this
///      system. +z is through the north pole, +x is through Greenwich
///
///  2. Observer position - From a given lat/lon and time; +z is
///     from the center of the earth through the observer's feet,
///     and it rotates around the earth's axis over time; +x is
///     such that the earth's axis lies in the X-Z plane; +y is
///     such tha XYZ form a right-handed set.
///
///  3. View orientation - with X being to the right of the view,
///     Y up, and Z out of the screen.
///
/// Properties are:
///
///   up - vector from the center of the earth out through the feet of the observer (hence uses ra and de only)
///
///   q_looking_ns - quaternion mapping ECEF XYZ direction to
///      observer XYZ to ECEF XYZ direction; effectively a camera
///      at the observer horizontally pointed north. Apply this to
///      a star determine where it is relative to the observer;
///      apply the conjugate to map an observer position to ECEF,
///      such as for the azimuthal grid. Apply the conjugate to
///      (1,0,0) to show the compass heading and elevation
///
///  viewer_q - quaternion mapping the viewer's camera to ECEF. Apply
///     this to a viewer vector (such as where a star appears in the
///     viewer frame) to determine a direction in ECEF (such as where
///     that star actually is in the catalog)
///   
///  viewer_q_i - quaternion mapping ECEV to the viewer's
///     camera. Apply this to a star direction vector to determine
///     where in the view to draw the star.
///
///  vector_x - unit vector (1,0,0)
///
///  vector_y - unit vector (0,1,0)
///
///  vector_z - unit vector (0,0,1)
class StarCatalog {
    //cp constructor
    constructor() {
        this.WasmCatalog = WasmCatalog;
        this.WasmStar = WasmStar;
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;
        this.catalog = new WasmCatalog("hipp_bright");

        this.styling = new Styling();
        
        this.view_needs_update = false;

        this.vp = new ViewProperties(this);

        this.sky_canvas = new sky.SkyCanvas(this, this.catalog, "SkyCanvas",800,400);
        this.map_canvas = new map.MapCanvas(this, this.catalog, "MapCanvas",800,300);
        this.earth_canvas = new earth.Earth(this, "EarthCanvas", 800, 400, this.vp.earth_webgl, this.vp.earth_division);
        this.sky_view_compass = new compass.CompassCanvas(this, "SkyViewCompass", 200, 150 );

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
        console.log(this.view_needs_update)
        if (!this.view_needs_update) {
            this.view_needs_update = true;
            setTimeout(() => { console.log(this); this.update_view() } );
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
        this.sky_view_compass.update();
        this.earth_canvas.update();

        this.view_needs_update = false;
    }

    //mp tab_selected
    tab_selected(tab_id) {
        if (tab_id=="#tab-location") {
            console.log("Opened tab-location");
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
        vp.date_set();
        this.set_view_needs_update();
    }
    
    //mp time_set
    /// Set the time-of-day to *now*
    time_set() {
        vp.time_set();
        this.set_view_needs_update();
    }

    //mp update_latlon
    /// Update the view, because of a view change, time change, etc
    update_latlon(lat_lon) {
        vp.update_latlon(lat_lon);
        this.set_view_needs_update();
    }

    //mp view_q_post_mul
    view_q_post_mul(q) {
        vp.view_q_post_mul(q);
        this.set_view_needs_update();
    }

    //mp view_q_pre_mul
    view_q_pre_mul(q) {
        vp.view_q_pre_mul(q);
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
}

//a Top level on load...
window.star_catalog = null;
function complete_init() {
    window.log = new Log(document.getElementById("Log"));
    window.star_catalog = new StarCatalog();
}

window.addEventListener("load", (e) => {
    init().then(() => {
        tabbed_configure("#tab-list", 
                         (id) => {if (window.star_catalog !== null) {window.star_catalog.tab_selected(id);}});
        complete_init();
    }
)});
