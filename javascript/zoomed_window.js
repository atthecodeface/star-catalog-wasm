//a ZoomedWindow
// This has an image that is WxH, and that is zoomed and panned to make
// it visible on the screen
//
// The zoomed image has size Z.w x Z.h
//
// The screen is a window into the zoomed image of size w x h
// (so one zoom pixel is the same size as one screen pixel) at a
// top-left offset of zoom_scr_ofs
//
// The zoom can scale from 1 (as the zoomed image is always at least
// the same width as the screen) up to 10 screen/zoomed pixels per
// image pixel (if max_zoom_px_per_img_px is 10)
//
// There are therefore three coordinate systems
//
//  1. The image being shown, of size img_wh
//
//  2. Screen window which is of size scr_wh
//
//  3. Zoomed window which is of size zoom_wh = zoom * scr_wh
//
//  The image maps completely to zoom window (0,0) -> (zoom_wh) (*width*)
//    Note this assumes that scr w/scr h is < img_w/img_h!!!
//
//  The screen windows shows a scr_wh sized portion of the zoomed
//  window, with a top level at zoom_scr_ofs
//
//  For convenience, this.zoom_px_of_img_px = zoom_wh / this.img_wh
//
//  Thus scr tl is at zoom_scr_ofs into zoomed window
//    which is at image offset zoom_scr_ofs * img_wh / zoom_wh = zoom_scr_ofs / zoom_px_of_img_px
//
//  And scr width has image width scr_wh / zoom_wh * img_wh = img_wh / zoom
//
//  Given scr tl cannot be < 0, zoom_scr_ofs cannot be < 0
//
//  And for the RH edge zoom_scr_ofs  <= (zoom_wh - scr_wh)
export class ZoomedWindow {
    constructor(scr_wh) {
        this.min_zoom = 1.0;
        this.max_zoom = 1.0;
        this.zoom = 1.0;
        this.img_wh = [0, 0];
        this.scr_wh = [0, 0];
        this.zoom_wh = [0, 0];
        this.zoom_scr_ofs = [0, 0];
        this.max_zoom_px_per_img_px = 10;
        this.zoom_px_of_img_px = 1.0;
        this.scr_wh = [scr_wh[0], scr_wh[1]];
        this.zoom_wh = [scr_wh[0], scr_wh[1]];
    }
    get_zoom() {
        return this.zoom;
    }
    get_scr_wh() {
        return this.scr_wh;
    }
    get_img_cxy() {
        return [this.img_wh[0] / 2, this.img_wh[1] / 2];
    }
    get_zoomed_img_bounds() {
        const lx = this.zoom_scr_ofs[0] / this.zoom_px_of_img_px;
        const ty = this.zoom_scr_ofs[1] / this.zoom_px_of_img_px;
        const w = this.img_wh[0] / this.zoom;
        // const h = ((this.img_wh[0] / this.zoom) * this.scr_wh[1]) / this.scr_wh[0];
        const h = this.img_wh[1] / this.zoom;
        return [lx, ty, w, h];
    }
    set_img(w, h) {
        this.img_wh = [w, h];
        this.recalculate_zoom();
    }
    set_zoom_scr(lx, ty) {
        this.zoom_scr_ofs[0] = lx;
        this.zoom_scr_ofs[1] = ty;
    }
    zoom_scr_by(lx, ty) {
        this.zoom_scr_ofs[0] += lx;
        this.zoom_scr_ofs[1] += ty;
        this.zoom_set(this.zoom);
    }
    // Set the zoom to a specific factor
    //
    // Returns the scale factor from the current zoom to the actual new zoom
    recalculate_zoom() {
        this.min_zoom = 1.0;
        this.max_zoom = 1.0;
        if (this.img_wh[0] > 0) {
            this.max_zoom =
                (this.img_wh[0] * this.max_zoom_px_per_img_px) / this.scr_wh[0];
        }
        this.zoom_set(this.zoom);
    }
    // Set the zoom to a specific factor
    //
    // Returns the scale factor from the current zoom to the actual new zoom
    //
    // If focus_xy is provided it is in screen coordinates
    // (i.e. zoomed pixels relative to the top-left); if not it is
    // deemed to be the centre of the current window (i.e. scr_wh[]/2)
    zoom_set(zoom, focus_xy) {
        if (zoom > this.max_zoom) {
            zoom = this.max_zoom;
        }
        if (isNaN(zoom) || zoom < this.min_zoom) {
            zoom = this.min_zoom;
        }
        const rescale_factor = zoom / this.zoom;
        this.zoom = zoom;
        this.zoom_wh[0] = this.zoom * this.scr_wh[0];
        this.zoom_wh[1] = this.zoom * this.scr_wh[1];
        this.zoom_px_of_img_px = 1.0;
        if (this.img_wh[0] > 0) {
            this.zoom_px_of_img_px = this.zoom_wh[0] / this.img_wh[0];
        }
        if (focus_xy === undefined) {
            focus_xy = [this.scr_wh[0] / 2, this.scr_wh[1] / 2];
        }
        this.zoom_scr_ofs[0] =
            this.zoom_scr_ofs[0] * rescale_factor +
                (rescale_factor - 1) * focus_xy[0];
        this.zoom_scr_ofs[1] =
            this.zoom_scr_ofs[1] * rescale_factor +
                (rescale_factor - 1) * focus_xy[1];
        if (this.zoom_scr_ofs[0] > this.zoom_wh[0] - this.scr_wh[0]) {
            this.zoom_scr_ofs[0] = this.zoom_wh[0] - this.scr_wh[0];
        }
        if (this.zoom_scr_ofs[1] > this.zoom_wh[1] - this.scr_wh[1]) {
            this.zoom_scr_ofs[1] = this.zoom_wh[1] - this.scr_wh[1];
        }
        if (this.zoom_scr_ofs[0] < 0) {
            this.zoom_scr_ofs[0] = 0;
        }
        if (this.zoom_scr_ofs[1] < 0) {
            this.zoom_scr_ofs[1] = 0;
        }
        return rescale_factor;
    }
    img_cxy() {
        return [this.img_wh[0] / 2, this.img_wh[1] / 2];
    }
    // Get a screen XY of an image XY
    //
    // Map to the zoom space and account for the top-left of the screen window on the zoom area
    scr_xy_of_img_xy(img_xy) {
        return [
            img_xy[0] * this.zoom_px_of_img_px - this.zoom_scr_ofs[0],
            img_xy[1] * this.zoom_px_of_img_px - this.zoom_scr_ofs[1],
        ];
    }
    // Get an image XY of a screen XY
    //
    // Map from the zoom space and account for the top-left of the screen window on the zoom area
    img_xy_of_scr_xy(scr_xy) {
        return [
            (scr_xy[0] + this.zoom_scr_ofs[0]) / this.zoom_px_of_img_px,
            (scr_xy[1] + this.zoom_scr_ofs[1]) / this.zoom_px_of_img_px,
        ];
    }
    img_bounds() {
        const img_cxy = this.img_cxy();
        const img_lx = this.zoom_scr_ofs[0] / this.zoom_px_of_img_px - img_cxy[0];
        const img_ty = this.zoom_scr_ofs[1] / this.zoom_px_of_img_px - img_cxy[1];
        const img_rx = (this.zoom_scr_ofs[0] + this.zoom_wh[0]) / this.zoom_px_of_img_px -
            img_cxy[0];
        const img_by = (this.zoom_scr_ofs[1] + this.zoom_wh[1]) / this.zoom_px_of_img_px -
            img_cxy[1];
        return [img_lx, img_ty, img_rx, img_by];
    }
    // For a given image XY, set the scr offset
    // so that the image XY is in the center of the screen (if
    // possible)
    scr_focus_on_xy(img_xy) {
        const scr_lx = img_xy[0] * this.zoom_px_of_img_px - this.scr_wh[0] / 2;
        const scr_ty = img_xy[1] * this.zoom_px_of_img_px - this.scr_wh[1] / 2;
        this.zoom_scr_ofs = [scr_lx, scr_ty];
    }
    scr_resize(w, h) {
        const zoom_factor = Math.sqrt((w * h) / (this.scr_wh[0] * this.scr_wh[1]));
        const new_zoom = this.zoom * zoom_factor;
        this.scr_wh = [w, h];
        this.zoom_set(new_zoom);
    }
}
