import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { StarCatalog } from "./star_catalog.js";
import { Styling } from "./styling.js";
import { ViewProperties } from "./view_properties.js";

//a CompassCanvas
export class CompassCanvas {
  star_catalog: StarCatalog;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  mouse: Mouse;
  styling: Styling;

  last_drag_polar: [number, number] = [0, 0];
  drag_minutes: boolean = false;
  //fp constructor
  constructor(
    star_catalog: StarCatalog,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.star_catalog = star_catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "compass");
    this.styling = this.star_catalog.styling;

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = width;
    this.height = height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d")!;

    this.mouse = new Mouse(this, this.canvas);

    this.logger.info(`Created compass canvas`);
    this.redraw();
  }

  //mp redraw
  //
  // The observer_compass value indicates the angle of view; -45
  // means the view is North-West
  //
  // If the observer compass value is -45, then the actual compass
  // should be drawn rotated clockwise by 45 degrees
  //
  // The compass is drawn with dashes every 15 degrees, with a long
  // every 90 degress and even longer at 0 degrees
  //
  // The canvas has +Y right, +Y down...
  //
  // If the compass-in-canvas is written as a circle starting at 0
  // degrees on the X axis, and goes clockwise (because +canvas Y is
  // down..., i.e. is drawn cos(theta), sin(theta)) then that needs
  // to be transformed by rotating it by 90 degrees (to account for
  // the angle offset) plus the observer compass (since the canvas
  // is upside down this inverts the rotation)
  redraw() {
    const ctx = this.ctx;
    ctx.save();

    const color = this.styling.compass.body;
    const base_color = this.styling.compass.bg;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const y_squash = 0.3;

    ctx.fillStyle = this.styling.compass.canvas;
    ctx.fillRect(0, 0, this.width, this.height);

    const radius = this.width * 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8.0;
    ctx.fillStyle = base_color;
    for (let i = 20; i >= 0; i -= 4) {
      ctx.setTransform(1, 0, 0, y_squash, cx, cy + i);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      if (i == 0) {
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.height / 10);
    ctx.strokeStyle = this.styling.compass.markers;
    ctx.lineWidth = 4.0;
    ctx.stroke();

    const d2r = Math.PI / 180;
    const c = Math.cos((this.vp.observer_compass + 90) * d2r);
    const s = Math.sin((this.vp.observer_compass + 90) * d2r);
    ctx.setTransform(c, -s * y_squash, s, c * y_squash, cx, cy);

    ctx.strokeStyle = this.styling.compass.markers;
    ctx.lineWidth = 4.0;
    for (let angle = 0; angle < 360; angle += 15) {
      const c = Math.cos(angle * d2r);
      const s = Math.sin(angle * d2r);
      ctx.beginPath();
      let l = 0.8;
      if (angle % 90 == 0) {
        l = 0.65;
      }
      if (angle == 0) {
        l = 0.4;
      }
      ctx.moveTo(radius * l * c, radius * l * s);
      ctx.lineTo(radius * 0.9 * c, radius * 0.9 * s);
      ctx.stroke();
    }

    ctx.fillStyle = "";
    ctx.restore();
  }

  //mp update
  /// Invoked to purely update the state
  update() {
    this.redraw();
    // this.styling = this.star_catalog.styling.map;
  }

  //mi drag_polar
  //
  // This is +-PI at X=-1, Y=0; 0 at X=1, Y=0
  drag_polar(xy: [number, number]): [number, number] {
    const dy = xy[1] - this.height / 2;
    const dx = xy[0] - this.width / 2;
    return [Math.sqrt(dx * dx + dy * dy), Math.atan2(dy, dx)];
  }

  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_release(_start_xy: [number, number], _xy: [number, number]): void {}
  user_zoom(_cxy: [number, number], _factor: number): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  drag_start(_start_xy: [number, number], xy: [number, number]): void {
    this.last_drag_polar = this.drag_polar(xy);
  }

  drag_to(
    _start_xy: [number, number],
    _old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    const d_ra = this.drag_polar(new_xy);

    let da = d_ra[1] - this.last_drag_polar[1];
    if (da < -Math.PI) {
      da += Math.PI * 2;
    }
    if (da > Math.PI) {
      da -= Math.PI * 2;
    }
    this.last_drag_polar = d_ra;

    this.vp.view_observer_adjust(da, 0.0);
  }

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {
    this.vp.log_compass_elevation_update();
  }
}
