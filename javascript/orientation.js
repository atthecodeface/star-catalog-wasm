export class Orientation {
    constructor(orientable) {
        this.permitted = false;
        this.enabled = false;
        this.orientable = orientable;
        this.req_perm = DeviceOrientationEvent.requestPermission;
        this.callback = this.orientable.orientation.bind(this.orientable);
        orientable.orientation_permitted(false);
    }
    request_permission() {
        if (typeof this.req_perm === "function") {
            this.orientable.orientation_permitted(false);
            this.req_perm().then((orientationPermission) => {
                if (orientationPermission === "granted") {
                    this.permitted = true;
                    this.orientable.orientation_permitted(true);
                }
                else {
                    this.orientable.orientation_permitted(false);
                }
            });
        }
        else {
            this.permitted = true;
            requestAnimationFrame(() => this.orientable.orientation_permitted(true));
        }
    }
    enable() {
        const callback = this.callback;
        if (this.permitted) {
            if (!this.enabled) {
                window.addEventListener("deviceorientation", callback);
                this.enabled = true;
            }
            return true;
        }
        else {
            return false;
        }
    }
    disable() {
        const callback = this.callback;
        if (this.enabled) {
            window.removeEventListener("deviceorientation", callback);
            this.enabled = false;
        }
    }
}
