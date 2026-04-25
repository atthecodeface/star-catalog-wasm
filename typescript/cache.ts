export class Cache<Contents> {
  contents: Contents;
  refresh_pending: boolean;
  needs_refresh: (contents: Contents) => boolean;
  refresh: (contents: Contents) => Contents;
  constructor(
    initial_contents: any,
    needs_refresh: (contents: any) => boolean,
    refresh: (contents: Contents) => Contents,
  ) {
    this.contents = initial_contents;
    this.refresh_pending = false;
    this.needs_refresh = needs_refresh;
    this.refresh = refresh;
  }

  force_refresh(): void {
    this.refresh_pending = true;
  }

  get(): Contents {
    if (this.refresh_pending || this.needs_refresh(this.contents)) {
      this.contents = this.refresh(this.contents);
      this.refresh_pending = false;
    }
    return this.contents;
  }
}
