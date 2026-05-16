//a Imports
import { WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf32, WasmQuatf64, } from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import { Names } from "./hipparcos.js";
import { Logger } from "./log.js";
//a Useful functions
//fi fract
function fract(x) {
    return x - Math.floor(x);
}
class ViewPropertiesHtml {
    constructor() {
        this.reload_links = [];
        this.lats = [];
        this.lons = [];
        this.elevs = [];
        this.times = [];
        this.dates = [];
        this.fovs = [];
        this.focal_lengths = [];
        this.magnitudes = [];
        this.reload_links = html.HtmlElement.all_of(".vp_sky_view_link");
        this.lats = html.HtmlElement.all_of(".vp_lat");
        this.lons = html.HtmlElement.all_of(".vp_lon");
        this.elevs = html.HtmlElement.all_of(".vp_elev");
        this.times = html.HtmlElement.all_of(".vp_time");
        this.dates = html.HtmlElement.all_of(".vp_date");
        this.fovs = html.HtmlElement.all_of(".vp_fov");
        this.focal_lengths = html.HtmlElement.all_of(".vp_focal_length");
        this.magnitudes = html.HtmlElement.all_of(".vp_magnitude");
    }
    populate(vp) {
        for (const e of this.reload_links) {
            e.clear()
                .add_ele("a")
                .add_content("Sky View Link")
                .add_tags([["href", vp.get_href()]]);
        }
        for (const e of this.lats) {
            e.clear().add_content(`Lat: ${vp.lat.toFixed(1)}`);
        }
        for (const e of this.lons) {
            e.clear().add_content(`Lon: ${vp.lon.toFixed(1)}`);
        }
        for (const e of this.elevs) {
            e.clear().add_content(`Elev: ${vp.observer_elevation.toFixed(1)}`);
        }
        for (const e of this.times) {
            e.clear().add_content(`UTC Time: ${vp.time_text(vp.time_of_day)}`);
        }
        for (const e of this.dates) {
            e.clear().add_content(vp.date_text(vp.days_since_epoch));
        }
        for (const e of this.fovs) {
            e.clear().add_content(`${(vp.fovh * vp.rad2deg).toFixed(1)}`);
        }
        for (const e of this.focal_lengths) {
            e.clear().add_content(`${(18 / vp.tan_hfovh).toFixed(2)}`);
        }
        for (const e of this.magnitudes) {
            e.clear().add_content(`${vp.brightness.toFixed(2)}`);
        }
    }
}
class VPEarth {
    constructor(vp) {
        this.q = new WasmQuatf32(0, 0, 0, 1);
        this.triangle_q_ll = new WasmQuatf32(0, 0, 0, 1);
        this.center_on_lat = vp.lat;
        this.center_on_lon = -vp.lon;
    }
    derive_data(vp) {
        if (this.center_on_lat < -80) {
            this.center_on_lat = -80;
        }
        if (this.center_on_lat > 80) {
            this.center_on_lat = 80;
        }
        if (this.center_on_lon < -180) {
            this.center_on_lon += 360;
        }
        if (this.center_on_lon > 180) {
            this.center_on_lon -= 360;
        }
        {
            const qy = WasmQuatf32.unit().rotate_y(this.center_on_lat * vp.deg2rad);
            const qz = WasmQuatf32.unit().rotate_z(this.center_on_lon * vp.deg2rad);
            this.q = qy.mul(qz);
        }
        {
            const qy = WasmQuatf32.unit().rotate_y(-vp.lat * vp.deg2rad);
            const qz = WasmQuatf32.unit().rotate_z(vp.lon * vp.deg2rad);
            this.triangle_q_ll = qz.mul(qy);
        }
    }
    center_lat_lon(lat, lon) {
        this.center_on_lat = lat;
        this.center_on_lon = -lon;
    }
    latlon_of_cxy(vp, cxy) {
        const w = vp.view_wh[0];
        const h = vp.view_wh[1];
        const view_scale = 0.9;
        // Convert the location cxy into a position on the *circle* that is the drawing of the earth
        const dx = ((cxy[0] - w / 2) / h / view_scale) * 2;
        const dy = ((h / 2 - cxy[1]) / h / view_scale) * 2;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 0.98) {
            return null;
        }
        // Convert to a roll/yaw on the sphere that the circle is a projection of
        const d = Math.sqrt(d2);
        const dz = Math.sqrt(1 - d2);
        const yaw = Math.atan2(d, dz);
        const roll = Math.atan2(dy, dx);
        // Convert the roll/yaw to a unit vector on the sphere
        const v = new WasmVec3f32(Math.cos(yaw), Math.sin(yaw) * Math.cos(roll), Math.sin(yaw) * Math.sin(roll));
        // Undo the orientation that mapped the earth to the last displayed earth image
        const world = this.q.conjugate().apply(v);
        // Extract the lat/lon of this
        const lat = vp.rad2deg * Math.asin(world.array[2]);
        const lon = vp.rad2deg * Math.atan2(world.array[1], world.array[0]);
        return [lat, lon];
    }
}
/**
 *
 */
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
    constructor(star_catalog, params) {
        this.view_wh = [0, 0];
        this.lat = 0;
        this.lon = 0;
        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;
        this.minute_of_hour = 0;
        /// Interval between animation steps; 0 implies no animation
        this.play_interval = 0;
        /// Number of seconds to add on each animation interval
        this.play_seconds = 0;
        this.show_azimuthal = false;
        this.show_equatorial = false;
        this.vector_x = new WasmVec3f64(1, 0, 0);
        this.vector_y = new WasmVec3f64(0, 1, 0);
        this.vector_z = new WasmVec3f64(0, 0, 1);
        this.observer_up_ecef_v = new WasmVec3f64(0, 0, 0);
        this.observer_we_ecef_v = new WasmVec3f64(0, 0, 0);
        this.observer_ns_ecef_v = new WasmVec3f64(0, 0, 0);
        this.view_ecef_center_dir = new WasmVec3f64(0, 0, 0);
        this.view_observer_center_dir = new WasmVec3f64(0, 0, 0);
        this.solar_sytem_orientation = WasmQuatf32.unit();
        this.solar_system_fovh = 0.9;
        this.ra = 0;
        this.de = 0;
        this.observer_compass = 0;
        this.observer_elevation = 0;
        this.mm_equiv = 0;
        this.fovh = 0;
        // this.tan_hfovh is what half the width is horizontally in tan space
        this.tan_hfovh = 0;
        this.brightness = 4;
        this.webgl_canvas_show_earth = false;
        this.star_catalog = star_catalog;
        this.catalog = star_catalog.catalog;
        this.current_styling = star_catalog.styling;
        this.wasm_memory = this.star_catalog.wasm_memory;
        this.log = star_catalog.log;
        this.view_properties = this;
        this.logger = new Logger(this.log, "view_prop");
        this.resizable_content_size = [100, 100];
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;
        this.max_stars_in_sky = 5000;
        this.vp_html = new ViewPropertiesHtml();
        const lat_param = params.get("lat");
        const lon_param = params.get("lon");
        const day_param = params.get("day");
        const time_param = params.get("time");
        const compass_param = params.get("compass");
        const elevation_param = params.get("elevation");
        let lat = null;
        let lon = null;
        if (lat_param !== null) {
            lat = parseFloat(lat_param);
        }
        if (lon_param !== null) {
            lon = parseFloat(lon_param);
        }
        if (lat !== null && isNaN(lat)) {
            lat = null;
        }
        if (lon !== null && isNaN(lon)) {
            lon = null;
        }
        if (lat === null || lon === null) {
            lat = 52;
            lon = 0;
            this.request_geolocation();
        }
        this.lat = lat;
        this.lon = lon;
        this.date = new Date();
        this.days_since_epoch = 19711;
        this.time_of_day = 18.377;
        this.date_set();
        this.time_set_to_now();
        if (day_param !== null) {
            this.days_since_epoch = parseInt(day_param);
        }
        if (time_param !== null) {
            this.time_of_day = parseFloat(time_param);
        }
        this.view_to_ecef_q = WasmQuatf64.unit();
        this.ecef_to_view_q = this.view_to_ecef_q.conjugate();
        this.ecef_to_observer_q = WasmQuatf64.unit();
        this.observer_to_ecef_q = WasmQuatf64.unit();
        this.fovh = Math.PI / 2;
        this.tan_hfovh = 0;
        this.earth = new VPEarth(this);
        this.derive_data();
        if (compass_param !== null) {
            this.observer_compass = parseFloat(compass_param);
        }
        if (elevation_param !== null) {
            this.observer_elevation = parseFloat(elevation_param);
        }
        this.view_observer_set(this.observer_compass * this.deg2rad, this.observer_elevation * this.deg2rad);
        this.earth_division = 8;
        this.earth_webgl = true;
        this.selected_star = null;
        this.update_latlon(this.lat, this.lon);
    }
    get_resizable_content_size() {
        return this.resizable_content_size;
    }
    set_resizable_content_size(wh) {
        this.resizable_content_size = wh;
    }
    styling() {
        return this.current_styling;
    }
    /**
     * Zoom, pan, etc requires the view to be updated
     */
    view_updated() {
        this.star_catalog.set_view_needs_update();
    }
    window_updated() {
        this.star_catalog.set_view_needs_update();
    }
    /**
     * Time, date, latitude, longitude, change requires view to be updated
     *
     * This includes the *observer* view direction etc
     */
    time_date_updated() {
        this.star_catalog.set_view_needs_update();
    }
    location_updated() {
        this.star_catalog.set_view_needs_update();
    }
    styling_updated() {
        this.star_catalog.set_view_needs_update();
    }
    observer_view_updated() {
        this.star_catalog.set_view_needs_update();
    }
    //mi request_geolocation
    request_geolocation() {
        const options = {
            enableHighAccuracy: false,
            maximumAge: 30000,
            timeout: 27000,
        };
        navigator.geolocation.getCurrentPosition(this.geolocation_position.bind(this), null, options);
    }
    //mi geolocation_position
    geolocation_position(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (lat !== null && !isNaN(lat)) {
            this.lat = lat;
        }
        if (lon !== null && !isNaN(lon)) {
            this.lon = lon;
        }
        this.update_latlon(this.lat, this.lon);
        this.earth.center_lat_lon(this.lat, this.lon);
        this.location_updated();
    }
    select_star(star) {
        if (star) {
            this.selected_star = star;
            this.update_html_star_info();
        }
        this.star_catalog.set_view_needs_update();
    }
    //mp compass_elevation_of_ecef
    //
    // The observed compass direction, elevation of an ECEF vector
    // requires mapping the viewer to the observer space
    //
    // The observed elevation is asin(z); the observed compass is atan2(y,x)
    compass_elevation_of_ecef(ecef_v) {
        const observer_v = this.ecef_to_observer_q.apply(ecef_v);
        const xyz = observer_v.array;
        // Note that if the ECEF is along +Y, then
        // it is *west* which is 90degrees anticlockwise
        //
        // Basically +compass angle is anticlockwise
        const compass = -Math.atan2(xyz[1], xyz[0]) * this.rad2deg;
        const elevation = Math.asin(xyz[2]) * this.rad2deg;
        return [compass, elevation];
    }
    map_mm_equiv_to_fovh(mm_equiv) {
        const tan_hfovh = 18 / mm_equiv;
        return 2 * Math.atan(tan_hfovh);
    }
    map_fovh_to_zoom(fovh) {
        const tan_hfovh = Math.tan(fovh / 2);
        const mm_equiv = 18 / tan_hfovh;
        const mm_equiv_0_1 = (mm_equiv - 14) / 86;
        // zoom is 0 to 100
        // mm_equiv is 14 to 100
        return 150 - 150 / (mm_equiv_0_1 * 2 + 1);
    }
    map_zoom_to_fovh(zoom) {
        const mm_equiv_0_1 = (150 / (150 - zoom) - 1) / 2;
        const mm_equiv = 86 * mm_equiv_0_1 + 14;
        const tan_hfovh = 18 / mm_equiv;
        return 2 * Math.atan(tan_hfovh);
    }
    //mp derive_de_ra
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_de_ra() {
        this.time_of_day = 24 * fract(this.time_of_day / 24.0);
        this.minute_of_hour = 60 * fract(this.time_of_day);
        if (this.lat > 90) {
            this.lat = 90;
        }
        if (this.lat < -90) {
            this.lat = -90;
        }
        if (this.lon > 180) {
            this.lon -= 360;
        }
        if (this.lon < -180) {
            this.lat += 360;
        }
        const de = this.lat * this.deg2rad;
        const ra_of_days = this.days_since_epoch * (366.25 / 365.25);
        // This magic constant seems to be about right
        const OFFSET = 100.4157224224 / 360;
        const ra_time = this.lon / 360 +
            fract(ra_of_days) +
            ((this.time_of_day / 24) * 366.25) / 365.25 +
            OFFSET;
        this.ra = fract(ra_time) * 2 * Math.PI;
        this.de = de;
    }
    //mp derive_observer_frame
    derive_observer_frame() {
        this.observer_up_ecef_v = this.vec_of_ra_de(this.ra, this.de);
        // Make v1 be star north - the north pole is +Z
        //
        // If at a pole, then at least make it non fragile
        var v1 = this.vector_z;
        const cos_ns = this.observer_up_ecef_v.dot(v1);
        if (cos_ns > 0.999 || cos_ns < -0.999) {
            v1 = this.vector_y;
        }
        // Create a right-handed set as north, west, p
        //
        // we = up x v1 normalized - i.e. up, (north-ish), we are a RHS
        //
        // ns = we x up
        //
        this.observer_we_ecef_v = this.observer_up_ecef_v
            .cross_product(v1)
            .normalize();
        this.observer_ns_ecef_v = this.observer_we_ecef_v
            .cross_product(this.observer_up_ecef_v)
            .normalize();
        //
        // console.log(this.observer_up_ecef_v.array, this.observer_ns_ecef_v.array, this.observer_we_ecef_v.array);
        // apply this to an observer vector to get an ECEF direction vector
        //
        // So applying this to (1,0,0) gives the ECEF direction that
        // is north-ward parallel to the horizon; apply this to
        // (0,0,1) to get the direction up from feet through the head
        // this.observer_to_ecef_q = this.ecef_to_observer_q.conjugate();
        this.ecef_to_observer_q = WasmQuatf64.unit()
            .rotate_z(Math.PI)
            .rotate_y(this.de - Math.PI / 2)
            .rotate_z(-this.ra);
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
        this.view_observer_center_dir = this.ecef_to_observer_q.apply(this.view_ecef_center_dir);
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
    //mp derive_data
    /// Derive data for the internals based on the time, date, lat and lon
    ///
    derive_data() {
        this.earth.derive_data(this);
        if (this.fovh > (Math.PI * 3) / 4) {
            this.fovh = (Math.PI * 3) / 4;
        }
        else if (this.fovh < 0.01) {
            this.fovh = 0.01;
        }
        this.tan_hfovh = Math.tan(this.fovh / 2);
        this.mm_equiv = 18 / this.tan_hfovh;
        this.show_azimuthal = html.get_input_checked("show_azimuthal");
        this.show_equatorial = html.get_input_checked("show_equatorial");
        this.ecef_to_view_q = this.view_to_ecef_q.conjugate();
        this.view_ecef_center_dir = this.view_to_ecef_q.apply(this.vector_x);
        this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);
        this.derive_de_ra();
        this.derive_observer_frame();
        this.update_html_elements();
    }
    get_href() {
        const lat_lon = `lat=${this.lat.toFixed(1)}&lon=${this.lon.toFixed(1)}`;
        const mode = `mode=${this.star_catalog.selected_css}`;
        const day_time = `day=${this.days_since_epoch.toFixed(0)}&time=${this.time_of_day.toFixed(4)}`;
        const compass_elevation = `compass=${this.observer_compass.toFixed(1)}&elevation=${this.observer_elevation.toFixed(1)}`;
        return `?${mode}&${lat_lon}&${day_time}&${compass_elevation}#tab-skyview`;
    }
    time_text(time_of_day) {
        const hour = Math.floor(time_of_day);
        const mins = (time_of_day - hour) * 60;
        const secs = (mins - Math.floor(mins)) * 60;
        const hour_s = ("00" + hour.toString()).slice(-2);
        const mins_s = ("00" + Math.floor(mins).toString()).slice(-2);
        const secs_s = ("00" + Math.floor(secs).toString()).slice(-2);
        return `${hour_s}:${mins_s}:${secs_s}`;
    }
    date_text(_days_since_epoch) {
        return this.date.toDateString();
    }
    update_html_star_info() {
        if (this.selected_star) {
            const star = this.star_catalog.catalog.star(this.selected_star);
            const e = document.getElementById("star_info");
            if (!e) {
                return;
            }
            const he = new html.HtmlElement(e);
            he.clear();
            const table = new html.Table("");
            const name = Names[star.id.toString()];
            const data = [];
            if (name !== null && name !== undefined) {
                data.push(["Name", name]);
            }
            else {
                data.push(["Name", "<unnamed>"]);
            }
            data.push(["Hip #", star.id.toString()]);
            data.push(["Mag", `${star.magnitude.toFixed(2)}`]);
            data.push(["Ra", `${(star.right_ascension * this.rad2deg).toFixed(2)}`]);
            data.push(["De", `${(star.declination * this.rad2deg).toFixed(2)}`]);
            for (const [h, t] of data) {
                table.add_headings([h]);
                table.add_body([t]);
            }
            he.add_content(table.as_vertical_html());
        }
    }
    /** Update HTML elements with date/time/lat/lon/elev/link */
    update_html_elements() {
        const e_zoom = document.getElementById("ctl_zoom");
        if (e_zoom !== null) {
            e_zoom.value = this.map_fovh_to_zoom(this.fovh).toString();
        }
        const e_mag = document.getElementById("ctl_magnitude");
        if (e_mag !== null) {
            e_mag.value = this.brightness.toString();
        }
        this.vp_html.populate(this);
    }
    /** Set the date to today */
    date_set() {
        const date = new Date(Date.now());
        date.setUTCHours(0, 0, 0);
        this.days_since_epoch = Math.round(date.valueOf() / (24 * 60 * 60 * 1000));
        this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);
        // Content change!
        this.time_date_updated();
    }
    /** Set the time-of-day to *now* */
    time_set_to_now() {
        const date = new Date(Date.now());
        date.setUTCMonth(0, 1);
        date.setUTCFullYear(1970);
        this.time_of_day = date.valueOf() / (60 * 60 * 1000);
        // Content change!
        this.time_date_updated();
    }
    /** Add to the time-of-day */
    time_add(hours, minutes, seconds) {
        let delta = hours + (minutes + seconds / 60) / 60;
        const days = Math.trunc(delta / 24);
        delta -= days * 24;
        this.time_of_day += delta;
        this.days_since_epoch += days;
        const elevation = this.observer_elevation * this.deg2rad;
        const compass = this.observer_compass * this.deg2rad;
        while (this.time_of_day < 0) {
            this.time_of_day += 24;
            this.days_since_epoch -= 1;
        }
        while (this.time_of_day > 24) {
            this.time_of_day -= 24;
            this.days_since_epoch += 1;
        }
        this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);
        if (true) {
            this.derive_de_ra();
            this.derive_observer_frame();
            this.view_observer_set(compass, elevation);
        }
        // Content change!
        this.time_date_updated();
    }
    /** Update the view, because of a view change, time change, etc */
    update_latlon(lat, lon) {
        this.lat = lat;
        this.lon = lon;
        this.log_latlon_update();
        // Content change!
        this.location_updated();
    }
    /**
     *  Record a change of lat/lon in the log
     */
    log_latlon_update() {
        const text = `${this.lat.toFixed(1)}, ${this.lon.toFixed(1)}`;
        const href = this.get_href();
        this.logger.info("update", `Set Lat/Lon to <a href='${href}'>${text}</a>`);
    }
    /**
     *  Record a change of time/date in the log
     */
    log_time_date_update() {
        const text = this.date_text(this.days_since_epoch) +
            " " +
            this.time_text(this.time_of_day);
        const href = this.get_href();
        this.logger.info("update", `Set time + date to <a href='${href}'>${text}</a>`);
    }
    /**
     *  Record a change of compass in the log
     */
    log_compass_elevation_update() {
        const text = `compass ${this.observer_compass.toFixed(1)}, elevation ${this.observer_elevation.toFixed(1)}`;
        const href = this.get_href();
        this.logger.info("update", `Set view to <a href='${href}'>${text}</a>`);
    }
    /**
     *  Change the observer compasee/elevation by the specified radians
     *
     * @param {number} delta_c Change in compass angle in radians
     * @param {number} delta_e Change in elevation angle in radians
     */
    view_observer_adjust(delta_c, delta_e) {
        const compass = this.observer_compass * 1 * this.deg2rad - delta_c;
        const elevation = (this.observer_elevation * 1 + 0) * this.deg2rad - delta_e;
        this.view_observer_set(compass, elevation);
    }
    /**
     *  Set the observer to have a compass direction and elevation it the current lat/lon
     *
     * @param {number} compass Angle to set the compass to in radians
     * @param {number} elevation Angle to set the observer elevation to in radians
     */
    view_observer_set(compass, elevation) {
        // Setting the viewer will indirectly set observer_elevation and observer_compass
        const q = WasmQuatf64.unit()
            .rotate_y(elevation)
            .rotate_z(compass)
            .mul(this.ecef_to_observer_q)
            .conjugate();
        this.view_observer_set_orientation(q);
    }
    /// Set the whole quaternion
    view_observer_set_orientation(q) {
        this.view_to_ecef_q = q;
        // Update the rest of the data after view_to_ecef_q
        this.derive_data();
        this.star_catalog.set_view_needs_update();
    }
    view_clock_hour_rotate(by_angle) {
        this.time_add((by_angle * 6) / Math.PI, 0, 0);
    }
    view_day_change(by_days) {
        this.days_since_epoch += by_days;
        this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);
        const elevation = this.observer_elevation * this.deg2rad;
        const compass = this.observer_compass * this.deg2rad;
        this.derive_de_ra();
        this.derive_observer_frame();
        this.view_observer_set(compass, elevation);
        this.star_catalog.set_view_needs_update();
    }
    view_q_post_mul(q) {
        this.view_to_ecef_q = this.view_to_ecef_q.mul(q);
        // Content change! ??
        this.time_date_updated();
    }
    view_q_pre_mul(q) {
        this.view_to_ecef_q = q.mul(this.view_to_ecef_q);
        // Content change! ??
        this.time_date_updated();
    }
    zoom_set() {
        const zoom = html.get_input_float("ctl_zoom", 0, 100);
        this.fovh = this.map_zoom_to_fovh(zoom);
        // Content change! ??
        this.time_date_updated();
    }
    brightness_set() {
        this.brightness = html.get_input_float("ctl_magnitude", 1, 12);
        // Content change!
        this.time_date_updated();
    }
    sky_view_center_on_ra_de(ra, de) {
        // Get new direction that is desired for the center of the view
        const ecef_v = this.vec_of_ra_de(ra, de);
        // Get quaternon to rotate current center of view to the desired center of view
        // const q = WasmQuatf64.rotation_of_vec_to_vec(this.vp.view_ecef_center_dir, new_qv);
        //
        // Add that rotation to the map camera
        // this.vp.view_q_pre_mul(q);
        const ce = this.compass_elevation_of_ecef(ecef_v);
        this.view_observer_set(ce[0] * this.deg2rad, ce[1] * this.deg2rad);
    }
    /// Set the zoom of the sky view window
    sky_view_zoom_by(factor) {
        this.fovh = 2 * Math.atan(factor * Math.tan(this.fovh / 2));
        // Content change ?!!
        this.time_date_updated();
    }
    /// Map a frame XY into a star unit direction vector
    sky_view_frame_to_ecef_set_vec(fx, fy, vec) {
        const vxyz = this.wasm_memory.float_array_of_vec3f64(vec);
        this.star_catalog.sky_canvas.set_vector_of_fxy(vxyz, [fx, fy]);
        vec.set_apply_q3(this.view_to_ecef_q);
    }
}
