//a Imports
import {WasmCatalog, WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import * as utils from "./utils.js";
import {Names} from "./hipparcos.js";

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
///  vector_x - unit vector (1,0,0)
///
///  vector_y - unit vector (0,1,0)
///
///  vector_z - unit vector (0,0,1)
///
///  up (derived) - vector from the center of the earth out through
///                 the feet of the observer (hence uses ra and de
///                 and is dependent on day/time/lat/lon)
///
///   q_looking_ns - quaternion mapping ECEF XYZ direction to
///      observer XYZ to ECEF XYZ direction; effectively a camera
///      at the observer horizontally pointed north. Apply this to
///      a star determine where it is relative to the observer;
///      apply the conjugate to map an observer position to ECEF,
///      such as for the azimuthal grid. Apply the conjugate to
///      (1,0,0) to show the compass heading and elevation
///
///  view_to_ecef_q - quaternion mapping the viewer's camera to ECEF. Apply
///     this to a viewer vector (such as where a star appears in the
///     viewer frame) to determine a direction in ECEF (such as where
///     that star actually is in the catalog)
///   
///  ecef_to_view_q (derived) - quaternion mapping ECEV to the viewer's
///     camera. Apply this to a star direction vector to determine
///     where in the view to draw the star.
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
    constructor(star_catalog, params) {
        this.star_catalog = star_catalog;
        
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;

        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;

        this.vector_x = new WasmVec3f64(1,0,0);
        this.vector_y = new WasmVec3f64(0,1,0);
        this.vector_z = new WasmVec3f64(0,0,1);

        this.lat = 52;
        this.lon = 0;

        let lat_param = parseFloat(params.get("lat"));
        let lon_param = parseFloat(params.get("lon"));
        if (lat_param!=null && !isNaN(lat_param)) {
            this.lat = lat_param;
        }
        if (lon_param!=null && !isNaN(lon_param)) {
            this.lon = lon_param;
        }

        this.days_since_epoch = 19711;
        this.time_of_day = 18.377;
        this.date_set();
        this.time_set();

        let day = parseInt(params.get("day"));
        let time_of_day = parseFloat(params.get("time"));
        if (day!=null && !isNaN(day)) {
            this.day = day;
        }
        if (time_of_day!=null && !isNaN(time_of_day)) {
            this.time_of_day = time_of_day;
        }

        this.view_to_ecef_q = WasmQuatf64.unit();

        this.derive_data();

        let compass = parseFloat(params.get("compass"));
        let elevation = parseFloat(params.get("elevation"));
        if (compass!=null && !isNaN(compass)) {
            this.observer_compass = compass;
        }
        if (elevation!=null && !isNaN(elevation)) {
            this.observer_elevation = elevation;;
        }
        this.view_observer_set(this.observer_compass * this.deg2rad, this.observer_elevation * this.deg2rad);

        this.earth_division = 8;
        this.earth_webgl = true;

        this.selected_star = null;

        this.update_latlon([this.lat, this.lon]);
    }

    //mp set_selected_star
    set_selected_star(star) {
        if (star) {
            this.selected_star = star;
            this.update_html_star_info();
        }
        this.star_catalog.set_view_needs_update();
    }

    //mp derive_de_ra
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_de_ra() {
        this.time_of_day = 24 * fract(this.time_of_day / 24.0);
        this.minute_of_hour = 60 * fract(this.time_of_day);
        
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
        this.derive_observer_frame();
        
        this.update_html_elements();
    }
    //mp derive_observer_frame
    derive_observer_frame() {
        this.observer_up_ecef_v = this.vec_of_ra_de(this.ra, this.de);

        // Make v1 be star north - the north pole is +Z
        //
        // If at a pole, then at least make it non fragile
        var v1 = this.vector_z;
        const cos_ns = this.observer_up_ecef_v.dot(v1);
        if ((cos_ns > 0.999)  || (cos_ns < -0.999)) {
            v1 = this.vector_y;
        }

        // Create a right-handed set as north, west, p
        //
        // we = up x v1 normalized - i.e. up, (north-ish), we are a RHS
        //
        // ns = we x up
        // 
        this.observer_we_ecef_v = this.observer_up_ecef_v.cross_product(v1).normalize();
        this.observer_ns_ecef_v = this.observer_we_ecef_v.cross_product(this.observer_up_ecef_v).normalize();
        //
        // console.log(this.observer_up_ecef_v.array, this.observer_ns_ecef_v.array, this.observer_we_ecef_v.array);

        // apply this to an observer vector to get an ECEF direction vector
        //
        // So applying this to (1,0,0) gives the ECEF direction that
        // is north-ward parallel to the horizon; apply this to
        // (0,0,1) to get the direction up from feet through the head
        // this.observer_to_ecef_q = this.ecef_to_observer_q.conjugate();
        this.ecef_to_observer_q = WasmQuatf64.unit().rotate_z(Math.PI).rotate_y(this.de - Math.PI/2).rotate_z(-this.ra);
        this.observer_to_ecef_q = this.ecef_to_observer_q.conjugate();

        // apply this to an ECEF direction vector to get an observer vector

        // Mapping the observer ECEF 'north' direction should yield (1,0,0)
        // 
        // Mapping the observer ECEF 'west' direction should yield (0,1,0)
        // 
        // Mapping the observer ECEF 'up' direction should yield (0,0,1)
        // console.log(this.ecef_to_observer_q.apply3(this.observer_ns_ecef_v).array);
        // console.log(this.ecef_to_observer_q.apply3(this.observer_we_ecef_v).array);
        // console.log(this.ecef_to_observer_q.apply3(this.observer_up_ecef_v).array);

        // The observed compass direction, elevation of the center of the
        // *viewer* requires mapping the viewer to the observer space
        // - so map the view_ecef_center_dir to observer
        //
        // The observed elevation is asin(z); the observed compass is atan2(y,x)
        this.view_observer_center_dir = this.ecef_to_observer_q.apply3(this.view_ecef_center_dir);

        const xyz = this.view_observer_center_dir.array;

        // Note that if the view_observer_center_dir is along +Y, then
        // it is *west* which is 90degrees anticlockwise
        //
        // Basically +compass angle is anticlockwise
        this.observer_compass = -Math.atan2(xyz[1], xyz[0]) * this.rad2deg;
        this.observer_elevation = Math.asin(xyz[2]) * this.rad2deg;

        // Another way to get the elevation - dot product the view ECEF with the observer UP ECEF
        // const ele = (Math.PI/2 - Math.acos(this.view_ecef_center_dir.dot(this.observer_up_ecef_v))) * this.rad2deg;
        // console.log(ele,y,z);

        // The 'twist' of the viewer is essentially how much they have rotated their head
        //
        // Starting staring towards north the observer rotates by the
        // compass about Z, then rotates by the elevation arbout Y,
        // and *then* must apply the rotation
        //
        // To determine the rotation we can generate the observer
        // 'untwisted head' quaternion, and 'subtract' that from the
        // viewer quaternion
        //
        // First generate ecef_to_observer_rotated_and_elevated, then divide it out of view_to_ecef_q
        // const qz = WasmQuatf64.unit().rotate_z(-Math.atan2(xyz[1], xyz[0]));
        // const qy = WasmQuatf64.unit().rotate_y(-Math.asin(xyz[2]));
        // const ecef_to_observer_rotated_and_elevated_q = qz.mul(qy.mul(this.ecef_to_observer_q));
        // const ecef_to_observer_rotated_and_elevated_q = this.ecef_to_observer_q.mul(qy).mul(qz);
        // const view_to_observer_rotated_and_elevated_q = this.view_to_ecef_q.mul(ecef_to_observer_rotated_and_elevated_q);
        // const mapped_x = view_to_observer_rotated_and_elevated_q.apply3(this.vector_x);
        // console.log(mapped_x.array);
    }        

    //mp update_html_star_info
    update_html_star_info() {
        if (this.selected_star) {
            const star = this.star_catalog.catalog.star(this.selected_star);
            const e = document.getElementById("star_info");
            const data = [];
            const name = Names[star.id];
            if ( name !== null && name !== undefined) {
                data.push(`Name: ${name}`);
            } else {
                data.push(`Name: <unnamed>`);
            }
            data.push(`Id: ${star.id}`);
            data.push(`Mag: ${(star.magnitude).toFixed(2)}`);
            data.push(`Ra: ${(star.right_ascension * this.rad2deg).toFixed(2)}`);
            data.push(`De: ${(star.declination * this.rad2deg).toFixed(2)}`);
            if (e) {
                html.clear(e);
                e.append(html.table([],[], [data]));
                                             
            }
        }
    }
    
    //mi update_html_elements
    update_html_elements() {
        html.if_ele_id("reload_link", this, function(e,v) {
            const a = document.createElement("a");
            const lat_lon = `lat=${v.lat.toFixed(1)}&lon=${v.lon.toFixed(1)}`;
            const mode = `mode=${v.star_catalog.selected_css}`;
            const day_time = `day=${v.days_since_epoch.toFixed(0)}&time=${v.time_of_day.toFixed(4)}`;
            const compass_elevation = `compass=${v.observer_compass.toFixed(1)}&elevation=${v.observer_elevation.toFixed(1)}`;
            a.setAttribute("href", `?${mode}&${lat_lon}&${day_time}&${compass_elevation}#tab-skyview`);
            a.innerText = "Sky View Link";
            html.clear(e);
            e.appendChild(a);
        });
        html.if_ele_id("lat", this.lat, function(e,v) {
            e.innerText = `Lat: ${v.toFixed(1)}`;
        });
        html.if_ele_id("lon", this.lon, function(e,v) {
            e.innerText = `Lon: ${v.toFixed(1)}`;
        });
        html.if_ele_id("ele", this.observer_elevation, function(e,v) {
            e.innerText = `Elev: ${v.toFixed(1)}`;
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

    //mp view_observer_adjust
    // Rotate by the specified radians
    view_observer_adjust(delta_c, delta_e) {
        const compass = (this.observer_compass * 1) * this.deg2rad - delta_c;
        const elevation = (this.observer_elevation * 1 + 0 ) * this.deg2rad - delta_e;
        this.view_observer_set(compass, elevation);
    }
    
    //mp view_observer_set
    // Rotate by the specified radians
    view_observer_set(compass, elevation) {
        // Setting the viewer will indirectly set observer_elevation and observer_compass
        this.view_to_ecef_q = WasmQuatf64.unit().rotate_y(elevation).rotate_z(compass).mul(this.ecef_to_observer_q).conjugate();

        // Update the rest of the data after view_to_ecef_q
        this.derive_data();
        this.star_catalog.set_view_needs_update();
    }
    
    //mp view_clock_hour_rotate
    view_clock_hour_rotate(by_angle) {
        const elevation = this.observer_elevation * this.deg2rad;
        const compass = this.observer_compass * this.deg2rad;

        this.time_of_day += by_angle * 6 / Math.PI;
        console.log(this.time_of_day);
        if (this.time_of_day < 0) {
            this.time_of_day += 24;
            this.days_since_epoch -= 1;
        }
        if (this.time_of_day > 24) {
            this.time_of_day -= 24;
            this.days_since_epoch += 1;
        }
        if (true) {
            this.derive_de_ra();
            this.derive_observer_frame();
            this.view_observer_set(compass,elevation);
        }            
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
