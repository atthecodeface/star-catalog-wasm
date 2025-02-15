import {WasmVec3f32, WasmVec3f64, WasmQuatf64} from "../pkg/star_catalog_wasm.js";
import * as html from "./html.js";
import {Line} from "./line.js";
import * as mouse from "./mouse.js";

//a SkyCanvas
export class SkyCanvas {
    //fp constructor
    constructor(star_catalog, catalog, canvas_div_id, width, height) {
        this.star_catalog = star_catalog;
        this.catalog = catalog;
        this.div = document.getElementById(canvas_div_id);
        this.canvas = document.createElement("canvas");
        this.div.appendChild(this.canvas);
       
        this.width = width;
        this.height = height;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.deg2rad = Math.PI / 180;
        this.rad2deg = 180 / Math.PI;

        this.fovh = Math.PI / 2;
        // Aspect ratio in 'tan' space of a single Y pixel compared to a single X pixel
        this.tan_yx = 1.0;
        this.q = WasmQuatf64.unit();

        this.brightness = 5.0;

        this.selected = null;
        this.mouse = new mouse.Mouse(this, this.canvas);
        
        window.log.add_log(0, "project", "load", `Created sky canvas`);
    }

    derive_data() {
        this.styling = this.star_catalog.styling.sky;

        this.win_ar = this.height / this.width;
        this.tan_yx = 1.0;
        // this.tan_hfovh is what half the width is horizontally in tan space
        this.tan_hfovh = Math.tan(this.fovh/2);
        // this.tan_pixh and tan_pixv is the 'tan' space of a horizontal pixel and vertical pixel
        this.tan_pixh = 2 * this.tan_hfovh / this.width;
        this.tan_pixv = 2 * this.tan_pixh / this.tan_yx;
        this.q_i = this.q.conjugate();

        html.if_ele_id("focal_length", this.tan_hfovh, function(e,v) {
            e.innerText = `${(18 / v).toFixed(2)}mm equiv`;
        });
        html.if_ele_id("fov", this.fovh*this.rad2deg, function(e,v) {
            e.innerText = `${v.toFixed(2)} degrees`;
        });
        html.if_ele_id("brightness", this.brightness, function(e,v) {
            e.value = v;
        });
        html.if_ele_id("max_mag", this.brightness, function(e,v) {
            e.innerText = `Max magnitude: ${v.toFixed(2)}`;
        });
        html.if_ele_id("zoom", this.fovh * this.rad2deg, function(e,v) {
            e.value = v;
        });

    }

    update() {
        this.derive_data();
        this.redraw_canvas();
    }

    // Vector of canvas coord +X right +Y down
    vector_of_cxy(cxy) {
        const fx = (-cxy[0] / this.width + 0.5) * 2;
        const fy = (-cxy[1] / this.height + 0.5) * 2;
        return this.vector_of_fxy([fx,fy]);
    }

    // Vector of *square* canvas fraction with -1,-1 being bottom left, 1,1 top right
    //
    // This assumes that -1 in the Y corresponds to a 'full' width
    vector_of_fxy(fxy) {
        const fx = fxy[0];
        const fy = fxy[1] * this.win_ar / this.tan_yx;
        const roll = Math.atan2(fy,fx);
        const f = Math.sqrt(fx*fx+fy*fy);
        const yaw = Math.atan(f * this.tan_hfovh);
        const vx = Math.cos(yaw);
        const vy = Math.sin(yaw) * Math.cos(roll);
        const vz = Math.sin(yaw) * Math.sin(roll);
        return new WasmVec3f64(vx, vy, vz);
    }

    // Canvas XY of vector in'camera' space
    //
    // Note X+ is in to screen, Y+ is left, Z+ is up
    cxy_of_vector(vv) {
        const v = vv.array;
        if (v[0] < 0.1) {return null;}
        const x = this.width/2.0 - (v[1]/v[0] / this.tan_pixh);
        const y = this.height/2.0 - (v[2]/v[0] / this.tan_pixh); // v / this.win_ar );
        return [x,y];
    }
    select(s) {
        window.log.add_log(0, "sky", "select", `Selected ${s}`);
        this.selected = s;
        if (this.selected != null) {
            const star = this.catalog.star(this.selected);
            const e = document.getElementById("star_info");
            if (e) {
                html.clear(e);
                e.append(html.vtable([],[["Id", `${star.id}`],
                                         ["Ra", `${(star.right_ascension * this.rad2deg).toFixed(2)}`],
                                         ["De", `${(star.declination * this.rad2deg).toFixed(2)}`],
                                         ["M", `${(star.magnitude).toFixed(2)}`],
                                        ]));
                                             
            }
        }
        
        this.redraw_canvas();
    }

