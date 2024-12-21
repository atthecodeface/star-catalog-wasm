//a Imports
import init, {WasmCatalog, WasmStar, WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import {Log} from "./log.js";
import * as html from "./html.js";
import * as utils from "./utils.js";
import * as map from "./map_canvas.js";
import * as sky from "./sky_canvas.js";
import * as earth from "./earth.js";

function fract(x) {
    return x - Math.floor(x);
}

class StylingNight {

    sky = {azimuthal_grid: "#772222",
           equatorial_grid: "#771155",
           ecliptic: "#552255",
           meridian: "#552255",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#552222", "#993333",],
           equatorial_grid: "#771155",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    earth = {color:[1.0,0,0,0.7],
            };

    css = "night";
    show_azimuthal = true;
    show_equatorial = true;
}
class StylingDay {

    sky = {azimuthal_grid: "#ff2222",
           equatorial_grid: "#229922",
           ecliptic: "#552255",
           meridian: "#552255",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#ff2222", "#ff5555",],
           equatorial_grid: "#229922",
           view_border: ["#ff6666", "#6666ff66", "#66ff66", "#6666ff66"],
          };

    earth = {color:[1,1,1,1],
            };

    css = "day";

    show_azimuthal = true;
    show_equatorial = true;
}

class Styling {
    constructor() {
        this.map = {};
        this.sky = {};
        this.set("night");
        this.sky.show_equatorial = false;
        this.sky.show_azimuthal = false;
        this.map.show_equatorial = false;
        this.map.show_azimuthal = false;

        this.sky["show_equatorial"] = true;
        this.sky["show_azimuthal"] = true;
        this.map["show_equatorial"] = true;
        this.map["show_azimuthal"] = true;

        console.log(this);
    }
    set(mode) {
        if (mode == "day") {
            this.set_styling_class(StylingDay);
        } else {
            this.set_styling_class(StylingNight);
        }
    }
    set_styling_class(styling_class) {
        this.base_styling = new styling_class();
        this.map = Object.assign(this.map, this.base_styling.map);
        this.sky = Object.assign(this.sky, this.base_styling.sky);
        this.earth = Object.assign({}, this.base_styling.earth);
        this.css = this.base_styling.css;
        this.set_css();
    }
    set_css() {
        for (const e of document.getElementsByClassName("dn")) {
            var new_class_name = ""
            for (const c of e.getAttribute("class").split(' ')) {
                if (c=="dn") {
                    break;
                }
                new_class_name += c + " ";
            }
            e.setAttribute("class", new_class_name + "dn " + this.css);
        }
    }
}
class StarCatalog {
    constructor() {
        this.WasmCatalog = WasmCatalog;
        this.WasmStar = WasmStar;
        this.vec_of_ra_de = WasmStar.vec_of_ra_de;
        this.catalog = new WasmCatalog("hipp_bright");

        this.styling = new Styling();
        
        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;

        this.lat = 52;
        this.lon = 0;

        this.days_since_epoch = 19711;
        this.time_of_day = 18.377;

        this.sky_canvas = new sky.SkyCanvas(this, this.catalog, "SkyCanvas",800,400);
        this.map_canvas = new map.MapCanvas(this, this.catalog, "MapCanvas",800,300);
        const earth_division = 8;
        const earth_webgl = true;
        this.earth_canvas = new earth.Earth(this, "EarthCanvas", 800, 400, earth_webgl, earth_division);

        this.selected_tab_changed();
        this.selected_css_changed();        
        this.date_set();
        this.time_set();
        this.update_latlon([this.lat, this.lon]);

    }

    set_styling() {
        this.force_update();
    }
    
    derive_data() {
        for (const style of ["show_azimuthal", "show_equatorial"]) {
            this.styling.sky[style] = (document.querySelector(`input[name=${style}]:checked`) != null);
            this.styling.map[style] = (document.querySelector(`input[name=${style}]:checked`) != null);
        }

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
    
    selected_css_changed() {
        this.selected_css = document.querySelector('input[name=selected_css]:checked').value;
        this.styling.set(this.selected_css);
        this.force_update();
    }
    
    selected_tab_changed() {
        this.selected_tab = document.querySelector('input[name=selected_tab]:checked').value;
        const log = document.getElementById("Log");
        if (this.selected_tab == "earth") {
            log.style.display = "none";
            this.map_canvas.div.style.display = "none";
            this.earth_canvas.div.style.display = "block";
        } else if (this.selected_tab == "log") {
            log.style.display = "block";
            this.map_canvas.div.style.display = "none";
            this.earth_canvas.div.style.display = "none";
        } else {
            log.style.display = "none";
            this.map_canvas.div.style.display = "block";
            this.earth_canvas.div.style.display = "none";
        }
    }
    date_set() {
        const date = new Date(Date.now());
        date.setUTCHours(0,0,0);
        this.days_since_epoch = Math.round(date.valueOf() / (24*60*60*1000));
        this.derive_data();
        this.update_view();
    }
    time_set() {
        const date = new Date(Date.now());
        date.setUTCMonth(0,1);
        date.setUTCFullYear(1970);
        this.time_of_day = date.valueOf() / (60*60*1000);
        this.derive_data();
        this.update_view();
    }

    update_view() {
        this.sky_canvas.update();
        this.map_canvas.update();
    }
    update_latlon(lat_lon) {
        window.log.add_log("info", "star", "update", `Set Lat/Lon to ${180/Math.PI*lat_lon[0]},${180/Math.PI*lat_lon[1]}`);
        this.lat = lat_lon[0];
        this.lon = lat_lon[1];
        this.force_update();
    }
    force_update() {
        this.derive_data();
        this.sky_canvas.update();
        this.map_canvas.update();
        this.earth_canvas.update();
    }
    center_sky_view(ra_de) {
        this.sky_canvas.center(ra_de);
    }
    sky_view_vector_of_fxy(fxy) {
        const v = this.sky_canvas.vector_of_fxy(fxy);
        return this.sky_canvas.q.apply3(v);
    }
    sky_view_brightness_set() {
        this.sky_canvas.brightness_set();
    }
    sky_view_zoom_set() {
        this.sky_canvas.zoom_set();
    }
}

function complete_init() {
    window.log = new Log(document.getElementById("Log"));
    window.star_catalog = new StarCatalog();
}

//a Top level on load
window.addEventListener("load", (e) => {
    init().then(() => {
        complete_init();
    }
               )});
