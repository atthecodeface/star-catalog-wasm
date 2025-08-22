//a StylingNight
//c StylingNight
/// The styles required for night mode
class StylingNight {

    sky = {azimuthal_grid: "#772222",
           equatorial_grid: "#771155",
           ecliptic: "#552255",
           meridian: "#552255",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#552222", "#993333",],
           equatorial_grid: "#771155",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    earth = {color:[1.0,0,0,0.7],
            };

    css = "night";
    show_azimuthal = true;
    show_equatorial = true;
}

//a StylingDay
/// The styles required for day mode
class StylingDay {

    sky = {azimuthal_grid: "#ff2222",
           equatorial_grid: "#229922",
           ecliptic: "#552255",
           meridian: "#552255",
           view_border: ["Red", "Blue", "Green", "Blue"],
          };

    map = {azimuthal_grid: ["#ff2222", "#ff5555",],
           equatorial_grid: "#229922",
           view_border: ["#ff6666", "#6666ff66", "#66ff66", "#6666ff66"],
          };

    earth = {color:[1,1,1,1],
            };

    css = "day";

    show_azimuthal = true;
    show_equatorial = true;
}

//a Styling
//c Styling
export class Styling {
    //cp constructor
    constructor() {
        this.map = {};
        this.sky = {};
        this.set("night");
        this.sky.show_equatorial = false;
        this.sky.show_azimuthal = false;
        this.map.show_equatorial = false;
        this.map.show_azimuthal = false;

        this.sky["show_equatorial"] = true;
        this.sky["show_azimuthal"] = true;
        this.map["show_equatorial"] = true;
        this.map["show_azimuthal"] = true;

        console.log(this);
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