    //mi drag_start
    drag_start(cxy) {
        const cx = cxy[0] - this.width/2;
        const cy = cxy[1] - this.height/2;
        const d2 = cx*cx+cy*cy;
        if (d2 > this.width*this.height/8) {
            this.drag_rotate = "x";
        } else {
            this.drag_rotate = "yz";
        }
    }
    
    //mi drag_to
    drag_to(cxy0, cxy1) {
        if (this.drag_rotate == "x") {
            const cx0 = cxy0[0] - this.width/2;
            const cy0 = cxy0[1] - this.height/2;
            const cx1 = cxy1[0] - this.width/2;
            const cy1 = cxy1[1] - this.height/2;
            const angle = Math.atan2(cy1,cx1) - Math.atan2(cy0,cx0);
            const q = WasmQuatf64.unit().rotate_x(-angle);
            this.q = this.q.mul(q);
            this.star_catalog.update_view();
        } else {
            const dcx = (cxy0[0] - cxy1[0]) * this.tan_pixh;
            const dcy = (cxy0[1] - cxy1[1]) * this.tan_pixv;
            const qz = WasmQuatf64.unit().rotate_z(-Math.atan(dcx));
            const qy = WasmQuatf64.unit().rotate_y(Math.atan(dcy));
            this.q = this.q.mul(qz).mul(qy);
            this.star_catalog.update_view();
        }
    }
    
    //mi drag_end
    drag_end(cxy) {
        // console.log("Drag end", cxy);
    }
    
    //mi mouse_click
    mouse_click(cxy) {
        const v = this.vector_of_cxy(cxy);
        const qv = this.q.apply3(v).array;
        const ra = Math.atan2(qv[1],qv[0]);
        const de = Math.asin(qv[2]);
        this.catalog.clear_filter();
        this.catalog.filter_max_magnitude(this.brightness);
        this.select(this.catalog.closest_to(ra,de));
    }

    zoom(factor) {
        // window.log.add_log("info","sky","zoom",`${factor}`);
        this.fovh = 2*Math.atan(factor*Math.tan(this.fovh/2));
        if (this.fovh > Math.PI) {
            this.fovh = Math.PI;
        } else if (this.fovh < 0.01){
            this.fovh = 0.01;
        }
        this.star_catalog.update_view();
    }
    rotate(angle) {
        // window.log.add_log("info","sky","rotate",`${angle}`);
        const v = new WasmVec3f64(1,0,0);
        const q = WasmQuatf64.of_axis_angle(v, -angle);
        this.q = this.q.mul(q);
        this.star_catalog.update_view();
    }

