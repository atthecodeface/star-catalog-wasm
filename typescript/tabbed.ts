/**
 * History:
 *
 * 13th April:
 *
 *   Converted from JavaScript
 *
 *   Requires a top level Tabs() creation from init complete
 *
 *   Tabbed.hash_change => select_hash; Tab.id => Tab.get_hash; Tab.select_tab => private
 */

/**
 * A 'tab' in a tabbed page; this is private to the library
 */
class Tab {
  /**
   * The tab number, unique for each Tab in the parent; publicly visible
   */
  num: number;

  /**
   *  The parent that this Tab belongs to
   */
  private tabs: Tabs;

  /**
   *  The 'li' HTML element (which contains at least one 'a' element) for this tab
   *
   *  The 'className' attribute of this element will be "" if the tab is not selected, and "active" if it is selected
   */
  private li: HTMLLIElement;

  /**
   * The name of the 'div' that this tab corresponds to
   *
   * The div is hidden if this tab is not selected
   */
  private hash: string;

  /**
   * The actual 'div' element that this corresponds to
   */
  private div: HTMLDivElement;

  /**
   * Create a new Tab given its parent, 'li' element and tab number
   *
   * The 'li' has at least one 'a' element in it, with an 'href' of '#tab-<id>',
   * where 'tab-<id>' is the *id* of the div that contains the contents of that
   * tab
   */
  constructor(tabs: Tabs, li: HTMLLIElement, num: number) {
    this.tabs = tabs;
    this.li = li;
    this.num = num;

    var errored: string | undefined = undefined;
    var hash: string | null = null;
    var div: HTMLDivElement | null = null;
    const a = li.getElementsByTagName("a")[0];
    if (a === undefined) {
      errored = "failed to find 'a' element in Tab - bug in Tabs";
    }

    if (!errored) {
      hash = a!.getAttribute("href");
      if (hash === null) {
        errored = `tab ${num} 'a' item did not have an 'href' attribute`;
      } else {
        div = document.querySelector(hash);
        if (div === null || !(div instanceof HTMLDivElement)) {
          errored = `tab ${num} has an href of "${hash}" but the relevant div could not be found in the document`;
        }
      }
    }

    if (errored) {
      throw new Error(`Failed to make Tab: ${errored}`);
    }

    this.hash = hash!;
    this.div = div!;
    a!.onclick = (e) => {
      this.tabs.select_hash(this.hash);
      e.preventDefault();
    };
  }

  /**
   * Return the 'hash' of this tab - currently this is the 'div_id' property
   */
  get_hash() {
    return this.hash;
  }

  /**
   * Return true if the 'hash' matches the element for this tab (i.e. thing,html#banana has 'banana' match this tab)
   *
   * This therefore compares the 'hash' with the div_id
   *
   */
  has_hash(hash: string) {
    return this.hash == hash;
  }

  /**
   * Set the 'hidden' style for the div associated with this tab
   */
  set_hidden(hidden: boolean) {
    this.div.hidden = hidden;
    hidden = hidden;
    if (hidden) {
      this.li.className = "";
    } else {
      this.li.className = "active";
    }
  }
}

/**
 * A class that handles a set of Tabs, only one of which should be selected, and that will become 'unhidden' while the others are 'hidden'
 */
export class Tabs {
  /**
   * The set of Tab that this controls
   */
  tabs: Array<Tab>;

  /**
   * The callback invoked when a tab is selected
   */
  callback: (id: string) => void;

  /**
   * The currently selected tab number
   */
  selected_tab_number: number | undefined;

  /**
   * Create a new set of tabs whose tab list can be selected with 'container_select'
   *
   * This tab list must be an element that contains a 'ul' element, which in
   * turn has 'li' for each tab, with each 'li' having an 'a' with an 'href'
   * identifying the tab it is associated with.
   */
  constructor(
    container_select: string,
    tab_select_callback: (id: string) => void,
  ) {
    this.tabs = [];
    this.callback = tab_select_callback;

    var errored: string | undefined = undefined;
    const tab_list = document.querySelector(container_select);
    if (tab_list === null) {
      errored = `tab list ${container_select} could not be found`;
    }

    var ul: any = undefined;

    if (!errored) {
      ul = tab_list!.getElementsByTagName("ul")[0];
      if (!(ul instanceof HTMLUListElement)) {
        errored =
          "tab list must contain an 'ul' element but one could not be found";
      }
    }
    if (!errored) {
      var i = 0;
      for (const li of ul.getElementsByTagName("li")) {
        if (li.getElementsByTagName("a").length != 0) {
          this.tabs.push(new Tab(this, li, i));
        }
        i += 1;
      }
      if (this.tabs.length == 0) {
        errored =
          "no tabs ('li' items with child that is an 'a' item) found in the 'ul' tab list element";
      }
    }

    if (errored) {
      throw new Error(`Failed to make 'Tabs': ${errored}`);
    }

    this.selected_tab_number = undefined;
    this.post_init();
  }

  /**
   * After the contents are initialized, actually make the document changes happen
   *
   * This tab list must be an element that contains a 'ul' element, which in
   * turn has 'li' for each tab, with each 'li' having an 'a' with an 'href'
   * identifying the tab it is associated with.
   */
  private post_init() {
    window.addEventListener("hashchange", () => {
      this.select_hash(location.hash);
    });
    if (this.select_hash(location.hash) === null) {
      this.select_tab_number(0);
    }
  }

  /** Select the tab given by 'hash_name' (which should be #<tab-name>)
   *
   * This will invoke the 'tab_select_callback' provided by the client with the
   * selected tab's '#<tab-name>', if the tab number changes
   *
   *  Invoked when an <a href='#...'> link is selected
   *
   * @param {string} hash_name The '#' reference to follow
   * @returns {number | undefined} The tab number selected, or null if the hash name was not known
   */
  select_hash(hash_name: string): number | null {
    for (const t of this.tabs) {
      if (t.has_hash(hash_name)) {
        return this.select_tab_number(t.num);
      }
    }
    return null;
  }

  private select_tab_number(tab_number: number): number | null {
    if (tab_number >= this.tabs.length) {
      return null;
    }
    if (
      this.selected_tab_number === undefined ||
      tab_number != this.selected_tab_number
    ) {
      for (const t of this.tabs) {
        t.set_hidden(t.num != tab_number);
      }
      this.selected_tab_number = tab_number;
      this.callback(this.tabs[tab_number]!.get_hash());
    }
    return tab_number;
  }
}
