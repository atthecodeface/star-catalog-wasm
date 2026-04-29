import { Draw } from "./draw.js";
import { Mouse } from "./mouse.js";
import { Logger } from "./log.js";
class CalendarMonthDraw {
    /**
     *
     * @param year
     * @returns
     */
    constructor(month, year) {
        this.days_of_months_nl = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        this.day_ofs_of_month_nl = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        this.days_of_months_ly = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        this.day_ofs_of_month_ly = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        this.day_width = 12;
        this.day_height = 10;
        this.day_xs = 10;
        this.day_ys = 8;
        const year_is_multiple_four = year % 4 == 0;
        const year_is_century = year % 1000 == 0;
        const year_is_quadcentury = year % 1000 == 0;
        const leap_year = year_is_multiple_four && (year_is_quadcentury || !year_is_century);
        let x = new Date(0);
        x.setFullYear(year);
        x.setMonth(month, 1);
        let month_day_ofs = x.getDay();
        let max_days = this.days_of_months_nl;
        if (leap_year) {
            max_days = this.days_of_months_nl;
        }
        const calendar_contents = [];
        let md = month_day_ofs;
        md = md % 7;
        for (let d = 0; d < max_days[month]; d++) {
            let d_of_w = d + md;
            let dx = d_of_w % 7;
            let dy = (d_of_w - dx) / 7;
            calendar_contents.push([
                "R",
                dx * this.day_width,
                dy * this.day_height,
                this.day_xs,
                this.day_ys,
            ]);
        }
        this.month = month;
        this.year = year;
        this.draw_obj = new Draw(calendar_contents);
    }
    draw() {
        return this.draw_obj;
    }
    /** day is 1-31 */
    circle_day(day) {
        let x = new Date(0);
        x.setFullYear(this.year);
        x.setMonth(this.month, 1);
        let month_day_ofs = x.getDay();
        const d_of_w = month_day_ofs + (day - 1);
        let dx = d_of_w % 7;
        let dy = (d_of_w - dx) / 7;
        const calendar_contents = [];
        calendar_contents.push([
            "R",
            dx * this.day_width,
            dy * this.day_height,
            this.day_xs,
            this.day_ys,
        ]);
        return new Draw(calendar_contents);
    }
    static month_day_ofs(month, year) {
        let x = new Date(0);
        x.setFullYear(year);
        x.setMonth(month, 1);
        return x.getDay();
    }
    /** Return day in 1..31 */
    select_day(cxy) {
        const month_day_ofs = CalendarMonthDraw.month_day_ofs(this.month, this.year);
        let x = cxy[0] - this.day_xs / 2;
        let y = cxy[1] - this.day_ys / 2;
        x = Math.round(x / this.day_width);
        y = Math.round(y / this.day_height);
        if (x < 0 || x > 7) {
            return null;
        }
        let day = x + y * 7 - month_day_ofs;
        if (day < 0 || day > 30) {
            return null;
        }
        return day + 1;
    }
}
//a CalendarCanvas
export class CalendarCanvas {
    //fp constructor
    constructor(star_catalog, canvas_div_id, width, height) {
        this.calendar_cache = new Map();
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
        this.calendar_cache = new Map();
        this.redraw();
    }
    draw_of_month(month, year) {
        const key = year * 12 + month;
        const m = this.calendar_cache.get(key);
        if (m !== undefined) {
            return m;
        }
        if (this.calendar_cache.size > 50) {
            this.calendar_cache.clear();
        }
        const draw = new CalendarMonthDraw(month, year);
        this.calendar_cache.set(key, draw);
        return draw;
    }
    //mp redraw
    //
    redraw() {
        const year = this.vp.date.getUTCFullYear();
        const month = this.vp.date.getUTCMonth();
        const day = this.vp.date.getUTCDate();
        const ctx = this.ctx;
        ctx.resetTransform();
        ctx.fillStyle = this.styling.elevation.canvas;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = "grey";
        for (let dm = -2; dm < 3; dm++) {
            ctx.save();
            ctx.translate(0, 25 + dm * 55);
            let m = month + dm;
            let y = year;
            if (m < 0) {
                m += 12;
                y -= 1;
            }
            if (m >= 12) {
                m -= 12;
                y += 1;
            }
            const d = this.draw_of_month(m, y);
            d.draw().draw(ctx, (a) => a);
            ctx.restore();
        }
        const d = this.draw_of_month(month, year);
        ctx.strokeStyle = "red";
        ctx.fillStyle = "red";
        ctx.save();
        ctx.translate(0, 25);
        d.circle_day(day).draw(ctx, (a) => a);
        ctx.restore();
    }
    select_day(cxy) {
        const year = this.vp.date.getUTCFullYear();
        const month = this.vp.date.getUTCMonth();
        const d = this.draw_of_month(month, year);
        const day = d.select_day(cxy);
        if (day !== null) {
            this.vp.view_day_change(day - this.vp.date.getUTCDate());
        }
    }
    //mp update
    /// Invoked to purely update the state
    update() {
        this.redraw();
    }
    user_press(xy, actions) {
        actions.can_drag = false;
        if (xy[1] < 25) {
            actions.can_move = false;
            this.vp.view_day_change(-30);
            this.redraw();
        }
        else if (xy[1] > 80) {
            actions.can_move = false;
            this.vp.view_day_change(+30);
            this.redraw();
        }
        else {
            // this.vp.view_day_change(-1);
            this.select_day([xy[0], xy[1] - 25]);
        }
    }
    user_press_move(_start_xy, xy) {
        // this.vp.view_day_change(-1);
        this.select_day([xy[0], xy[1] - 25]);
    }
    user_press_cancel(_start_xy) { }
    user_release(_start_xy, _xy) { }
    user_zoom(_cxy, _factor) { }
    user_pan(_xy, _dxy) { }
    user_rotate(_xy, _angle) { }
    drag_start(_start_xy, _xy) { }
    drag_to(_start_xy, _old_xy, _new_xy) { }
    drag_end(_start_xy, _xy) { }
}
