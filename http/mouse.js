//c Mouse
export class Mouse {
    //cp constructor
    constructor(client, ele) {
        this.client = client;
        this.ele = ele;
        this.mouse = null;
        this.touch_first = null;
        this.touch_second = null;
        this.drag = null;
        this.drag_distance = 5;
        this.zoom_ratio = 0.97;

        const me = this;
        ele.addEventListener('mousedown', function(e) {me.mouse_down(e);});
        ele.addEventListener('mouseup', function(e) {me.mouse_up(e);});
        ele.addEventListener('mouseleave', function(e) {me.mouse_leave(e);});
        ele.addEventListener('mousemove', function(e) {me.mouse_move(e);});

        ele.addEventListener('touchstart', function(e) {me.touch_start(e);});
        ele.addEventListener('touchend', function(e) {me.touch_end(e);});
        ele.addEventListener('touchcancel', function(e) {me.touch_cancel(e);});
        ele.addEventListener('touchmove', function(e) {me.touch_move(e);});

        ele.addEventListener('wheel', function(e) {me.wheel(e);});
    }

    //mp cxy
    cxy(e) {
        const rect = this.ele.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }

    //mp has_dragged
    has_dragged(sxy, cxy) {
            if (Math.abs(cxy[0]-sxy[0])< 5 &&
                Math.abs(cxy[1]-sxy[1])< 5) {
                return false;
            }
        return true;
    }

    //mp wheel
    wheel(e) {
        if (e.deltaY!=0) {
            this.client.zoom(Math.pow(this.zoom_ratio, e.deltaY));
        }
        e.preventDefault();
    }

    //mp touches_first
    touches_first(e) {
        if (this.touch_first[0] == e.touches[0].identifier) {
            return 0;
        }
        if (this.touch_first[0] == e.touches[1].identifier) {
            return 1;
        }
        return null;
    }

    //mi touch_start
    touch_start(e) {
//         console.log(e.touches);
        if (e.touches.length == 1) {
            this.touch_first = [e.touches[0].identifier, this.cxy(e.touches[0])];
            this.touch_second = null;
//            window.log.add_log("info","touch","start",`first ${this.touch_first}`);
        } else if (e.touches.length == 2 && this.touch_first != null) {
            const tf = this.touches_first(e);
            if (tf == null) { return; }
            const ts = 1-tf;
            this.touch_second = [e.touches[ts].identifier, this.cxy(e.touches[ts])];
//            window.log.add_log("info","touch","start",`${ts} ${this.touch_second}`);
            if (this.drag != null) {
                this.client.drag_end(this.touch_first[1]);
                this.drag = null;
            }
        }
        e.preventDefault();
    }
    //mi touch_move
    touch_move(e) {
        if (this.touch_second != null) {
            const tf = this.touches_first(e);
            if (tf == null) { return; }
            const tf_new_cxy = this.cxy(e.touches[tf]);
            const ts_new_cxy = this.cxy(e.touches[1-tf]);
            const dx_orig = this.touch_first[1][0] - this.touch_second[1][0];
            const dy_orig = this.touch_first[1][1] - this.touch_second[1][1];
            const dx_new = tf_new_cxy[0] - ts_new_cxy[0];
            const dy_new = tf_new_cxy[1] - ts_new_cxy[1];
            const d_orig = Math.sqrt(dx_orig*dx_orig + dy_orig*dy_orig);
            const d_new = Math.sqrt(dx_new*dx_new + dy_new*dy_new);
            if (d_orig != d_new) {
                if (d_new > 0 && d_orig>0) {
                    this.client.zoom(d_orig / d_new);
                }
            }
            const a_orig = Math.atan2(dy_orig, dx_orig);
            const a_new = Math.atan2(dy_new, dx_new);
            if (a_orig != a_new) {
                this.client.rotate(a_new - a_orig);
            }
            // this.drag must be null
            this.touch_first[1] = tf_new_cxy;
            this.touch_second[1] = ts_new_cxy;
            
        } else {
            // window.log.add_log("info","touch","move",`${this.touch_first}`);
            const cxy = this.cxy(e.touches[0]);
            if (this.drag != null) {
                this.touch_first = [e.touches[0].identifier, this.cxy(e.touches[0])];
                this.client.drag_to(this.drag, cxy);
                this.drag = cxy;
            } else if (this.touch_first != null) {
                // this.touch_first = [e.touches[0].identifier, this.cxy(e.touches[0])];
                if (this.has_dragged(this.touch_first[1], cxy)) {
                    this.client.drag_start(cxy);
                    this.drag = cxy;
                }
            }
            e.preventDefault();
            return;
        }
        e.preventDefault();
    }
    //mi touch_end
    touch_end(e) {
        if (this.touch_second != null) {
            // End as a drag of whichever is still down
        } else {
            if (this.touch_first != null) {
                const cxy = this.touch_first[1];
                if (this.drag != null) {
                    this.client.drag_end(cxy);
                } else {
                    this.client.mouse_click(cxy);
                }
            }
        }
        this.touch_first = null;
        this.touch_second = null;
        this.drag = null;
        e.preventDefault();
    }
    //mi touch_cancel
    touch_cancel(e) {
        if (this.drag != null) {
            this.client.drag_end(this.drag);
        }
        this.touch_first = null;
        this.touch_second = null;
        this.drag = null;
        e.preventDefault();
    }
    //mi mouse_down
    mouse_down(e) {
        this.mouse = this.cxy(e);
        e.preventDefault();
    }
    
    //mi mouse_leave
    mouse_leave(e) {
        if (this.drag != null) {
            this.client.drag_end(this.drag);
        }
        this.mouse = null;
        this.drag = null;
    }

    //mi mouse_up
    mouse_up(e) {
        const cxy = this.cxy(e);
        if (this.drag != null) {
            this.client.drag_end(cxy);
        }
        if (this.mouse != null) {
            if (!this.has_dragged(this.mouse, cxy)) {
                this.client.mouse_click(cxy);
            }
        }
        this.mouse = null;
        this.drag = null;
        e.preventDefault();
    }
    
    //mi mouse_move
    mouse_move(e) {
        const cxy = this.cxy(e);
        if (this.drag != null) {
            this.client.drag_to(this.drag, cxy);
            this.drag = cxy;
            e.preventDefault();
            return;
        }
        if (this.mouse != null) {
            if (this.has_dragged(this.mouse, cxy)) {
                this.client.drag_start(cxy);
                this.drag = cxy;
            }
            e.preventDefault();
            return;
        }
    }
    
}
