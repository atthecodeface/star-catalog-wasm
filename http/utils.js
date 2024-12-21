//fp is_array
export function is_array(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
}

//fp is_string
export function is_string(obj) {
    return typeof obj === "string";
}

//fp is_float
export function is_float(obj) {
    return typeof obj === "number";
}

//fp parse_json
export function parse_json(data) {
    const regex = new RegExp("//[^\n]*", "g");
    data = data.replaceAll(regex, "");
    try {
        const obj = JSON.parse(data);
        return obj;
    } catch (e) {
        return;
    }
}

//fp strcmp
export function strcmp(a, b) {
    return (a<b) ? -1 : (0+(a>b));
}

//mp round_to_multiple
export function round_to_multiple(x, m, to=0 ) {
    if (to==0) {
        return m * Math.round(x/m);
    } else if (to<0) {
        return m * Math.floor(x/m);
    } else {
        return m * Math.ceil(x/m);
    }
}

