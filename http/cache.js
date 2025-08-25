export class Cache {
    constructor (initial_contents, needs_refresh, refresh) {
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
