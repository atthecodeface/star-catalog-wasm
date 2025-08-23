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
///  vec_of_ra_de - function to map RA/DE to a WasmVec
///
///  deg2rad = Math.PI / 180
///
///  rad2deg = 180 / Math.PI
///
///  lat  - latitude in degrees
///
///  lon  - longitude in degrees
///
///  days_since_epoch  - number of days since Jan 1 1970
///
///  time_of_day - time since midnight in hours
///
///  earth_division - number of subdivisions for icosphere (max 8)
///
///  earth_webgl - true if to use WebGl for the earth canvas
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
///
/// Background
///
/// Epoch will be Jan 1 1970
///
/// What the RA is for Lon 0 at 00:00:00 on Jan 1 1970, don't know yet
///
/// this.days_since_epoch = 19500;
/// this.time_of_day = 0.46;
/// skyguie has HIP80710 striaght up
/// RA of 247.180 That is UTC May 23 2023 at 00:27:38
/// We have RA of 248.81 with our magic constant of + 176.51305887/360-127.0/360;
///
/// this.days_since_epoch = 19500;
/// this.time_of_day = 1.92;
/// skyguie has HIP87833 striaght up
/// RA of 269.1515 That is UTC May 23 2023 at 01:55:11
/// We have RA of 270.4547 with our magic constant of + 176.51305887/360-127.0/360;
///
/// this.days_since_epoch = 19500;
/// this.time_of_day = 17.1;
/// skyguie has HIP44901 striaght up
/// RA of 137.218 That is UTC May 23 2023 at 17:06
/// We have RA of 135.498 with our magic constant of + 176.51305887/360-127.0/360;
///        
/// this.days_since_epoch = 19711;
/// this.time_of_day = 18.377;
/// skyguie has HIP1415 striaght up
/// RA of 4.42944015 That is UTC Dec 20 2023 at 18:22:39 (no dst)
/// We have RA of 2.9675 with our magic constant of + 176.51305887/360-127.0/360;
///
///
/// (211+(18.377 - 0.46) / 24) days has an RA delta of 4.42944-247.180
/// 211 days + 0.74654166666667  rotation = 360*211+117.24943999999999
///
/// This says rotation per day = (360*211+117.24943999999999) / 211.74654166666667
///  = 359.28449570506564
///
/// But it might have wrapped 360 degrees once more?
///
/// This says rotation per day = (360*212+117.24943999999999) / 211.74654166666667
///  = 360.98464153586133
///
/// The earth actually rotates 360 * 366.25 every year,
/// so 360*366.25/365.25 degrees per UTC day = 360.98562628336754 degrees per UTC day
export class ViewProperties {
    //cp constructor
    constructor(star_catalog) {
        this.star_catalog = star_catalog;
        
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

        this.view_to_ecef_q = WasmQuatf64.unit();

        this.earth_division = 8;
        this.earth_webgl = true;
        this.date_set();
        this.time_set();

        this.update_latlon([this.lat, this.lon]);
    }

    //mp derive_de_ra
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_de_ra() {
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

        this.ra = fract(ra_time) * 2*Math.PI;
        this.de = de;
    }

    //mp derive_data
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_data() {
        for (const style of ["show_azimuthal", "show_equatorial"]) {
            const enable_style = (document.querySelector(`input[name=${style}]:checked`) != null);
            this.star_catalog.styling.sky[style] = enable_style;
            this.star_catalog.styling.map[style] = enable_style;
        }

        this.ecef_to_view_q = this.view_to_ecef_q.conjugate();

        this.view_ecef_center_dir = this.view_to_ecef_q.apply3(this.vector_x);

        this.derive_de_ra();
        this.up = this.vec_of_ra_de(this.ra, this.de);

        // Make v1 be star north by default
        var v1 = new WasmVec3f64(1,0,0);
        const cos_ns = this.up.dot(v1);
        // If at a pole, then at least make it non fragile
        if ((cos_ns > 0.99)  || (cos_ns < -0.99)) {
            v1 = new WasmVec3f64(0,1,0);
        }
        const v2 = this.up.cross_product(v1).normalize();
        const up_and_ns = this.up.cross_product(v2).normalize();

        this.q_looking_ns = WasmQuatf64.unit().rotate_x(Math.PI/2 - this.de).rotate_z(Math.PI/2-this.ra);

        const location_up = this.up;
        const xyz = this.view_to_ecef_q.apply3(this.vector_x).array;

        const angle = Math.atan2(xyz[1], xyz[0]) / this.deg2rad;

        const elevation = Math.asin(xyz[2] / (xyz[0]*xyz[0] + xyz[1]*xyz[1]) ) / this.deg2rad;

        this.compass_direction = angle;
        this.compass_elevation = 0;
        
        this.update_html_elements();
    }

    //mi update_html_elements
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
        this.star_catalog.set_view_needs_update();
    }
    
    //mp time_set
    /// Set the time-of-day to *now*
    time_set() {
        const date = new Date(Date.now());
        date.setUTCMonth(0,1);
        date.setUTCFullYear(1970);
        this.time_of_day = date.valueOf() / (60*60*1000);
        this.star_catalog.set_view_needs_update();
    }

    //mp update_latlon
    /// Update the view, because of a view change, time change, etc
    update_latlon(lat_lon) {
        window.log.add_log("info", "view_prop", "update", `Set Lat/Lon to ${180/Math.PI*lat_lon[0]},${180/Math.PI*lat_lon[1]}`);
        this.lat = lat_lon[0];
        this.lon = lat_lon[1];
        this.star_catalog.set_view_needs_update();
    }

    //mp view_q_post_mul
    view_q_post_mul(q) {
        this.view_to_ecef_q = this.view_to_ecef_q.mul(q);
        this.star_catalog.set_view_needs_update();
    }

    //mp view_q_pre_mul
    view_q_pre_mul(q) {
        this.view_to_ecef_q = q.mul(this.view_to_ecef_q);
        this.star_catalog.set_view_needs_update();
    }

}