    draw_star(ctx, star) {
        const m = star.magnitude;
        const ra = star.right_ascension;
        const de = star.declination;
        const rgb = star.rgb.array;
        const qv = this.q_i.apply3(star.vector);
        const cxy = this.cxy_of_vector(qv);
        if (cxy == null) {return; }
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

    draw_grid(ctx, q_grid, styling) {
        if (styling == null) {
            return;
        }

        ctx.strokeStyle = styling;
        const l = new Line(ctx, this.width, this.height);
        const v = new WasmVec3f64(0,0,0);
        for (var de=-80; de<=80; de+=10) {
            const de_c = Math.cos(de * this.deg2rad);
            const de_s = Math.sin(de * this.deg2rad);
            l.new_segment();
            for (var ra=0; ra<=360; ra+=1) {
                const ra_r = ra * this.deg2rad;
                v.set( [de_c*Math.cos(ra_r), de_c*Math.sin(ra_r), de_s]);
                const xyz = q_grid.apply3(v);
                const cxy = this.cxy_of_vector(xyz);
                l.add_pt(cxy);
            }
            l.new_segment();
            for (var ra=0; ra<=360; ra+=1) {
                const ra_r = ra * this.deg2rad;
                v.set( [de_c*Math.cos(ra_r), de_c*Math.sin(ra_r), de_s]);
                const xyz = q_grid.apply3(v);
                const cxy = this.cxy_of_vector(xyz);
                l.add_pt(cxy);
            }
        }
        for (var ra=0; ra<=360; ra+=15) {
            const ra_c = Math.cos(ra * this.deg2rad);
            const ra_s = Math.sin(ra * this.deg2rad);
            l.new_segment();
            for (var de=-80; de<=80; de+=1) {
                const de_c = Math.cos(de * this.deg2rad);
                const de_s = Math.sin(de * this.deg2rad);
                v.set( [de_c*ra_c, de_c*ra_s, de_s]);
                const xyz = q_grid.apply3(v);
                const cxy = this.cxy_of_vector(xyz);
                l.add_pt(cxy);
            }
        }
        l.finish();
    }

    draw_border(ctx) {
        if (this.styling.view_border == null) {
            return;
        }
        const rx = this.canvas.width;
        const by = this.canvas.height;
        ctx.fillStyle = this.styling.view_border[0];
        ctx.fillRect(0, by-2, rx, 2);
        ctx.fillStyle = this.styling.view_border[2];
        ctx.fillRect(0, 0, rx, 2);
        ctx.fillStyle = this.styling.view_border[1];
        ctx.fillRect(0, 0, 2, by);
        ctx.fillStyle = this.styling.view_border[3];
        ctx.fillRect(rx-2, 0, 2, by);
    }        

    redraw_canvas() {
        const ctx = this.canvas.getContext("2d");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.draw_border(ctx);
        if (this.selected != null) {
            const star = this.catalog.star(this.selected);
            ctx.strokeStyle = "White";
            const qv = this.q_i.apply3(star.vector);
            const cxy = this.cxy_of_vector(qv);
            if (cxy != null) {
                const cx = cxy[0];
                const cy = cxy[1];

                ctx.beginPath();
                ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }
        this.catalog.clear_filter();
        this.catalog.filter_max_magnitude(this.brightness);

        console.log(this.styling);
        if (this.styling.show_azimuthal) {
            this.draw_grid(ctx, this.q_i.mul(this.star_catalog.q_looking_ns.conjugate()), this.styling.azimuthal_grid);
        }
        if (this.styling.show_equatorial) {
            this.draw_grid(ctx, this.q_i, this.styling.equatorial_grid);
        }

        const vv = new WasmVec3f64(1,0,0);
        const qv = this.q.apply3(vv);
        var first = 0;
        var steps = 0;
        var adjust_brightess = false;
        while (true) {
            const s = this.catalog.find_stars_around(qv, this.fovh, first, 100);
            for (const index of s) {
                const star = this.catalog.star(index);
                this.draw_star(ctx, star);
            }
            if (s.length == 0) {
                break;
            }
            first += s.length;
            steps += 1;
            if (steps % 25 == 0) {
                adjust_brightess = true;
            }
        }
        this.catalog.clear_filter();
        if (adjust_brightess) {
            this.brightness = this.brightness * 0.9;
            this.derive_data();
            this.redraw_canvas();
        }

    }
    rotate_axis(axis, delta) {
        var v = new WasmVec3f64(1,0,0);
        if (axis == 1) {
            v = new WasmVec3f64(0,1,0);
        }
        else if (axis == 2) {
            v = new WasmVec3f64(0,0,1);
        }
        const q = WasmQuatf64.of_axis_angle(v, delta);
        this.q = this.q.mul(q);
        this.star_catalog.update_view();
    }
    center(ra_de) {
        const ra = ra_de[0];
        const de = ra_de[1];
        // Get star space vectors
        const vv = new WasmVec3f64(1,0,0);
        const qv = this.q.apply3(vv);
        const new_qv = this.star_catalog.vec_of_ra_de(ra, de);
        const q = WasmQuatf64.rotation_of_vec_to_vec(qv, new_qv);

        // Add that rotation to the map camera
        this.q = q.mul(this.q);
        this.star_catalog.update_view();
    }
    zoom_set() {
        const e = document.getElementById("zoom");
        if (e) {
            this.fovh = e.value * this.deg2rad;
            this.star_catalog.update_view();
        }
    }
    brightness_set() {
        const e = document.getElementById("brightness");
        if (e) {
            let brightness = e.value;
            this.brightness = 1.0 * brightness;
            this.star_catalog.update_view();
        }
    }
    rotate_x() {
        const e = document.getElementById("rotx");
        if (!e) {return;}
        window.log.add_log(0, "sky", "rotx", `Value ${e.value}`);
        this.rotate(0,-0.05 * e.value);
        e.value = 0;
    }
    rotate_y() {
        const e = document.getElementById("roty");
        if (!e) {return;}
        window.log.add_log(0, "sky", "roty", `Value ${e.value}`);
        this.rotate(1,-0.05 * e.value);
        e.value = 0;
    }
    rotate_z() {
        const e = document.getElementById("rotz");
        if (!e) {return;}
        window.log.add_log(0, "sky", "rotz", `Value ${e.value}`);
        this.rotate(2,-0.05 * e.value);
        e.value = 0;
    }
}

