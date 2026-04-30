//a Imports
import {
  WasmStar,
  WasmVec3f64,
  WasmQuatf64,
} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import { Names } from "./hipparcos.js";
import { Logger } from "./log.js";
import { StarCatalog } from "./star_catalog.js";

//a Useful functions
//fi fract
function fract(x: number) {
  return x - Math.floor(x);
}

class ViewPropertiesHtml {
  reload_links: html.HtmlElement[] = [];
  lats: html.HtmlElement[] = [];
  lons: html.HtmlElement[] = [];
  elevs: html.HtmlElement[] = [];
  times: html.HtmlElement[] = [];
  dates: html.HtmlElement[] = [];
  fovs: html.HtmlElement[] = [];
  focal_lengths: html.HtmlElement[] = [];
  magnitudes: html.HtmlElement[] = [];

  constructor() {
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

  populate(vp: ViewProperties) {
    for (const e of this.reload_links) {
      e.clear()
        .add_ele("a")
        .set_content("Sky View Link")
        .add_tags([["href", vp.get_href()]]);
    }

    for (const e of this.lats) {
      e.clear().set_content(`Lat: ${vp.lat.toFixed(1)}`);
    }
    for (const e of this.lons) {
      e.clear().set_content(`Lon: ${vp.lon.toFixed(1)}`);
    }
    for (const e of this.elevs) {
      e.clear().set_content(`Elev: ${vp.observer_elevation.toFixed(1)}`);
    }
    for (const e of this.times) {
      e.clear().set_content(`UTC Time: ${vp.time_text(vp.time_of_day)}`);
    }
    for (const e of this.dates) {
      e.clear().set_content(vp.date_text(vp.days_since_epoch));
    }
    for (const e of this.fovs) {
      e.clear().set_content(`${(vp.fovh * vp.rad2deg).toFixed(1)}`);
    }
    for (const e of this.focal_lengths) {
      e.clear().set_content(`${(18 / vp.tan_hfovh).toFixed(2)}`);
    }
    for (const e of this.magnitudes) {
      e.clear().set_content(`${vp.brightness.toFixed(2)}`);
    }
  }
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
  star_catalog: StarCatalog;
  logger: Logger;

  lat: number = 0;
  lon: number = 0;

  vec_of_ra_de: (ra: number, de: number) => WasmVec3f64;
  deg2rad: number = Math.PI / 180;
  rad2deg: number = 180 / Math.PI;

  days_since_epoch: number;
  time_of_day: number;
  minute_of_hour: number = 0;
  date: Date;

  max_stars_in_sky: number;

  vector_x: WasmVec3f64 = new WasmVec3f64(1, 0, 0);
  vector_y: WasmVec3f64 = new WasmVec3f64(0, 1, 0);
  vector_z: WasmVec3f64 = new WasmVec3f64(0, 0, 1);

  view_to_ecef_q: WasmQuatf64;
  ecef_to_view_q: WasmQuatf64;
  ecef_to_observer_q: WasmQuatf64;
  observer_to_ecef_q: WasmQuatf64;

  observer_up_ecef_v: WasmVec3f64 = new WasmVec3f64(0, 0, 0);
  observer_we_ecef_v: WasmVec3f64 = new WasmVec3f64(0, 0, 0);
  observer_ns_ecef_v: WasmVec3f64 = new WasmVec3f64(0, 0, 0);

  view_ecef_center_dir: WasmVec3f64 = new WasmVec3f64(0, 0, 0);
  view_observer_center_dir: WasmVec3f64 = new WasmVec3f64(0, 0, 0);

  ra: number = 0;
  de: number = 0;

  observer_compass: number = 0;
  observer_elevation: number = 0;

  fovh: number = 0;
  // this.tan_hfovh is what half the width is horizontally in tan space
  tan_hfovh: number = 0;
  brightness: number = 4;

  earth_division: number;
  earth_webgl: boolean;
  selected_star: number | null;

  vp_html: ViewPropertiesHtml;

  constructor(star_catalog: StarCatalog, params: URLSearchParams) {
    this.star_catalog = star_catalog;
    this.logger = new Logger(star_catalog.log, "view_prop");

    this.vec_of_ra_de = WasmStar.vec_of_ra_de;

    this.max_stars_in_sky = 5000;

    this.vp_html = new ViewPropertiesHtml();

    const lat_param = params.get("lat");
    const lon_param = params.get("lon");
    const day_param = params.get("day");
    const time_param = params.get("time");
    const compass_param = params.get("compass");
    const elevation_param = params.get("elevation");

    let lat: null | number = null;
    let lon: null | number = null;
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
    this.time_set();

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

    this.derive_data();

    if (compass_param !== null) {
      this.observer_compass = parseFloat(compass_param);
    }
    if (elevation_param !== null) {
      this.observer_elevation = parseFloat(elevation_param);
    }

    this.view_observer_set(
      this.observer_compass * this.deg2rad,
      this.observer_elevation * this.deg2rad,
    );

    this.earth_division = 8;
    this.earth_webgl = true;

    this.selected_star = null;

    this.update_latlon(this.lat, this.lon);
  }

  //mi request_geolocation
  request_geolocation() {
    const options = {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 27000,
    };
    navigator.geolocation.getCurrentPosition(
      this.geolocation_position.bind(this),
      null,
      options,
    );
  }

  //mi geolocation_position
  geolocation_position(position: GeolocationPosition) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    if (lat !== null && !isNaN(lat)) {
      this.lat = lat;
    }
    if (lon !== null && !isNaN(lon)) {
      this.lon = lon;
    }
    this.update_latlon(this.lat, this.lon);
    this.star_catalog.center_lat_lon(this.lat, this.lon);
  }

