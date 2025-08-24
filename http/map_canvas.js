import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
//a MapCanvas
import * as html from "./html.js";
import {Line} from "./line.js";
import * as earth from "./earth.js";

function fract(x) {
    return x - Math.floor(x);
}

export class MapCanvas {
    //fp constructor
    constructor(star_catalog, catalog, canvas_div_id, width, height) {
        this.star_catalog = star_catalog;
        this.catalog = catalog;
        this.vp = this.star_catalog.vp;

        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);

        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

       
        const me = this;
        // this.canvas.addEventListener('wheel', function(e) {me.wheel(e);});
        this.canvas.addEventListener('mousedown', function(e) {me.mouse_down(e);});
        //this.canvas.addEventListener('mouseup', function(e) {me.mouse_up(e);});
        // this.canvas.addEventListener('mouseout', function(e) {me.mouse_up(e);});
        // this.canvas.addEventListener('mousemove', function(e) {me.mouse_move(e);});

        window.log.add_log(0, "project", "load", `Created map canvas`);
    }

    update() {
        this.derive_data();
        this.redraw_canvas();
    }
    derive_data() {
        this.styling = this.star_catalog.styling.map;
    }        

    //mi mouse_down
    mouse_down(e) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const ra_de = this.ra_de_of_cxy([cx, cy]);
        this.star_catalog.center_sky_view(ra_de);
        e.preventDefault();
    }

    //mi ra_de_of_cxy
    ra_de_of_cxy(cxy) {
        const fx = cxy[0] /  this.width;
        const fy = cxy[1] / this.height;
        const ra = (fx - 0.5) * 2 * Math.PI;
        const de = (0.5 - fy) * Math.PI;
        return [ra, de];
    }

    //mi vector_of_cxy
    // Vector of a canvas XY
    //
    // X+ is in, Y+ is left, Z+ is up
    vector_of_cxy(cxy) {
        const de_ra = this.ra_de_of_cxy(cxy);
        const vz = Math.sin(de);
        const c = Math.cos(de);
        const vx = c * Math.cos(ra);
        const vy = -c * Math.sin(ra);
        return [vx, vy, vz];
    }

    //mi cxy_of_ra_de
    // Canvas XY of RA and DE
    //
    // Canvas coordinates are X+ right Y+ down
    //
    // Declination 0 at the moddle, +DE up (PI for the height)
    //
    // RA is 0 at the middle RA+ right (2PI for the width)
    cxy_of_ra_de(ra,de) {
        const x = 0.5 + ra / (2 * Math.PI);
        const y = 0.5 - de / Math.PI;
        const fx = x - Math.floor(x);
        const fy = y - Math.floor(y);
        const cx = fx * this.width;
        const cy = fy * this.height;
        return [cx,cy];
    }

    //mi cxy_of_vector
    // canvas XY of a vector
    //
    // X+ is in, Y+ is left, Z+ is up; sin(z) is declination (or atan(z/x))
    cxy_of_vector(vv) {
        const v = vv.array;
        const de = Math.asin(v[2]);
        const ra = Math.atan2(v[1],v[0]);
        return this.cxy_of_ra_de(ra,de);
    }

    //mi draw_sky_rect
    // Draw the 'rectangle' that the Sky canvas represents
    draw_sky_rect(ctx) {
        if (this.styling.view_border != null) {
            ctx.strokeStyle = this.styling.view_border[0];
            for (const y of [-1,1]) {
                const l = new Line(ctx, this.width, this.height);
                for (var x=-1; x<1.01; x+= 0.1) {
                    const v = this.star_catalog.sky_view_vector_of_fxy([x,y]);
                    l.add_pt(this.cxy_of_vector(v));
                }
                l.finish();
                ctx.strokeStyle = this.styling.view_border[2];
            }

            ctx.strokeStyle = this.styling.view_border[1];
            for (const x of [-1,1]) {
                const l = new Line(ctx, this.width, this.height);
                for (var y=-1; y<1.01; y+= 0.1) {
                    const v = this.star_catalog.sky_view_vector_of_fxy([x,y]);
                    l.add_pt(this.cxy_of_vector(v));
                }
                l.finish();
                ctx.stroke();
                ctx.strokeStyle = this.styling.view_border[3];
            }
        }
    }

    //mi draw_star
    // Draw a star in the Canvas context
    draw_star(ctx, star) {
        const m = star.magnitude;
        const rgb = star.rgb.array;
        const ra = star.right_ascension;
        const de = star.declination;
        const cxy = this.cxy_of_ra_de(ra,de);
        const cx = cxy[0];
        const cy = cxy[1];
        
        let r = Math.floor(Math.min(255, Math.max(0,rgb[0]*255)));
                           let g = Math.floor(Math.min(255, Math.max(0,rgb[1]*255)));
                           let b = Math.floor(Math.min(255, Math.max(0,rgb[2]*255)));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        if (m<3) {
            ctx.fillRect(cx-1,cy-1,3,3);
        } else if (m<4) {
            ctx.fillRect(cx,cy,2,2);
        } else {
            ctx.fillRect(cx,cy,1,1);
        }
    }

    //mi draw_equatorial_grid
    draw_equatorial_grid(ctx) {
        if (!this.styling.show_equatorial) {
            return;
        }
        const l = new Line(ctx, this.width, this.height);
        ctx.lineWidth=2.0;
        ctx.strokeStyle = this.styling.meridian[0];
        for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
            l.add_pt(this.cxy_of_ra_de(0*Math.PI,de*Math.PI/2));
        }
        l.finish();
        ctx.strokeStyle = this.styling.meridian[1];
        for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
            l.add_pt(this.cxy_of_ra_de(0.999*Math.PI,de*Math.PI/2));
        }
        l.finish();
        for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
            l.add_pt(this.cxy_of_ra_de(-1*Math.PI,de*Math.PI/2));
        }
        l.finish();
        ctx.strokeStyle = this.styling.equatorial_grid;
        ctx.lineWidth=1.0;
        for (var ra=1/6; ra<0.999; ra+=1/6) {
            for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
                l.add_pt(this.cxy_of_ra_de(ra*Math.PI,de*Math.PI/2));
            }
            l.finish();
            for (const de of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
                l.add_pt(this.cxy_of_ra_de(-ra*Math.PI,de*Math.PI/2));
            }
            l.finish();
        }
        for (var de=-1; de<1.01; de+=1/3) {
            for (const ra of [-0.9999, -0.5, 0, 0.5, 0.9999]) {
                l.add_pt(this.cxy_of_ra_de(ra*Math.PI,de*Math.PI/2));
            }
            l.finish();
        }
    }
    
    //mi add_declination_circle - for azimuthal_grid
    add_declination_circle(q, l, v, de, step_size) {
        const de_c = Math.cos(de * this.vp.deg2rad);
        const de_s = Math.sin(de * this.vp.deg2rad);
        l.new_segment();
        for (var ra=0; ra<=360; ra += step_size) {
            const ra_r = ra * this.vp.deg2rad;
            v.set([de_c*Math.cos(ra_r), de_c*Math.sin(ra_r), de_s]);
            l.add_pt(this.cxy_of_vector(q.apply3(v)));
        }
    }

    //mi add_ra_great_circle - for azimuthal grid
    add_ra_great_circle(q, l, v, ra, step_size) {
        const ra_c = Math.cos(ra * this.vp.deg2rad);
        const ra_s = Math.sin(ra * this.vp.deg2rad);
        l.new_segment();
        for (var de=-80; de<=80; de+=1) {
            const de_c = Math.cos(de * this.vp.deg2rad);
            const de_s = Math.sin(de * this.vp.deg2rad);
            v.set([ra_s*de_c, -ra_c*de_c, de_s]);
            l.add_pt(this.cxy_of_vector(q.apply3(v)));
        }
    }
        
    //mi draw_azimuthal_grid
    // Draw a azimuthal grid
    //
    // Create a RH set of axes with z as 'up', and ideally x with no
    // component in the 'declination' direction
    draw_azimuthal_grid(ctx) {
        if (!this.styling.show_azimuthal) {
            return;
        }

        const q_grid = this.vp.q_looking_ns.conjugate();

        const l = new Line(ctx, this.width, this.height);
        const v = new WasmVec3f64(0,0,0);
        ctx.strokeStyle = this.styling.azimuthal_grid[0];
        for (var de=-80; de<0; de+=10) {
            this.add_declination_circle(q_grid, l, v, de, 1);
        }
        l.finish();
        ctx.strokeStyle = this.styling.ecliptic;
        this.add_declination_circle(q_grid, l, v, 0, 1);
        l.finish();
        ctx.strokeStyle = this.styling.azimuthal_grid[1];
        for (var de=10; de<=80; de+=10) {
            this.add_declination_circle(q_grid, l, v, de, 1);
        }
        l.finish();

        ctx.strokeStyle = this.styling.meridian[0];
        this.add_ra_great_circle(q_grid, l, v, 0, 1);
        l.finish();
        ctx.strokeStyle = this.styling.meridian[1];
        this.add_ra_great_circle(q_grid, l, v, 180, 1);
        l.finish();
        ctx.strokeStyle = this.styling.azimuthal_grid[0];
        for (var ra=15; ra<175; ra+=15) {
            this.add_ra_great_circle(q_grid, l, v, ra, 1);
            this.add_ra_great_circle(q_grid, l, v, ra+180, 1);
        }
        l.finish();
    }

    //mi redraw_canvas
    redraw_canvas() {
        const ctx = this.canvas.getContext("2d");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.catalog.filter_max_magnitude(4.0);

        const XP_AXIS = new WasmVec3f64(1,0,0)
        for (const index of this.catalog.find_stars_around(XP_AXIS, 1.6, 0, 1000)) {
            const star = this.catalog.star(index);
            this.draw_star(ctx, star);
        }
        for (const index of this.catalog.find_stars_around(XP_AXIS.neg(), 1.6, 0, 1000)) {
            const star = this.catalog.star(index);
            this.draw_star(ctx, star);
        }
        this.draw_azimuthal_grid(ctx);
        this.draw_sky_rect(ctx);

        this.draw_equatorial_grid(ctx);
    }

    //zz All done
}

