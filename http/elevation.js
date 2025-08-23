import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Line} from "./line.js";
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
        
        window.log.add_log(0, "project", "load", `Created elevation canvas`);
        this.redraw();
    }

    //mp redraw
    redraw() {
        const ctx = this.ctx;
        ctx.save()

        const color = "#611";
        const cx = 0; 
        const cy = this.height/2;
        const radius = this.width*0.95;
        
        const d2r = Math.PI / 180;

        ctx.fillStyle = "black";
        ctx.fillRect(0,0,this.width, this.height);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI*0.48, Math.PI*0.48);
        ctx.stroke();

        const c = Math.cos(this.vp.observer_elevation * d2r);
        const s = Math.sin(this.vp.observer_elevation * d2r);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx+radius*0.9*c,cy-radius*0.9*s,);
        ctx.stroke();

        ctx.beginPath();
        for (let angle=0; angle<85; angle+=15) {
            const c = Math.cos(angle * d2r);
            const s = Math.sin(angle * d2r);
            ctx.moveTo(cx+radius*c,cy-radius*s,);
            ctx.lineTo(cx+radius*0.9*c,cy-radius*0.9*s,);
            ctx.moveTo(cx+radius*c,cy+radius*s,);
            ctx.lineTo(cx+radius*0.9*c,cy+radius*0.9*s,);
        }
        ctx.stroke();

        ctx.restore();
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

        this.vp.view_elevation_rotate(dy*Math.PI/2)
        
    }

    //mp drag_end
    drag_end(e) {
    }

    //mp mouse_click
    mouse_click(e) {
    }
}