  //mp set_selected_star
  set_selected_star(star: number | undefined) {
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
  compass_elevation_of_ecef(ecef_v: WasmVec3f64) {
    const observer_v = this.ecef_to_observer_q.apply3(ecef_v);
    const xyz = observer_v.array;

    // Note that if the ECEF is along +Y, then
    // it is *west* which is 90degrees anticlockwise
    //
    // Basically +compass angle is anticlockwise
    const compass = -Math.atan2(xyz[1]!, xyz[0]!) * this.rad2deg;
    const elevation = Math.asin(xyz[2]!) * this.rad2deg;
    return [compass, elevation];
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
    const ra_time =
      this.lon / 360 +
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
    this.view_observer_center_dir = this.ecef_to_observer_q.apply3(
      this.view_ecef_center_dir,
    );

    const xyz = this.view_observer_center_dir.array;

    // Note that if the view_observer_center_dir is along +Y, then
    // it is *west* which is 90degrees anticlockwise
    //
    // Basically +compass angle is anticlockwise
    this.observer_compass = -Math.atan2(xyz[1]!, xyz[0]!) * this.rad2deg;
    this.observer_elevation = Math.asin(xyz[2]!) * this.rad2deg;

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
    if (this.fovh > (Math.PI * 3) / 4) {
      this.fovh = (Math.PI * 3) / 4;
    } else if (this.fovh < 0.01) {
      this.fovh = 0.01;
    }
    this.tan_hfovh = Math.tan(this.fovh / 2);

    const show_azimuthal = html.get_input_checked("show_azimuthal");
    this.star_catalog.styling.sky.show_azimuthal = show_azimuthal;
    this.star_catalog.styling.map.show_azimuthal = show_azimuthal;

    const show_equatorial = html.get_input_checked("show_equatorial");
    this.star_catalog.styling.sky.show_equatorial = show_equatorial;
    this.star_catalog.styling.map.show_equatorial = show_equatorial;

    this.ecef_to_view_q = this.view_to_ecef_q.conjugate();
    this.view_ecef_center_dir = this.view_to_ecef_q.apply3(this.vector_x);

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

  time_text(time_of_day: number) {
    const hour = Math.floor(time_of_day);
    const mins = (time_of_day - hour) * 60;
    const secs = (mins - Math.floor(mins)) * 60;

    const hour_s = ("00" + hour.toString()).slice(-2);
    const mins_s = ("00" + Math.floor(mins).toString()).slice(-2);
    const secs_s = ("00" + Math.floor(secs).toString()).slice(-2);
    return `${hour_s}:${mins_s}:${secs_s}`;
  }

  date_text(_days_since_epoch: number) {
    return this.date.toDateString();
  }

  update_html_star_info() {
    if (this.selected_star) {
      const star = this.star_catalog.catalog.star(this.selected_star)!;
      const e = document.getElementById("star_info");
      if (!e) {
        return;
      }
      const he = new html.HtmlElement(e);
      he.clear();
      const table = new html.Table("");

      type NameKey = keyof typeof Names;
      const name = Names[star.id.toString() as NameKey];
      const data = [];
      if (name !== null && name !== undefined) {
        data.push(["Name", name]);
      } else {
        data.push(["Name", "<unnamed>"]);
      }
      data.push(["Hip #", star.id.toString()]);
      data.push(["Mag", `${star.magnitude.toFixed(2)}`]);
      data.push(["Ra", `${(star.right_ascension * this.rad2deg).toFixed(2)}`]);
      data.push(["De", `${(star.declination * this.rad2deg).toFixed(2)}`]);
      for (const [h, t] of data) {
        table.add_headings([h!]);
        table.add_body([t!]);
      }
      he.set_content(table.as_vertical_html());
    }
  }

  /** Update HTML elements with date/time/lat/lon/elev/link */
  update_html_elements() {
    const e_zoom = document.getElementById("ctl_zoom");
    if (e_zoom !== null) {
      (e_zoom as HTMLInputElement).value = (
        this.fovh * this.rad2deg
      ).toString();
    }
    const e_mag = document.getElementById("ctl_magnitude");
    if (e_mag !== null) {
      (e_mag as HTMLInputElement).value = this.brightness.toString();
    }
    this.vp_html.populate(this);
  }

  /** Set the date to today */
  date_set() {
    const date = new Date(Date.now());
    date.setUTCHours(0, 0, 0);
    this.days_since_epoch = Math.round(date.valueOf() / (24 * 60 * 60 * 1000));
    this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);
    this.star_catalog.set_view_needs_update();
  }

  /** Set the time-of-day to *now* */
  time_set() {
    const date = new Date(Date.now());
    date.setUTCMonth(0, 1);
    date.setUTCFullYear(1970);
    this.time_of_day = date.valueOf() / (60 * 60 * 1000);
    this.star_catalog.set_view_needs_update();
  }

  /** Update the view, because of a view change, time change, etc */
  update_latlon(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    this.log_latlon_update();
    this.star_catalog.set_view_needs_update();
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
    const text =
      this.date_text(this.days_since_epoch) +
      " " +
      this.time_text(this.time_of_day);
    const href = this.get_href();
    this.logger.info(
      "update",
      `Set time + date to <a href='${href}'>${text}</a>`,
    );
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
  view_observer_adjust(delta_c: number, delta_e: number) {
    const compass = this.observer_compass * 1 * this.deg2rad - delta_c;
    const elevation =
      (this.observer_elevation * 1 + 0) * this.deg2rad - delta_e;
    this.view_observer_set(compass, elevation);
  }

  /**
   *  Set the observer to have a compass direction and elevation it the current lat/lon
   *
   * @param {number} compass Angle to set the compass to in radians
   * @param {number} elevation Angle to set the observer elevation to in radians
   */
  view_observer_set(compass: number, elevation: number) {
    // Setting the viewer will indirectly set observer_elevation and observer_compass
    this.view_to_ecef_q = WasmQuatf64.unit()
      .rotate_y(elevation)
      .rotate_z(compass)
      .mul(this.ecef_to_observer_q)
      .conjugate();

    // Update the rest of the data after view_to_ecef_q
    this.derive_data();
    this.star_catalog.set_view_needs_update();
  }

  view_clock_hour_rotate(by_angle: number) {
    const elevation = this.observer_elevation * this.deg2rad;
    const compass = this.observer_compass * this.deg2rad;

    this.time_of_day += (by_angle * 6) / Math.PI;

    if (this.time_of_day < 0) {
      this.time_of_day += 24;
      this.days_since_epoch -= 1;
    }
    if (this.time_of_day > 24) {
      this.time_of_day -= 24;
      this.days_since_epoch += 1;
    }
    this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);

    if (true) {
      this.derive_de_ra();
      this.derive_observer_frame();
      this.view_observer_set(compass, elevation);
    }
    this.star_catalog.set_view_needs_update();
  }

  view_day_change(by_days: number) {
    this.days_since_epoch += by_days;
    this.date.setTime(this.days_since_epoch * 24 * 60 * 60 * 1000);

    const elevation = this.observer_elevation * this.deg2rad;
    const compass = this.observer_compass * this.deg2rad;
    this.derive_de_ra();
    this.derive_observer_frame();
    this.view_observer_set(compass, elevation);
    this.star_catalog.set_view_needs_update();
  }

  view_q_post_mul(q: WasmQuatf64) {
    this.view_to_ecef_q = this.view_to_ecef_q.mul(q);
    this.star_catalog.set_view_needs_update();
  }

  view_q_pre_mul(q: WasmQuatf64) {
    this.view_to_ecef_q = q.mul(this.view_to_ecef_q);
    this.star_catalog.set_view_needs_update();
  }

  zoom_set() {
    const zoom = html.get_input_float("ctl_zoom", 1, 120);
    this.fovh = zoom * this.deg2rad;
    this.star_catalog.set_view_needs_update();
  }

  brightness_set() {
    this.brightness = html.get_input_float("ctl_magnitude", 1, 12);
    this.star_catalog.set_view_needs_update();
  }
}
