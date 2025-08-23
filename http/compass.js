import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Line} from "./line.js";
import * as mouse from "./mouse.js";

//a CompassCanvas
export class CompassCanvas {
    //fp constructor
    constructor(star_catalog, canvas_div_id, width, height) {
        this.star_catalog = star_catalog;
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
       
        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");

        this.mouse = new mouse.Mouse(this, this.canvas);
        
        window.log.add_log(0, "project", "load", `Created compass canvas`);
        this.redraw();

        this.direction = 20;

    }

    //mp redraw
    redraw() {
        const ctx = this.ctx;
        ctx.save()

        const color = "#611";
        const base_color = "#211";
        const cx = this.width/2; 
        const cy = this.height/2;
        
        ctx.fillStyle = "black";
        ctx.fillRect(0,0,this.width, this.height);

        const radius = this.width*0.45;
        ctx.strokeStyle = color;
        ctx.lineWidth = 8.0;
        ctx.fillStyle = base_color;
        for (let i=20; i>=0; i-= 4) {
            ctx.setTransform(1,0,0,0.6,cx,cy+i);
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
        ctx.strokeStyle = color;
        ctx.lineWidth = 4.0;
        ctx.stroke();

        const d2r = Math.PI / 180;
        const c = Math.cos((this.direction + 90) * d2r );
        const s = Math.sin((this.direction + 90) * d2r );
        ctx.setTransform(c,-s*0.6,s,c*0.6,cx,cy);

        ctx.strokeStyle = color;
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
        // ctx.beginPath();
        // ctx.moveTo(v0[0],v0[1]);
        // ctx.lineTo(v1[0],v1[1]);
        // ctx.lineTo(v2[0],v2[1]);
        // ctx.lineTo(v0[0],v0[1]);
        // ctx.clip();
        //}
    }

    //mp update
    /// Invoked to purely update the state
    update() {
        const d2r = Math.PI / 180;
        const location_up = this.star_catalog.up;
        const xyz = this.star_catalog.viewer_q.apply3(this.star_catalog.vector_x).array;

        const angle = Math.atan2(xyz[1], xyz[0]) / d2r;
        console.log(xyz[0], xyz[1], xyz[2]);
        const elevation = Math.asin(xyz[2] / (xyz[0]*xyz[0] + xyz[1]*xyz[1]) ) / d2r;

        this.direction = angle;
        this.redraw();
        // console.log(angle, elevation);
        // this.styling = this.star_catalog.styling.map;
    }

    //mp zoom
    zoom(z) {
        this.direction = z * 180.0;
        this.redraw();
        console.log(this);
    }

    //mp drag_start
    drag_start(e) {
        this.drag_xy = e;
    }

    //mp drag_to
    drag_to(e) {
        let dx = (e[0] - this.drag_xy[0]) / this.width;
        this.drag_xy = e;
        let axis = this.star_catalog.up.cross_product(this.star_catalog.up.cross_product(new WasmVec3f64(0,0,1)));
        console.log(this.star_catalog.up.array);
        axis = new WasmVec3f64(0,1,0);
        axis = this.star_catalog.up;
        const q = WasmQuatf64.of_axis_angle(axis, dx*Math.PI);
        this.star_catalog.sky_canvas.post_mult_q(q);
        
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

