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
export class Draw {
    constructor(contents) {
        this.contents = contents;
    }
    static arrow(length, head) {
        const contents = 
            [ ["w", 2],
              ["b"],
              ["m", 0, 0],
              ["l", length, 0],
              ["l", length-head, head],
              ["m", length, 0],
              ["l", length-head, -head],
              ["s"],
            ];
        return new Draw(contents);
    }
    static set_transform(ctx, cxy, scale, angle) {
        const d2r = Math.PI / 180;
        ctx.setTransform(1,0,0,1,0,0);
        if (cxy) {
            ctx.transform(1,0,0,1,cxy[0],cxy[1]);
        }
        if (scale !== null) {
            ctx.transform(scale,0,0,scale,0,0);
        }
        if (angle !== null) {
            angle = angle*d2r;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            ctx.transform(c,-s,s,c,0,0);
        }
    }
    draw(ctx, style) {
        let lx = 0;
        let ly = 0;
        const d2r = Math.PI / 180;
        for (const c of this.contents) {
            switch(c[0]) {
            case "push": {ctx.save(); break;}
            case "pop": {ctx.restore(); break;}
            case "b": { ctx.beginPath(); break;}
            case "m": { ctx.moveTo(c[1],c[2]); lx=c[1]; ly=c[2]; break;}
            case "l": { ctx.lineTo(c[1],c[2]); lx=c[1]; ly=c[2]; break;}
            case "M": { ctx.moveTo(lx+c[1],ly+c[2]); lx+=c[1]; ly+=c[2]; break;}
            case "L": { ctx.lineTo(lx+c[1],ly+c[2]); lx+=c[1]; ly+=c[2]; break;}
            case "a": { ctx.arc(c[1],c[2],c[3],c[4]*d2r, c[5]*d2r); lx=c[1]; ly=c[2]; break;}
            case "c": { ctx.arc(c[1],c[2],c[3],0,Math.PI*2); lx=c[1]; ly=c[2]; break;}
            case "r": { const angle=c[1]*d2r; const c=Math.cos(angle); const s=Math.sin(angle); ctx.setTransform(c,-s,s,c,0,0); break; }
            case "sc": { ctx.transform(c[1],0,0,c[2],0,0); break; }
            case "t": { ctx.transform(1,0,0,1,c[1],c[2]); break; }
            case "T": { ctx.transform(c[1],c[2],c[3],c[4],c[5],c[6]); break; }
            case "W": { ctx.lineWidth=style(c[1]); break; }
            case "w": { ctx.lineWidth=c[1]; break; }
            case "S": { ctx.strokeStyle=style(c[1]); break; }
            case "F": { ctx.fillStyle=style(c[1]); break; }
            case "s": { ctx.stroke(); break; }
            case "f": { ctx.fill(); break; }
            }
        }
    }
}

