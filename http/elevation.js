import { Draw } from "../javascript/draw.js";
import { Mouse } from "../javascript/mouse.js";

//a ElevationCanvas
export class ElevationCanvas {
  //fp constructor
  constructor(star_catalog, canvas_div_id, width, height) {
    this.star_catalog = star_catalog;
    this.vp = this.star_catalog.vp;

    this.div = document.getElementById(canvas_div_id);
    this.canvas = document.createElement("canvas");
    this.div.appendChild(this.canvas);

    this.width = width;
    this.height = height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");

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

    this.redraw();
  }

  //mp redraw
  redraw() {
    this.styling = this.star_catalog.styling.elevation;
    const ctx = this.ctx;
    ctx.save();

    const cx = 0;
    const cy = this.height / 2;
    const radius = this.width * 0.95;

    const d2r = Math.PI / 180;

    ctx.fillStyle = this.styling.canvas;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = this.styling.scale;
    this.background.draw(ctx);

    ctx.strokeStyle = this.styling.marker;
    Draw.set_transform(ctx, [cx, cy], null, this.vp.observer_elevation);
    this.arrow.draw(ctx);

    ctx.restore();
    return;
  }

  //mp update
  /// Invoked to purely update the state
  update() {
    this.redraw();
    // this.styling = this.star_catalog.styling.map;
  }

  // drag_start(_start_xy, xy) {}
  // drag_to(_start_xy, _old_xy, new_xy) {}
  // drag_end(_start_xy, _xy) {}

  user_press(_xy, _actions) {}
  user_press_move(_start_xy, _xy) {}
  user_press_cancel(_start_xy) {}
  user_release(_start_xy, xy) {}
  user_zoom(cxy, factor) {}
  user_pan(_xy, dxy) {}
  user_rotate(_xy, _angle) {}

  drag_start(_start_xy, xy) {
    this.drag_xy = xy;
  }

  drag_to(_start_xy, _old_xy, new_xy) {
    let dy = (new_xy[1] - this.drag_xy[1]) / this.width;
    this.drag_xy = new_xy;

    this.vp.view_observer_adjust(0.0, (dy * Math.PI) / 2);
  }

  drag_end(_start_xy, _xy) {
    this.vp.log_compass_elevation_update();
  }
}
