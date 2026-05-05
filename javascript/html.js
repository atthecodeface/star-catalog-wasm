/**
 * History
 *
 * 12 April:
 *
 *   Converted to TypeScript (temporarily removed DbStorage)
 *
 *   Added  input get/set methods
 *
 *   Removed global 'clear' function - use an HtmlElement and its clear method
 *
 *   Removed global add_ele and if_ele_id
 *
 * 31 March: Directory methods take files in root, suffix rather than the other ways round
 *
 */
/**
 * Get the value of a float fron an HTMLInputElement, bounded by min and max,
 * with a default of the ID cannot be found
 *
 * @param {string} id The id of an HTMLInputElement whose value is to be read
 * @param {number} min The minimum value that the ID must have
 * @param {number} max The maximum value that the ID must have
 * @param {number} deflt? Optional default value to return if the ID does not correspond to an HTMLInputElement
 * @returns {number} the value in the HTMLInputElement bounded by min and max, or the default value. It updates the value in the HTMLInputElement.
 **/
export function get_input_float(id, min, max, deflt) {
    const e = document.getElementById(id);
    if (!(e instanceof HTMLInputElement)) {
        if (deflt !== undefined) {
            return deflt;
        }
        else {
            return min;
        }
    }
    var p = Number.parseFloat(e.value);
    if (!(p >= min)) {
        p = min;
    }
    if (p > max) {
        p = max;
    }
    e.value = p.toString();
    return p;
}
/**
 * Get the value of an int fron an HTMLInputElement, bounded by min and max,
 * with a default of the ID cannot be found
 *
 * @param {string} id The id of an HTMLInputElement whose value is to be read
 * @param {number} min The minimum value that the ID must have
 * @param {number} max The maximum value that the ID must have
 * @param {number} deflt? Optional default value to return if the ID does not correspond to an HTMLInputElement
 * @returns {number} the value in the HTMLInputElement bounded by min and max, or the default value. It updates the value in the HTMLInputElement.
 */
export function get_input_int(id, min, max, deflt) {
    const e = document.getElementById(id);
    if (!(e instanceof HTMLInputElement)) {
        if (deflt !== undefined) {
            return deflt;
        }
        else {
            return min;
        }
    }
    var p = Number.parseInt(e.value);
    if (!(p >= min)) {
        p = min;
    }
    if (p > max) {
        p = max;
    }
    e.value = p.toString();
    return p;
}
/**
 * Set the value of an HTMLInputElement given by an id
 *
 * @param {string} id The id of the HTMLInputElement whose value should be set
 * @param {any} value The value to set; the 'toString' method is invoked on this to create the value
 */
export function set_input_value(id, value) {
    const e = document.getElementById(id);
    if (e instanceof HTMLInputElement) {
        e.value = value.toString();
    }
}
/**
 * Set the 'checked' attribute of an HTMLInputElement to the provide true/false value
 *
 * @param {string} id The id of the HTMLInputElement whose checked should be set
 * @param {boolean} checked The value to set the 'checked' attribute to
 */
export function set_input_checked(id, checked) {
    const e = document.getElementById(id);
    if (e instanceof HTMLInputElement) {
        e.checked = checked;
    }
}
/**
 *
 * @param id
 * @param min
 * @param max
 */
export function set_input_range(id, min, max) {
    const e = document.getElementById(id);
    if (e instanceof HTMLInputElement) {
        e.min = min.toString();
        e.max = max.toString();
    }
}
/**
 *
 * @param id
 * @returns
 */
export function get_input_checked(id) {
    const e = document.getElementById(id);
    if (e instanceof HTMLInputElement) {
        return e.checked;
    }
    else {
        return false;
    }
}
/**
 *
 * @param parent_id
 * @returns
 */
