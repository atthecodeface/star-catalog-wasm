import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { StarCatalog } from "./star_catalog.js";
import { Styling } from "./styling.js";
import { ViewProperties } from "./view_properties.js";

//a CompassCanvas
export class CalendarCanvas {
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

  calendar_draw: Draw;

  //fp constructor
  constructor(
    star_catalog: StarCatalog,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.star_catalog = star_catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "calendar");
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

    this.logger.info(`Created calendar canvas`);

    // Not leap years...
    const max_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const day_ofs = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const calendar_contents = [];
    let year_day_ofs = 3;
    for (let m = 0; m < 12; m++) {
      let my = Math.floor(m / 3);
      let mx = m - my * 3;
      let md = day_ofs[m]! + year_day_ofs;
      md = md - 7 * Math.floor(md / 7);
      for (let d = 0; d < max_days[m]!; d++) {
        let d_of_w = d + md;
        let dy = Math.floor(d_of_w / 7);
        let dx = d_of_w - dy * 7;
        calendar_contents.push(["R", mx * 30 + dx * 3, my * 22 + dy * 3, 2, 2]);
      }
    }
    console.log(calendar_contents);
    this.calendar_draw = new Draw(calendar_contents);
    this.redraw();
  }

  //mp redraw
  //
  redraw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "red";
    this.calendar_draw.draw(ctx, (a) => a);
    ctx.fillStyle = "";
    ctx.restore();
  }

  //mp update
  /// Invoked to purely update the state
  update() {
    this.redraw();
    // this.styling = this.star_catalog.styling.map;
  }

  user_press(_xy: [number, number], _actions: MousePressActions): void {}
  user_press_move(_start_xy: [number, number], _xy: [number, number]): void {}
  user_press_cancel(_start_xy: [number, number]): void {}
  user_release(_start_xy: [number, number], _xy: [number, number]): void {}
  user_zoom(_cxy: [number, number], _factor: number): void {}
  user_pan(_xy: [number, number], _dxy: [number, number]): void {}
  user_rotate(_xy: [number, number], _angle: number): void {}

  drag_start(_start_xy: [number, number], _xy: [number, number]): void {}

  drag_to(
    _start_xy: [number, number],
    _old_xy: [number, number],
    _new_xy: [number, number],
  ): void {}

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {}
}
