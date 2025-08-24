import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Draw} from "./draw.js";
import {Mouse} from "./mouse.js";

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
        const cy = this.height/2;
        const radius = this.width*0.95;
        let bg_contents =             [ ["w", 2],
              ["b"],
              ["a", cx, cy, radius, -87, 87],
              ["s"],
                                      ];
        const d2r = Math.PI / 180;
        for (let angle=0; angle<85; angle+=15) {
            const c = Math.cos(angle * d2r);
            const s = Math.sin(angle * d2r);
            bg_contents.push( ["m", cx+radius*c, cy-radius*s],
                              ["L", -0.1*radius*c, 0.1*radius*s],
                              ["m", cx+radius*c, cy+radius*s],
                              ["L", -0.1*radius*c, -0.1*radius*s],
                            );
        }
        bg_contents.push( ["s"] );
        this.background = new Draw(bg_contents);
        
        this.arrow = Draw.arrow(0.9*radius, 4);
        
        window.log.add_log(0, "project", "load", `Created elevation canvas`);
        this.redraw();
    }

    //mp redraw
    redraw() {
        this.styling = this.star_catalog.styling.elevation;
        const ctx = this.ctx;
        ctx.save()

        const cx = 0; 
        const cy = this.height/2;
        const radius = this.width*0.95;
        
        const d2r = Math.PI / 180;

        ctx.fillStyle = this.styling.canvas;
        ctx.fillRect(0,0,this.width, this.height);

        ctx.strokeStyle = this.styling.scale;
        this.background.draw(ctx); 

        ctx.strokeStyle = this.styling.marker;
        Draw.set_transform(ctx, [cx,cy], null, this.vp.observer_elevation);
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

    //mp zoom
    zoom(z) {
        // this.direction = z * 180.0;
        this.redraw();
    }

    //mp drag_start
    drag_start(e) {
        this.drag_xy = e;
    }

    //mp drag_to
    drag_to(e) {
        let dy = (e[1] - this.drag_xy[1]) / this.width;
        this.drag_xy = e;

        this.vp.view_observer_adjust(0.0, dy*Math.PI/2);
       
    }

    //mp drag_end
    drag_end(e) {
    }

    //mp mouse_click
    mouse_click(e) {
    }
}

