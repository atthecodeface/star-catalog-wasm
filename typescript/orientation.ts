export interface Orientable {
  orientation_permitted: (granted: boolean) => void;
  orientation: (e: DeviceOrientationEvent) => void;
}

export class Orientation {
  permitted: boolean = false;
  enabled: boolean = false;
  req_perm: any;
  orientable: Orientable;
  callback: any;

  constructor(orientable: Orientable) {
    this.orientable = orientable;
    this.req_perm = (DeviceOrientationEvent as any).requestPermission;
    this.callback = this.orientable.orientation.bind(this.orientable);
    orientable.orientation_permitted(false);
  }

  request_permission(): void {
    if (typeof this.req_perm === "function") {
      this.orientable.orientation_permitted(false);
      this.req_perm().then((orientationPermission: string) => {
        if (orientationPermission === "granted") {
          this.permitted = true;
          this.orientable.orientation_permitted(true);
        } else {
          this.orientable.orientation_permitted(false);
        }
      });
    } else {
      this.permitted = true;
      requestAnimationFrame(() => this.orientable.orientation_permitted(true));
    }
  }

  enable(): boolean {
    const callback = this.callback;
    if (this.permitted) {
      if (!this.enabled) {
        window.addEventListener("deviceorientation", callback);
        this.enabled = true;
      }
      return true;
    } else {
      return false;
    }
  }

  disable(): void {
    const callback = this.callback;
    if (this.enabled) {
      window.removeEventListener("deviceorientation", callback);
      this.enabled = false;
    }
  }
}
