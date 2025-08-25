//a StylingNight
//c StylingNight
/// The styles required for night mode
class StylingNight {

    // sky view
    //
    // grid colors are: above-horizon, below-horizon/great circles, ecliptic, RA=0, Ra=180
    sky = {azimuthal_grid: ["#733", "#522", "#c44", "#c44", "#943"],
           equatorial_grid: ["#515", "#515", "#c37", "#c37", "#925"],
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#733", "#522", "#c44", "#c44", "#943"],
           equatorial_grid: ["#515", "#515", "#c37", "#c37", "#925"],
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    earth = {color:[1.0,0,0,0.7],
            };

    compass = {
        canvas: "black",
        body: "#611",
        bg: "#211",
        markers: "#933",
    };
    elevation = {
        canvas: "black",
        scale: "#722",
        marker: "#933",
    };
    clock = {
        canvas: "black",
        rim: "#522",
        face: "#311",
        minute: "#933",
        hour: "#722",
        sun: "#ff0",
        moon: "#777",
    };
    
    css = "night";
    show_azimuthal = true;
    show_equatorial = true;
}

//a StylingDay
/// The styles required for day mode
class StylingDay {

    sky = {azimuthal_grid:  ["#b22", "#b33", "#b88", "#b88", "#b55"],
           equatorial_grid: ["#292", "#292", "#4f4", "#4f4", "#3c3"],
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#b22", "#b33", "#b88", "#b88", "#b55"],
           equatorial_grid: ["#292", "#292", "#4f4", "#4f4", "#3c3"],
           view_border: ["#f77", "#77f", "#7f7", "#77f"],
          };

    earth = {color:[1,1,1,1],
            };


    compass = {
        canvas: "white",
        body: "#888",
        bg: "#445",
        markers: "#bb8",
    };
    elevation = {
        canvas: "white",
        scale: "#888",
        marker: "#445",
    };
    clock = {
        canvas: "white",
        rim: "#888",
        face: "#445",
        minute: "#aa7",
        hour: "#cc8",
        sun: "#ff0",
        moon: "#777",
    };
    

    css = "day";

    show_azimuthal = true;
    show_equatorial = true;
}

//a Styling
//c Styling
export class Styling {
    //cp constructor
    constructor(day_or_night) {
        this.map = {};
        this.sky = {};
        if (day_or_night == "day") {
            this.set("day");
        } else {
            this.set("night");
        }
        this.sky.show_equatorial = false;
        this.sky.show_azimuthal = false;
        this.map.show_equatorial = false;
        this.map.show_azimuthal = false;

        this.sky["show_equatorial"] = true;
        this.sky["show_azimuthal"] = true;
        this.map["show_equatorial"] = true;
        this.map["show_azimuthal"] = true;
    }

    //mp set
    /// Set the mode to be either 'day' or 'night'
    set(mode) {
        if (mode == "day") {
            this.set_styling_class(StylingDay);
        } else {
            this.set_styling_class(StylingNight);
        }
    }

    //mi set_styling_class
    /// Set the styling class (StylingNight or StylingDay)
    set_styling_class(styling_class) {
        this.base_styling = new styling_class();
        this.map = Object.assign(this.map, this.base_styling.map);
        this.sky = Object.assign(this.sky, this.base_styling.sky);
        this.earth = Object.assign({}, this.base_styling.earth);
        this.compass = Object.assign({}, this.base_styling.compass);
        this.elevation = Object.assign({}, this.base_styling.elevation);
        this.clock = Object.assign({}, this.base_styling.clock);
        this.css = this.base_styling.css;
        this.set_css();
    }

    //mi set_css
    /// Set all elements with a 'dn' class to be also in night or day
    set_css() {
        for (const e of document.getElementsByClassName("dn")) {
            var new_class_name = ""
            for (const c of e.getAttribute("class").split(' ')) {
                if (c=="dn") {
                    break;
                }
                new_class_name += c + " ";
            }
            e.setAttribute("class", new_class_name + "dn " + this.css);
        }
    }

    //zz All done
}
