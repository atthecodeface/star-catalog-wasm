import { MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";

import { Application } from "./application.js";
import { ViewProperties } from "./view_properties.js";

export class Earth {
  application: Application;
  vp: ViewProperties;
  logger: Logger;

  constructor(
    application: Application,
    _canvas_div_id: string,
    _width: number,
    _height: number,
    _use_webgl: boolean,
    _division: number,
  ) {
    this.application = application;
    this.vp = application.view_properties;
    this.logger = new Logger(application.log, "earth");
  }

  update() {
    this.vp.webgl_canvas_show_earth = true;
  }

  drag_start(_start_xy: [number, number], _xy: [number, number]): void {}
  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  drag_to(
    _start_xy: [number, number],
    old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    const dcx = old_xy[0] - new_xy[0];
    const dcy = old_xy[1] - new_xy[1];
    this.vp.earth.center_on_lat -= dcy;
    this.vp.earth.center_on_lon -= dcx;
    this.application.view_updated();
  }

  user_release(_start_xy: [number, number], cxy: [number, number]): void {
    const lat_lon = this.vp.earth.latlon_of_cxy(this.vp, cxy);
    if (lat_lon == null) {
      return;
    }
    this.vp.update_latlon(lat_lon[0], lat_lon[1]);
    console.log(lat_lon[0], lat_lon[1]);
    this.application.location_updated();
  }

  user_zoom(_cxy: [number, number], factor: number): void {
    if (factor < 1.0) {
      this.vp.earth.center_on_lon -= 1.0 / factor;
    } else {
      this.vp.earth.center_on_lon += factor;
    }
    this.application.view_updated();
  }
}
