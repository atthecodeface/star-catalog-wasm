import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Mouse} from "./mouse.js";

//a CompassCanvas
export class CompassCanvas {
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
        
        window.log.add_log(0, "project", "load", `Created compass canvas`);
        this.redraw();
    }

    //mp redraw
    //
    // The observer_compass value indicates the angle of view; -45
    // means the view is North-West
    //
    // If the observer compass value is -45, then the actual compass
    // should be drawn rotated clockwise by 45 degrees
    //
    // The compass is drawn with dashes every 15 degrees, with a long
    // every 90 degress and even longer at 0 degrees
    //
    // The canvas has +Y right, +Y down...
    //
    // If the compass-in-canvas is written as a circle starting at 0
    // degrees on the X axis, and goes clockwise (because +canvas Y is
    // down..., i.e. is drawn cos(theta), sin(theta)) then that needs
    // to be transformed by rotating it by 90 degrees (to account for
    // the angle offset) plus the observer compass (since the canvas
    // is upside down this inverts the rotation)
    redraw() {
        this.styling = this.star_catalog.styling.compass;
        const ctx = this.ctx;
        ctx.save()

        const color = this.styling.body;;
        const base_color = this.styling.bg;
        const cx = this.width/2; 
        const cy = this.height/2;
        const y_squash = 0.3;
        
        ctx.fillStyle = this.styling.canvas;
        ctx.fillRect(0,0,this.width, this.height);

        const radius = this.width*0.45;
        ctx.strokeStyle = color;
        ctx.lineWidth = 8.0;
        ctx.fillStyle = base_color;
        for (let i=20; i>=0; i-= 4) {
            ctx.setTransform(1,0,0,y_squash,cx,cy+i);
            ctx.beginPath();
            ctx.arc(0,0, radius, 0, 2 * Math.PI);
            if (i==0) {
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.stroke();
            }
        }

        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(0,this.height/10);
        ctx.strokeStyle = this.styling.markers;
        ctx.lineWidth = 4.0;
        ctx.stroke();

        const d2r = Math.PI / 180;
        const c = Math.cos((this.vp.observer_compass + 90) * d2r );
        const s = Math.sin((this.vp.observer_compass + 90) * d2r );
        ctx.setTransform(c,-s*y_squash,s,c*y_squash,cx,cy);

        ctx.strokeStyle = this.styling.markers;
        ctx.lineWidth = 4.0;
        for (let angle =0; angle <360; angle += 15 ) {
            const c = Math.cos(angle * d2r );
            const s = Math.sin(angle * d2r );
            ctx.beginPath();
            let l = 0.8;
            if ((angle % 90) == 0) {
                l = 0.65;
            }
            if (angle == 0) {
                l = 0.4;
            }
            ctx.moveTo(radius*l*c,radius*l*s,);
            ctx.lineTo(radius*0.9*c,radius*0.9*s,);
            ctx.stroke();
        }

        ctx.fillStyle = "";
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
        console.log(this);
    }

    //mi drag_polar
    //
    // This is +-PI at X=-1, Y=0; 0 at X=1, Y=0
    drag_polar(xy) {
        const dy = xy[1]-this.height/2;
        const dx = xy[0]-this.width/2;
        return [Math.sqrt(dx*dx+dy*dy), Math.atan2(dy,dx)];
    }

    //mp drag_start
    drag_start(e) {
        this.last_drag_polar = this.drag_polar(e);
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
        this.last_drag_polar = d_ra;

        this.vp.view_observer_adjust(da, 0.0);
    }

    //mp drag_end
    drag_end(e) {
    }

    //mp mouse_click
    mouse_click(e) {
            console.log(e);
    }
}

