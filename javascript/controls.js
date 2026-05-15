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
        const div = document.getElementById("ctl_selectors"); // div_id
        if (div === null) {
            this.logger.fatal(`Failed to find div ${div_id}`);
            throw "Failed to find div for contols";
        }
        this.div = new HtmlElement(div);
        this.div.clear();
        this.ctl_sel = [];
        //  ⚙⛰
        for (const classes_text of [
            ["zoom_mag", "⛰"],
            ["comp_elev", "View"],
            ["time_date", "◷"],
        ]) {
            const c = classes_text[0];
            const t = classes_text[1];
            const d = this.div.add_ele("div", { classes: c });
            const button = d.add_input_radio("ctl_sel", c, false, this.ctl_sel_input_cb.bind(this), { id: "ctl_sel_" + c });
            d.add_label("ctl_sel_" + c).add_content(t);
            this.ctl_sel.push(button);
        }
        const d = this.div.add_ele("div", { classes: "orient_device" });
        this.ctl_ena_orient = d.add_input_checkbox("ctl_ena_orient", this.orient_ena.bind(this), {
            id: "ctl_ena_orient",
        });
        d.add_label("ctl_ena_orient").add_content("Orient");
        document.getElementById("ctl_magnitude").oninput =
            this.set_ctl_magnitude.bind(this);
        document.getElementById("ctl_zoom").oninput = this.set_ctl_zoom.bind(this);
        this.compass = new CompassCanvas(this, this.vp, star_catalog.log, star_catalog.styling, "ControlCompass", 200, 100);
        this.clock = new ClockCanvas(this, this.vp, star_catalog.log, star_catalog.styling, "ControlClock", 100, 100);
        this.calendar = new CalendarCanvas(this, this.vp, star_catalog.log, star_catalog.styling, "ControlCalendar", 100, 100);
        this.elevation = new ElevationCanvas(this, this.vp, star_catalog.log, star_catalog.styling, "ControlElevation", 50, 100);
        this.animate = new Animate(this.animate_cb.bind(this));
        this.set_display();
    }
    orient_ena(_e) {
        if (this.ctl_ena_orient.input_checked()) {
            if (!this.star_catalog.orientation_ctl.permitted) {
                this.star_catalog.orientation_ctl.request_permission();
            }
            else {
                this.star_catalog.orientation_ctl.enable();
            }
        }
        else {
            this.star_catalog.orientation_ctl.disable();
        }
    }
    update() {
        this.clock.update();
        this.calendar.update();
        this.compass.update();
        this.elevation.update();
    }
    set_ctl_magnitude() {
        this.vp.brightness_set();
        this.schedule_animation();
    }
    set_ctl_zoom() {
        this.vp.zoom_set();
        this.schedule_animation();
    }
    schedule_animation() {
        this.animate.schedule(this.visibility_time);
    }
    ctl_sel_input_cb(_e, _value) {
        this.schedule_animation();
        this.set_display();
    }
    animate_cb(_time) {
        for (const e of this.ctl_sel) {
            e.set_input_checked(false);
        }
        this.set_display();
    }
    set_active() {
        this.animate.stop();
    }
    set_inactive() {
        this.schedule_animation();
    }
    set_display() {
        for (const e_ctl of this.ctl_sel) {
            const id = e_ctl.ele.id.slice(8);
            let display = "none";
            if (e_ctl.input_checked()) {
                display = "block";
            }
            const e = document.getElementById(id);
            if (e !== null) {
                new HtmlElement(e).set_style("display", display);
            }
        }
    }
}
