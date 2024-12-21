//mp position
export function position(c, dp=2) {
    if (c.length == 3) {
        c = [c[0].toFixed(dp),
             c[1].toFixed(dp),
             c[2].toFixed(dp),
            ];
        return `${c[0]}, ${c[1]}, ${c[2]}`;
    } else {
        c = [c[0].toFixed(dp),
             c[1].toFixed(dp),
            ];
        return `(${c[0]}, ${c[1]})`;
    }
}

//mp clear
export function clear(id) {
    while (id.firstChild) {
        id.removeChild(id.firstChild);
    }
}

//mp add_ele
export function add_ele(parent, type, classes) {
    const ele = document.createElement(type);
    ele.className = classes;
    parent.append(ele);
    return ele;
}

//mp if_ele_id
export function if_ele_id(ele_id, v, f) {
    const e = document.getElementById(ele_id);
    if (e != null) {
        f(e, v);
    }
}

//mp table
export function table(table_classes, headings, contents) {
    const table = document.createElement("table");
    table.className = "browser_table "+table_classes[0];
    var tr;

    if (headings) {
        tr = document.createElement("tr");
        if (table_classes[1]) {
            tr.className = table_classes[1];
        }
        let i = 0;
        for (const h of headings) {
            const th = document.createElement("th");
            th.innerText = h;
            th.className = "th"+i;
            i += 1;
            tr.appendChild(th);
        }
        table.appendChild(tr);
    }

    for (const c of contents) {
        tr = document.createElement("tr");
        for (const d of c) {
            const td = document.createElement("td");
            td.innerHTML = d;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    return table;
}

//mp vtable
export function vtable(table_classes, contents) {
    const table = document.createElement("table");
    table.className = "browser_table "+table_classes;
    var tr;

    for (const c of contents) {
        tr = document.createElement("tr");
        let td_or_th = "th";
        for (const d of c) {
            const td = document.createElement(td_or_th);
            td.innerHTML = d;
            tr.appendChild(td);
            td_or_th = "td";
        }
        table.appendChild(tr);
    }
    return table;
}

