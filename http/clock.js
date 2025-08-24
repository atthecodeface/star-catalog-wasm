import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Draw} from "./draw.js";
import {Mouse} from "./mouse.js";

//a ClockCanvas
export class ClockCanvas {
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
        
        const radius = this.width*0.45;
        let bg_contents =
            [
                ["t", this.width/2, this.height/2],
                ["push"],
                ["b"],
                ["c", 0, 0, radius ],
                ["F", "rim"],
                ["f"],
                ["b"],
                ["c", 0, 0, radius*0.9 ],
                ["F", "face"],
                ["f"],
                ["pop"],
                ["push"],
                ["t", -radius*0.75,-radius*0.75,],
                ["b",], 
                ["a", 0, 0, radius*0.25,135, -45 ],
                ["F", "rim"],
                ["f"],
                ["pop"],
                ["push"],
                ["t", radius*0.75,-radius*0.75,],
                ["b",], 
                ["a", 0, 0, radius*0.25,-135, 45,  ],
                ["F", "rim"],
                ["f"],
                ["pop"],
            ];
        
        this.background = new Draw(bg_contents);
        this.hour_hand = Draw.arrow(radius * 0.4);
        this.minute_hand = Draw.arrow(radius * 0.8);

        window.log.add_log(0, "project", "load", `Created clock canvas`);
        this.redraw();
    }

    //mp redraw
    redraw() {
        this.styling = this.star_catalog.styling.clock;
        const ctx = this.ctx;
        ctx.save()

        ctx.fillStyle = this.styling.canvas;
        ctx.fillRect(0,0,this.width, this.height);

        const style = this.styling;

        this.background.draw(ctx, (x) => style[x] );

        ctx.save();
        ctx.strokeStyle = this.styling.minute;
        Draw.set_transform(ctx, [this.width/2, this.height/2], null, 90-this.vp.minute_of_hour*6);
        this.minute_hand.draw(ctx, (x) => style[x] );
        ctx.restore();

        ctx.restore();
        ctx.save();
        ctx.strokeStyle = this.styling.hour;
        Draw.set_transform(ctx, [this.width/2, this.height/2], null, 90-this.vp.time_of_day * 30);
        this.hour_hand.draw(ctx, (x) => style[x] );
        ctx.restore();


    }

    //mp update
    /// Invoked to purely update the state
    update() {
        this.redraw();
    }

    //mp zoom
    zoom(z) {
        // this.direction = z * 180.0;
        this.redraw();
        console.log(this);
    }

    //mi drag_polar
    drag_polar(xy) {
        const dy = xy[1]-this.height/2;
        const dx = xy[0]-this.width/2;
        return [Math.sqrt(dx*dx+dy*dy), Math.atan2(dy,dx)];
    }

    //mp drag_start
    drag_start(e) {
        this.last_drag_polar = this.drag_polar(e);
        this.drag_minutes = (this.drag_polar[0] > this.width*0.3);
    }

    //mp drag_to
    drag_to(e) {
        const d_ra = this.drag_polar(e);

        let da = d_ra[1] - this.last_drag_polar[1];
        if (da < -Math.PI) {
            da += Math.PI*2;
        } 
        if (da > Math.PI) {
            da -= Math.PI*2;
        }
        if (this.drag_minutes) {
            da /= 12;
        }

        this.last_drag_polar = d_ra;

        this.vp.view_clock_hour_rotate(da)
        
    }

    //mp drag_end
    drag_end(e) {
        console.log(e);
    }

    //mp mouse_click
    mouse_click(e) {
            console.log(e);
    }
}

