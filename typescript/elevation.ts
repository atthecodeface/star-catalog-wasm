import { Draw } from "./draw.js";
import { Mouse, MousePressActions } from "./mouse.js";
import { Logger } from "./log.js";
import { ViewProperties } from "./view_properties.js";
import { Styling } from "./styling.js";
import { StarCatalog } from "./star_catalog.js";

//a ElevationCanvas
export class ElevationCanvas {
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
  background: Draw;
  arrow: Draw;

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

    const cx = 0;
    const cy = this.height / 2;
    const radius = this.width * 0.95;
    let bg_contents = [["w", 2], ["b"], ["a", cx, cy, radius, -87, 87], ["s"]];
    const d2r = Math.PI / 180;
    for (let angle = 0; angle < 85; angle += 15) {
      const c = Math.cos(angle * d2r);
      const s = Math.sin(angle * d2r);
      bg_contents.push(
        ["m", cx + radius * c, cy - radius * s],
        ["L", -0.1 * radius * c, 0.1 * radius * s],
        ["m", cx + radius * c, cy + radius * s],
        ["L", -0.1 * radius * c, -0.1 * radius * s],
      );
    }
    bg_contents.push(["s"]);
    this.background = new Draw(bg_contents);

    this.arrow = Draw.arrow(0.9 * radius, 4);
    this.logger.info(`Created elevation canvas`);

    this.redraw();
  }

  //mp redraw
  redraw() {
    const ctx = this.ctx;
    ctx.save();

    const cx = 0;
    const cy = this.height / 2;
    // const radius = this.width * 0.95;
    // const d2r = Math.PI / 180;

    ctx.fillStyle = this.styling.elevation.canvas;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = this.styling.elevation.scale;
    this.background.draw(ctx, (x) => x);

    ctx.strokeStyle = this.styling.elevation.marker;
    Draw.set_transform(ctx, [cx, cy], null, this.vp.observer_elevation);
    this.arrow.draw(ctx, (x) => x);

    ctx.restore();
    return;
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
    old_xy: [number, number],
    new_xy: [number, number],
  ): void {
    let dy = (new_xy[1] - old_xy[1]) / this.width;

    this.vp.view_observer_adjust(0.0, (dy * Math.PI) / 2);
  }

  drag_end(_start_xy: [number, number], _xy: [number, number]): void {
    this.vp.log_compass_elevation_update();
  }
}
