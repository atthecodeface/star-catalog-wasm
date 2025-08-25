//a Tab
//c Tab
class Tab {
    constructor(tabs, li) {
        this.tabs = tabs;
        this.li = li;

        const a = li.getElementsByTagName("a")[0];
        this.div_id = a.getAttribute("href");
        this.div = document.querySelector(this.div_id);
        const me = this;
        a.onclick = ( (e) => {
            me.tabs.hash_change(this.div_id);
            e.preventDefault();
        } );
    }
    id() {
        return this.div_id;
    }
    has_hash(hash) {
        return this.div_id == hash;
    }
    set_hidden(hidden) {
        this.div.hidden = hidden;
        hidden = hidden;
        if (hidden) {
            this.li.className = "";
        } else {
            this.li.className = "active";
        }
    }
}

//a Tabs
//c Tabs
class Tabs {
    //cp constructor
    constructor(container_id, callback) {
        this.tabs = [];
        this.callback = callback;

        const tab_list = document.querySelector(container_id);
        if (tab_list === null) {
            console.log("tabbed.js: Tabs: aborting as no tab list '",container_id,"' was found");
            return;
        }

        this.ul = tab_list.getElementsByTagName("ul")[0];

        for (const li of this.ul.getElementsByTagName("li")) {
            if (li.getElementsByTagName("a").length != 0) {
                this.tabs.push(new Tab(this, li));
            }
        }

        this.selected_tab_number = null;
        this.post_init()
    }

    //mp post_init
    /// After the contents are initialized, actually make the document changes happen
    post_init() {
        const me = this;
        window.addEventListener('hashchange', () => {me.hash_change(location.hash);} );
        if (this.hash_change(location.hash) === null) {
            this.select_tab(0);
        }
    }        

    //mp hash_change
    /// Invoked when an <a href='#...'> link is selected
    hash_change(hash_name) {
        for (const i in this.tabs) {
            if (this.tabs[i].has_hash(hash_name)) {
                return this.select_tab(i);
            }
        }
        return null;
    }
    
    //mp select_tab
    select_tab(tab_number) {
        if (tab_number >= this.tabs.length) {
            tab_number = 0;
        }
        if (tab_number == this.selected_tab_number) {
            return;
        }
        for (const i in this.tabs) {
            this.tabs[i].set_hidden(i != tab_number);
        }
        this.selected_tab_number = tab_number;

        this.callback(this.tabs[this.selected_tab_number].id());
        return this.selected_tab_number;
    }
}

//a Toplevel
//fp tabbed_configure
export function tabbed_configure(container_id, callback) {
    document.tabs = new Tabs(container_id, callback);
}

