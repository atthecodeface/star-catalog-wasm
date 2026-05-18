export class CacheOld {
    constructor(initial_contents, needs_refresh, refresh) {
        this.contents = initial_contents;
        this.refresh_pending = false;
        this.needs_refresh = needs_refresh;
        this.refresh = refresh;
    }
    force_refresh() {
        this.refresh_pending = true;
    }
    get() {
        if (this.refresh_pending || this.needs_refresh(this.contents)) {
            this.contents = this.refresh(this.contents);
            this.refresh_pending = false;
        }
        return this.contents;
    }
}
export class CacheSingleton {
    constructor() {
        this.key = null;
        this.contents = null;
    }
    clear() {
        this.contents = null;
        this.key = null;
    }
    has_cached(k) {
        if (this.key !== null) {
            return this.key.key_is_equal(k);
        }
        return false;
    }
    set_contents(k, contents_fn) {
        if (!this.has_cached(k)) {
            this.contents = null;
            this.contents = contents_fn();
            this.key = k;
        }
    }
    get_contents() {
        return this.contents;
    }
    get(k, contents_fn) {
        this.set_contents(k, contents_fn);
        return this.contents;
    }
}
