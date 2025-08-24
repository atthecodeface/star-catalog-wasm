export class Line {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.last_cxy = null;
        this.max_step = Math.sqrt(width*height)/2;
        this.ctx.beginPath();
    }
    new_segment() {
        this.last_cxy = null;
    }
    add_pt(cxy) {
        if (cxy == null) {
        } else if (this.last_cxy == null) {
            this.ctx.moveTo(cxy[0],cxy[1]);
        } else if (Math.abs(this.last_cxy[0]-cxy[0]) +Math.abs(this.last_cxy[1]-cxy[1]) < this.max_step) {
            this.ctx.lineTo(cxy[0],cxy[1]);
        } else {
            this.ctx.moveTo(cxy[0],cxy[1]);
        }
        this.last_cxy = cxy;
    }
    finish() {
        this.ctx.stroke();
        this.ctx.beginPath();
    }
}
