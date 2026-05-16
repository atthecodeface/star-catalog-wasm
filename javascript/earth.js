import { Logger } from "./log.js";
export class Earth {
    constructor(application, _canvas_div_id, _width, _height, _use_webgl, _division) {
        this.application = application;
        this.vp = application.view_properties;
        this.logger = new Logger(application.log, "earth");
    }
    update() {
        this.vp.webgl_canvas_show_earth = true;
    }
    drag_start(_start_xy, _xy) { }
    drag_end(_start_xy, _xy) { }
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_pan(_xy, _dxy) { }
    user_rotate(_xy, _angle) { }
    drag_to(_start_xy, old_xy, new_xy) {
        const dcx = old_xy[0] - new_xy[0];
        const dcy = old_xy[1] - new_xy[1];
        this.vp.earth.center_on_lat -= dcy;
        this.vp.earth.center_on_lon -= dcx;
        this.application.view_updated();
    }
    user_release(_start_xy, cxy) {
        const lat_lon = this.vp.earth.latlon_of_cxy(this.vp, cxy);
        if (lat_lon == null) {
            return;
        }
        this.vp.update_latlon(lat_lon[0], lat_lon[1]);
        console.log(lat_lon[0], lat_lon[1]);
        this.application.location_updated();
    }
    user_zoom(_cxy, factor) {
        if (factor < 1.0) {
            this.vp.earth.center_on_lon -= 1.0 / factor;
        }
        else {
            this.vp.earth.center_on_lon += factor;
        }
        this.application.view_updated();
    }
}
