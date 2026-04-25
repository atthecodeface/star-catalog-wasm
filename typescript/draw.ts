export class Line {
  ctx: CanvasRenderingContext2D;
  last_cxy: null | [number, number];
  max_step: number;
  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.last_cxy = null;
    this.max_step = Math.sqrt(width * height) / 2;
    this.ctx.beginPath();
  }

  new_segment() {
    this.last_cxy = null;
  }

  add_pt(cxy: [number, number]) {
    if (cxy == null) {
    } else if (this.last_cxy == null) {
      this.ctx.moveTo(cxy[0], cxy[1]);
    } else if (
      Math.abs(this.last_cxy[0] - cxy[0]) +
        Math.abs(this.last_cxy[1] - cxy[1]) <
      this.max_step
    ) {
      this.ctx.lineTo(cxy[0], cxy[1]);
    } else {
      this.ctx.moveTo(cxy[0], cxy[1]);
    }
    this.last_cxy = cxy;
  }
  finish() {
    this.ctx.stroke();
    this.ctx.beginPath();
  }
}

export class Draw {
  contents: (string | number)[][];
  constructor(contents: (string | number)[][]) {
    this.contents = contents;
  }

  static arrow(length: number, head: number = 0) {
    const contents = [
      ["w", 2],
      ["b"],
      ["m", 0, 0],
      ["l", length, 0],
      ["l", length - head, head],
      ["m", length, 0],
      ["l", length - head, -head],
      ["s"],
    ];
    return new Draw(contents);
  }

  static set_transform(
    ctx: CanvasRenderingContext2D,
    cxy: [number, number] | null,
    scale: number | null,
    angle: number | null,
  ) {
    const d2r = Math.PI / 180;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (cxy !== null) {
      ctx.transform(1, 0, 0, 1, cxy[0], cxy[1]);
    }
    if (scale !== null) {
      ctx.transform(scale, 0, 0, scale, 0, 0);
    }
    if (angle !== null) {
      angle = angle * d2r;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      ctx.transform(c, -s, s, c, 0, 0);
    }
  }
  draw(ctx: CanvasRenderingContext2D, style: (x: any) => any) {
    let lx = 0;
    let ly = 0;
    const d2r = Math.PI / 180;
    for (const c of this.contents) {
      switch (c[0]) {
        case "push": {
          ctx.save();
          break;
        }
        case "pop": {
          ctx.restore();
          break;
        }
        case "b": {
          ctx.beginPath();
          break;
        }
        case "m": {
          lx = c[1] as number;
          ly = c[2] as number;
          ctx.moveTo(lx, ly);
          break;
        }
        case "l": {
          lx = c[1] as number;
          ly = c[2] as number;
          ctx.lineTo(lx, ly);
          break;
        }
        case "M": {
          lx += c[1] as number;
          ly += c[2] as number;
          ctx.moveTo(lx, ly);
          break;
        }
        case "L": {
          lx += c[1] as number;
          ly += c[2] as number;
          ctx.lineTo(lx, ly);
          break;
        }
        case "a": {
          ctx.arc(
            c[1] as number,
            c[2] as number,
            c[3] as number,
            (c[4] as number) * d2r,
            (c[5] as number) * d2r,
          );
          lx = c[1] as number;
          ly = c[2] as number;
          break;
        }
        case "c": {
          ctx.arc(
            c[1] as number,
            c[2] as number,
            c[3] as number,
            0,
            Math.PI * 2,
          );
          lx = c[1] as number;
          ly = c[2] as number;
          break;
        }
        case "r": {
          const angle = (c[1] as number) * d2r;
          const ca = Math.cos(angle);
          const sa = Math.sin(angle);
          ctx.setTransform(ca, -sa, sa, ca, 0, 0);
          break;
        }
        case "sc": {
          ctx.transform(c[1] as number, 0, 0, c[2] as number, 0, 0);
          break;
        }
        case "t": {
          ctx.transform(1, 0, 0, 1, c[1] as number, c[2] as number);
          break;
        }
        case "T": {
          ctx.transform(
            c[1] as number,
            c[2] as number,
            c[3] as number,
            c[4] as number,
            c[5] as number,
            c[6] as number,
          );
          break;
        }
        case "W": {
          ctx.lineWidth = style(c[1]);
          break;
        }
        case "w": {
          ctx.lineWidth = c[1] as number;
          break;
        }
        case "S": {
          ctx.strokeStyle = style(c[1]);
          break;
        }
        case "F": {
          ctx.fillStyle = style(c[1]);
          break;
        }
        case "s": {
          ctx.stroke();
          break;
        }
        case "f": {
          ctx.fill();
          break;
        }
      }
    }
  }
}
