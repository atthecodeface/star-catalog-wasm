import { Draw } from "./draw.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
//a CompassCanvas
export class CalendarCanvas {
    //fp constructor
    constructor(star_catalog, canvas_div_id, width, height) {
        this.star_catalog = star_catalog;
        this.vp = this.star_catalog.vp;
        this.logger = new Logger(star_catalog.log, "calendar");
        this.styling = this.star_catalog.styling;
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
        this.width = width;
        this.height = height;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");
        this.mouse = new Mouse(this, this.canvas);
        this.logger.info(`Created calendar canvas`);
        const max_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const calendar_contents = [];
        for (let m = 0; m < 12; m++) {
            let my = Math.floor(m / 3);
            let mx = m - my * 3;
            for (let d = 0; d < max_days[m]; d++) {
                let dy = Math.floor(d / 7);
                let dx = d - dy * 7;
                calendar_contents.push(["R", mx * 30 + dx * 3, my * 22 + dy * 3, 2, 2]);
            }
        }
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
    user_press(_xy, _actions) { }
    user_press_move(_start_xy, _xy) { }
    user_press_cancel(_start_xy) { }
    user_release(_start_xy, _xy) { }
    user_zoom(_cxy, _factor) { }
    user_pan(_xy, _dxy) { }
    user_rotate(_xy, _angle) { }
    drag_start(_start_xy, _xy) { }
    drag_to(_start_xy, _old_xy, _new_xy) { }
    drag_end(_start_xy, _xy) { }
}