export function get_input_radio_checked(parent_id) {
    const e = document.getElementById(parent_id);
    if (e === null) {
        return null;
    }
    const selected_e = e.querySelector(":checked");
    if (selected_e instanceof HTMLInputElement) {
        return selected_e.value;
    }
    else {
        return null;
    }
}
export class HtmlElement {
    static set_id_classes(doc_ele, id_classes) {
        if (id_classes.id !== undefined) {
            doc_ele.id = id_classes.id;
        }
        if (id_classes.classes !== undefined) {
            doc_ele.className = id_classes.classes;
        }
        if (id_classes.tag_values !== undefined) {
            for (const [tag, value] of id_classes.tag_values) {
                doc_ele.setAttribute(tag, value);
            }
        }
    }
    static new_ele(ele_type, id_classes = {}, tag_values = [], map = null) {
        const ele = document.createElement(ele_type);
        const self = new HtmlElement(ele, id_classes, tag_values);
        if (map !== null) {
            map(self);
        }
        return self;
    }
    static all_of(selector) {
        const result = [];
        for (const e of document.querySelectorAll(selector)) {
            if (e instanceof HTMLElement) {
                result.push(new HtmlElement(e));
            }
        }
        return result;
    }
    constructor(ele, id_classes = {}, tag_values = []) {
        this.ele = ele;
        this.range = { min: 0, max: 0, value: 0, step: 1 };
        HtmlElement.set_id_classes(ele, id_classes);
        this.add_tags(tag_values);
    }
    clear() {
        while (this.ele.firstChild) {
            this.ele.removeChild(this.ele.firstChild);
        }
        return this;
    }
    add_ele(ele_type, id_classes = {}, tag_values = []) {
        const ele = document.createElement(ele_type);
        this.ele.appendChild(ele);
        return new HtmlElement(ele, id_classes, tag_values);
    }
    add_tags(tag_values) {
        for (const [tag, value] of tag_values) {
            this.ele.setAttribute(tag, value);
        }
        return this;
    }
    add_content(content) {
        if (content instanceof Node) {
            this.ele.appendChild(content);
        }
        else if (content instanceof HtmlElement) {
            this.ele.appendChild(content.ele);
        }
        else {
            this.ele.insertAdjacentText("afterbegin", content);
        }
        return this;
    }
    add_input_button(value, callback, id_classes = {}) {
        const html_input = this.add_ele("input", id_classes, [
            ["type", "button"],
            ["value", value],
        ]);
        const input = html_input.ele;
        input.addEventListener("click", callback);
        return html_input;
    }
    add_input_checkbox(name, callback = null, id_classes = {}) {
        const html_input = this.add_ele("input", id_classes, [
            ["type", "checkbox"],
            ["name", name],
        ]);
        const input = html_input.ele;
        if (callback !== null) {
            input.addEventListener("input", (e) => {
                callback(e, input.checked);
            });
        }
        return html_input;
    }
    add_input_radio(name, value, required, callback = null, id_classes = {}) {
        const html_input = this.add_ele("input", id_classes, [
            ["type", "radio"],
            ["name", name],
            ["value", value],
        ]);
        const input = html_input.ele;
        if (required) {
            input.setAttribute("required", "true");
        }
        if (callback !== null) {
            input.addEventListener("change", (e) => {
                callback(e, input.value);
            });
        }
        return html_input;
    }
    add_input_range(name, range, callback = null, id_classes = {}) {
        const html_input = this.add_ele("input", id_classes, [
            ["type", "range"],
            ["name", name],
        ]);
        const input = html_input.ele;
        html_input.set_input_range(range);
        if (callback !== null) {
            input.addEventListener("input", (e) => {
                var value;
                if (html_input.range.step == 1) {
                    value = Number.parseInt(input.value);
                }
                else {
                    value = Number.parseFloat(input.value);
                }
                callback(e, value);
            });
        }
        return html_input;
    }
    add_input_text(name, value, callback = null, id_classes = {}) {
        const html_input = this.add_ele("input", id_classes, [
            ["type", "text"],
            ["name", name],
            ["value", value],
        ]);
        const input = html_input.ele;
        if (callback !== null) {
            input.addEventListener("input", (e) => {
                const value = input.value;
                callback(e, value);
            });
        }
        return html_input;
    }
    /**
     *
     * In the callback, to retrieve multiple options, event.target.selectedOptions
     *
     * @param name
     * @param values_labels
     * @param default_value
     * @param required
     * @param multiple
     * @param callback
     * @param id_classes
     * @returns
     */
    add_input_dropdown(name, values_labels, default_value = null, required, multiple, callback = null, id_classes = {}) {
        const html_select = this.add_ele("select", id_classes, [["name", name]]);
        const select = html_select.ele;
        if (required) {
            select.setAttribute("required", "true");
        }
        if (multiple) {
            select.setAttribute("multiple", "true");
        }
        for (const [value, label] of values_labels) {
            const option = document.createElement("option");
            option.text = label;
            option.value = value;
            select.appendChild(option);
        }
        if (callback !== null) {
            select.addEventListener("change", (e) => {
                callback(e, select.value);
            });
        }
        if (default_value !== null) {
            select.value = default_value;
        }
        return html_select;
    }
    add_label(for_input, id_classes = {}) {
        const label = document.createElement("label");
        if (for_input) {
            label.setAttribute("for", for_input);
        }
        this.ele.appendChild(label);
        return new HtmlElement(label, id_classes);
    }
    input_checked() {
        if (this.ele instanceof HTMLInputElement) {
            return this.ele.checked;
        }
        else {
            return false;
        }
    }
    input_number_bounded(value) {
        if (!(value >= this.range.min)) {
            this.ele.value = this.range.min.toString();
            return this.range.min;
        }
        if (value > this.range.max) {
            this.ele.value = this.range.max.toString();
            return this.range.max;
        }
        return value;
    }
    input_float() {
        if (!(this.ele instanceof HTMLInputElement)) {
            return this.range.value;
        }
        return this.input_number_bounded(Number.parseFloat(this.ele.value));
    }
    input_int() {
        if (!(this.ele instanceof HTMLInputElement)) {
            return this.range.value;
        }
        return this.input_number_bounded(Number.parseInt(this.ele.value));
    }
    input_radio_checked() {
        const selected_e = this.ele.querySelector(":checked");
        if (selected_e instanceof HTMLInputElement) {
            return selected_e.value;
        }
        else {
            return null;
        }
    }
    set_input_range(range) {
        const e = this.ele;
        if (!(e instanceof HTMLInputElement)) {
            return;
        }
        this.range.value = range.min;
        if (range.value !== undefined) {
            e.setAttribute("value", range.value.toString());
            this.range.value = range.value;
        }
        let step = 1;
        if (range.step !== undefined) {
            step = range.step;
        }
        this.range.min = range.min;
        this.range.max = range.max;
        this.range.step = step;
        e.setAttribute("min", range.min.toString());
        e.setAttribute("max", range.max.toString());
        e.setAttribute("step", step.toString());
    }
    set_input_value(value) {
        if (this.ele instanceof HTMLInputElement) {
            this.ele.value = value.toString();
        }
        return this;
    }
    set_input_checked(checked) {
        if (this.ele instanceof HTMLInputElement) {
            this.ele.checked = checked;
        }
        return this;
    }
    set_style(style, value) {
        /* This is not supported by FireFox
        if (value) {
          this.ele.attributeStyleMap.set(style, value);
        } else {
          this.ele.attributeStyleMap.delete(style);
        }
        */
        if (value) {
            this.ele.style = `${style}: ${value};`;
        }
        else {
            this.ele.style = "";
        }
        return this;
    }
}
export class Table {
    constructor(classes) {
        this.classes = classes;
        this.headings = [];
        this.heading_classes = "";
        this.body = [];
    }
    add_headings(headings) {
        for (const h of headings) {
            this.headings.push(h);
        }
    }
    add_body(body_elements) {
        this.body.push(body_elements);
    }
    as_html() {
        const table = HtmlElement.new_ele("table", { classes: this.classes });
        if (this.headings.length > 0) {
            const tr = table.add_ele("tr", { classes: this.heading_classes });
            let i = 0;
            for (const h of this.headings) {
                const th = tr.add_ele("th");
                th.add_content(h);
                i += 1;
            }
        }
        for (const c of this.body) {
            const tr = table.add_ele("tr");
            for (const d of c) {
                const td = tr.add_ele("td");
                td.add_content(d);
            }
        }
        return table;
    }
    as_vertical_html() {
        const table = HtmlElement.new_ele("table", { classes: this.classes });
        for (let i = 0; i < this.body.length; i++) {
            const tr = table.add_ele("tr");
            const th = tr.add_ele("th", { classes: this.heading_classes });
            if (i < this.headings.length) {
                th.add_content(this.headings[i]);
            }
            const c = this.body[i];
            for (const d of c) {
                tr.add_ele("td").add_content(d);
            }
        }
        return table;
    }
}
