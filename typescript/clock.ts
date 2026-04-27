import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Styling } from "./styling.js";
import { StarCatalog } from "./star_catalog.js";

//a ClockCanvas
export class ClockCanvas {
  star_catalog: StarCatalog;
  vp: ViewProperties;
  logger: Logger;
  div: HTMLElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  mouse: Mouse;
  background: Draw;
  sun: Draw;
  hour_hand: Draw;
  minute_hand: Draw;
  styling: Styling;

  last_drag_polar: [number, number] = [0, 0];
  drag_minutes: boolean = false;

  constructor(
    star_catalog: StarCatalog,
    canvas_div_id: string,
    width: number,
    height: number,
  ) {
    this.star_catalog = star_catalog;
    this.vp = this.star_catalog.vp;
    this.logger = new Logger(star_catalog.log, "clock");

    this.div = document.getElementById(canvas_div_id)!;
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);
    this.styling = this.star_catalog.styling;

    this.width = width;
    this.height = height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d")!;

    this.mouse = new Mouse(this, this.canvas);

    const radius = this.width * 0.45;
    const sun_radius = this.width * 0.035;
    let bg_contents = [
      ["t", this.width / 2, this.height / 2],
      ["push"],
      ["b"],
      ["c", 0, 0, radius],
      ["F", "rim"],
      ["f"],
      ["b"],
      ["c", 0, 0, radius * 0.9],
      ["F", "face"],
      ["f"],
      ["pop"],
      ["push"],
      ["t", -radius * 0.75, -radius * 0.75],
      ["b"],
      ["a", 0, 0, radius * 0.25, 135, -45],
      ["F", "rim"],
      ["f"],
      ["pop"],
      ["push"],
      ["t", radius * 0.75, -radius * 0.75],
      ["b"],
      ["a", 0, 0, radius * 0.25, -135, 45],
      ["F", "rim"],
      ["f"],
      ["pop"],
    ];

    const sun_s = 1.2;
    const sun_l = 0.8;
    let sun_contents = [
      ["push"],
      ["sc", sun_radius, sun_radius],
      ["t", -4.0, 0.0],
      ["b"],
      ["c", 0, 0, 1.0],
      ["F", "moon"],
      ["f"],
      ["pop"],
      ["push"],
      ["sc", sun_radius, sun_radius],
      ["t", 4.0, 0.0],
      ["b"],
      ["c", 0, 0, 1.0],
      ["F", "sun"],
      ["f"],
      ["b"],
      ["w", 1 / sun_radius],
      ["m", 0, sun_s],
      ["L", 0, sun_l],
      ["m", 0, -sun_s],
      ["L", 0, -sun_l],
      ["m", sun_s, 0],
      ["L", sun_l, 0],
      ["m", -sun_s, 0],
      ["L", -sun_l, 0],
      ["m", sun_s * 0.7, sun_s * 0.7],
      ["L", sun_l * 0.7, sun_l * 0.7],
      ["m", -sun_s * 0.7, -sun_s * 0.7],
      ["L", -sun_l * 0.7, -sun_l * 0.7],
      ["m", -sun_s * 0.7, sun_s * 0.7],
      ["L", -sun_l * 0.7, sun_l * 0.7],
      ["m", sun_s * 0.7, -sun_s * 0.7],
      ["L", sun_l * 0.7, -sun_l * 0.7],
      ["S", "sun"],
      ["s"],
      ["pop"],
    ];

    this.background = new Draw(bg_contents);
    this.sun = new Draw(sun_contents);
    this.hour_hand = Draw.arrow(radius * 0.4);
    this.minute_hand = Draw.arrow(radius * 0.8);

    this.logger.info(`Created clock canvas`);
    this.redraw();
  }

  //mp redraw
  redraw() {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = this.styling.clock.canvas;
    ctx.fillRect(0, 0, this.width, this.height);

    const style = this.styling;

    ctx.save();
    this.background.draw(ctx, (x) => (style as any)[x]);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height / 2);
    ctx.clip();
    Draw.set_transform(
      ctx,
      [this.width / 2, this.height / 2],
      null,
      270 - this.vp.time_of_day * 15,
    );
    this.sun.draw(ctx, (x) => (style as any)[x]);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = this.styling.clock.minute;
    Draw.set_transform(
      ctx,
      [this.width / 2, this.height / 2],
      null,
      90 - this.vp.minute_of_hour * 6,
    );
    this.minute_hand.draw(ctx, (x) => (style as any)[x]);
    ctx.restore();

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = this.styling.clock.hour;
    Draw.set_transform(
      ctx,
      [this.width / 2, this.height / 2],
      null,
      90 - this.vp.time_of_day * 30,
    );
    this.hour_hand.draw(ctx, (x) => (style as any)[x]);
    ctx.restore();
  }

  //mp update
  /// Invoked to purely update the state
  update() {
    this.redraw();
  }

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
    this.drag_minutes = this.last_drag_polar[0] > this.width * 0.3;
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
    if (this.drag_minutes) {
      da /= 12;
    }

    this.last_drag_polar = d_ra;

    this.vp.view_clock_hour_rotate(da);
  }

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {
    this.vp.log_time_date_update();
  }
}
