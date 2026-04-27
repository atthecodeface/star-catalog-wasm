class SkyStyling {
  azimuthal_grid: string[] = [];
  equatorial_grid: string[] = [];
  view_border: string[] = [];
  show_azimuthal: boolean = false;
  show_equatorial: boolean = false;
}

export class Styling {
  sky: SkyStyling = new SkyStyling();
  map: SkyStyling = new SkyStyling();

  earth: { color: number[] } = { color: [] };
  compass: { canvas: string; body: string; bg: string; markers: string } = {
    canvas: "",
    body: "",
    bg: "",
    markers: "",
  };
  elevation: { canvas: string; scale: string; marker: string } = {
    canvas: "",
    scale: "",
    marker: "",
  };
  clock: {
    canvas: string;
    rim: string;
    face: string;
    minute: string;
    hour: string;
    sun: string;
    moon: string;
  } = {
    canvas: "",
    rim: "",
    face: "",
    minute: "",
    hour: "",
    sun: "",
    moon: "",
  };

  css: string = "night";
  show_azimuthal: boolean = false;
  show_equatorial: boolean = false;

  constructor(day_or_night: string) {
    this.set(day_or_night);
  }

  set(day_or_night: string) {
    if (day_or_night == "day") {
      this.set_day();
    } else {
      this.set_night();
    }
    this.set_css();
  }

  set_day(): void {
    this.sky.azimuthal_grid = ["#b22", "#b33", "#b88", "#b88", "#b55"];
    this.sky.equatorial_grid = ["#292", "#292", "#4f4", "#4f4", "#3c3"];
    this.sky.view_border = ["Red", "Blue", "Green", "Blue"];

    this.map.azimuthal_grid = ["#b22", "#b33", "#b88", "#b88", "#b55"];
    this.map.equatorial_grid = ["#292", "#292", "#4f4", "#4f4", "#3c3"];
    this.map.view_border = ["#f77", "#77f", "#7f7", "#77f"];

    this.earth.color = [1, 1, 1, 1];

    this.compass.canvas = "white";
    this.compass.body = "#888";
    this.compass.bg = "#445";
    this.compass.markers = "#bb8";

    this.elevation.canvas = "white";
    this.elevation.scale = "#888";
    this.elevation.marker = "#445";

    this.clock.canvas = "white";
    this.clock.rim = "#888";
    this.clock.face = "#445";
    this.clock.minute = "#aa7";
    this.clock.hour = "#cc8";
    this.clock.sun = "#ff0";
    this.clock.moon = "#777";

    this.css = "day";

    // this.show_azimuthal = true;
    // this.show_equatorial = true;
  }

  set_night(): void {
    this.sky.azimuthal_grid = ["#733", "#522", "#c44", "#c44", "#943"];
    this.sky.equatorial_grid = ["#515", "#515", "#c37", "#c37", "#925"];
    this.sky.view_border = ["Red", "Blue", "Green", "Blue"];

    this.map.azimuthal_grid = ["#733", "#522", "#c44", "#c44", "#943"];
    this.map.equatorial_grid = ["#515", "#515", "#c37", "#c37", "#925"];
    this.map.view_border = ["Red", "Blue", "Green", "Blue"];

    this.earth.color = [1.0, 0, 0, 0.7];

    this.compass.canvas = "black";
    this.compass.body = "#611";
    this.compass.bg = "#211";
    this.compass.markers = "#933";

    this.elevation.canvas = "black";
    this.elevation.scale = "#722";
    this.elevation.marker = "#933";

    this.clock.canvas = "black";
    this.clock.rim = "#522";
    this.clock.face = "#311";
    this.clock.minute = "#933";
    this.clock.hour = "#722";
    this.clock.sun = "#ff0";
    this.clock.moon = "#777";

    this.css = "night";
    // this.show_azimuthal = true;
    // this.show_equatorial = true;
  }

  /// Set all elements with a 'dn' class to be also in night or day
  set_css() {
    for (const e of document.getElementsByClassName("dn")) {
      var new_class_name = "";
      for (const c of e.getAttribute("class")!.split(" ")) {
        if (c == "dn") {
          break;
        }
        new_class_name += c + " ";
      }
      e.setAttribute("class", new_class_name + "dn " + this.css);
    }
  }
}
