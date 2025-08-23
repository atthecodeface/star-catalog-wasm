//a Imports
import {WasmCatalog, WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import * as utils from "./utils.js";

//a Useful functions
//fi fract
function fract(x) {
    return x - Math.floor(x);
}

//a ViewProperties
//c ViewProperties
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
export class ViewProperties {
    //cp constructor
    constructor() {
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;

        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;

        this.vector_x = new WasmVec3f64(1,0,0);
        this.vector_y = new WasmVec3f64(0,1,0);
        this.vector_z = new WasmVec3f64(0,0,1);

        this.lat = 52;
        this.lon = 0;

        this.days_since_epoch = 19711;
        this.time_of_day = 18.377;

        // this.viewer_q => view_to_ecef_q
        // this.viewer_q_i => ecef_to_view_q
        this.viewer_q = WasmQuatf64.unit();

        this.earth_division = 8;
        this.earth_webgl = true;
        this.date_set();
        this.time_set();

        this.update_latlon([this.lat, this.lon]);
    }

    //mp derive_data
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_data() {
        this.viewer_q_i = this.viewer_q.conjugate();

        this.time_of_day = 24 * fract(this.time_of_day / 24.0);
        if (this.lat > 90) {this.lat = 90;}
        if (this.lat < -90) {this.lat = -90;}
        if (this.lon > 180) {this.lon -= 360;}
        if (this.lon < -180) {this.lat += 360;}

        const de = this.lat * this.deg2rad;
        const ra_of_days = this.days_since_epoch * (366.25/365.25);
        // This magic constant seems to be about right
        const OFFSET = 100.4157224224/360;
        const ra_time = this.lon / 360 +  fract(ra_of_days) + this.time_of_day / 24 * 366.25/365.35 + OFFSET;
        const ra = fract(ra_time) * 2*Math.PI;
        this.up = this.vec_of_ra_de(ra, de);

        // Make v1 be star north by default
        var v1 = new WasmVec3f64(1,0,0);
        const cos_ns = this.up.dot(v1);
        // If at a pole, then at least make it non fragile
        if ((cos_ns > 0.99)  || (cos_ns < -0.99)) {
            v1 = new WasmVec3f64(0,1,0);
        }
        const v2 = this.up.cross_product(v1).normalize();
        const up_and_ns = this.up.cross_product(v2).normalize();
        this.q_looking_ns = WasmQuatf64.unit().rotate_x(Math.PI/2 - de).rotate_z(Math.PI/2-ra);

        this.update_html_elements();
    }

    update_html_elements() {
        html.if_ele_id("lat", this.lat, function(e,v) {
            e.innerText = `Lat: ${v.toFixed(1)}`;
        });
        html.if_ele_id("lon", this.lon, function(e,v) {
            e.innerText = `Lon: ${v.toFixed(1)}`;
        });
        html.if_ele_id("time", this.time_of_day, function(e,v) {
            const hour = Math.floor(v);
            const mins = (v - hour) * 60;
            const secs = (mins - Math.floor(mins)) * 60;
            e.innerText = `Time: ${String(hour).padStart(2,'0')}:${String(Math.floor(mins)).padStart(2,'0')}:${String(Math.floor(secs)).padStart(2,'0')}`;
        });
        html.if_ele_id("date", this.days_since_epoch, function(e,v) {
            const date = new Date();
            date.setTime(v*24*60*60*1000);
            e.innerText = `${date.toDateString()}`;
        });
    }        

    //mp date_set
    /// Set the date to *today*
    date_set() {
        const date = new Date(Date.now());
        date.setUTCHours(0,0,0);
        this.days_since_epoch = Math.round(date.valueOf() / (24*60*60*1000));
        this.derive_data();
        this.update_view();
    }
    
    //mp time_set
    /// Set the time-of-day to *now*
    time_set() {
        const date = new Date(Date.now());
        date.setUTCMonth(0,1);
        date.setUTCFullYear(1970);
        this.time_of_day = date.valueOf() / (60*60*1000);
        this.derive_data();
        this.update_view();
    }

    //mp update_latlon
    /// Update the view, because of a view change, time change, etc
    update_latlon(lat_lon) {
        window.log.add_log("info", "view_prop", "update", `Set Lat/Lon to ${180/Math.PI*lat_lon[0]},${180/Math.PI*lat_lon[1]}`);
        this.lat = lat_lon[0];
        this.lon = lat_lon[1];
    }

    //mp view_q_post_mul
    view_q_post_mul(q) {
        this.viewer_q = this.viewer_q.mul(q);
        this.set_view_needs_update();
    }

    //mp view_q_pre_mul
    view_q_pre_mul(q) {
        this.viewer_q = q.mul(this.viewer_q);
        this.set_view_needs_update();
    }

    //mp sky_view_vector_of_fxy
    /// Map a frame XY into a star unit direction vector
    /// sky view window
    sky_view_vector_of_fxy(fxy) {
        const v = this.sky_canvas.vector_of_fxy(fxy);
        return this.viewer_q.apply3(v);
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
