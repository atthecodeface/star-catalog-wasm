import { Logger } from "./log.js";
import { Animate } from "./animate.js";
import { HtmlElement } from "./html.js";
import { CompassCanvas } from "./compass.js";
import { ClockCanvas } from "./clock.js";
import { CalendarCanvas } from "./calendar.js";
import { ElevationCanvas } from "./elevation.js";
export class Controls {
    constructor(star_catalog, div_id) {
        this.visibility_time = 5000;
        this.star_catalog = star_catalog;
        this.vp = this.star_catalog.vp;
        this.logger = new Logger(star_catalog.log, "controls");
        this.compass = new CompassCanvas(star_catalog, "ControlCompass", 200, 100);
        this.clock = new ClockCanvas(star_catalog, "ControlClock", 100, 100);
        this.calendar = new CalendarCanvas(star_catalog, "ControlCalendar", 100, 100);
        this.elevation = new ElevationCanvas(star_catalog, "ControlElevation", 50, 100);
        this.animate = new Animate(this.animate_cb.bind(this));
        this.ctl_sel = [];
        for (const e of document.getElementsByName("ctl_sel")) {
            if (e instanceof HTMLInputElement) {
                this.ctl_sel.push(e);
                e.checked = false;
                e.oninput = this.ctl_sel_input_cb.bind(this);
            }
        }
        let div = document.getElementById(div_id);
        div = div;
        this.set_display();
    }
    update() {
        this.clock.update();
        this.calendar.update();
        this.compass.update();
        this.elevation.update();
    }
    ctl_sel_input_cb(_e) {
        this.animate.schedule(this.visibility_time);
        this.set_display();
    }
    animate_cb(_time) {
        for (const e of this.ctl_sel) {
            e.checked = false;
        }
        this.set_display();
    }
    set_display() {
        for (const e_ctl of this.ctl_sel) {
            const id = e_ctl.id.slice(8);
            let display = "none";
            if (e_ctl.checked) {
                display = "inline";
            }
            const e = document.getElementById(id);
            console.log(e_ctl, id, display, e);
            if (e !== null) {
                new HtmlElement(e).set_style("display", display);
            }
        }
    }
}
