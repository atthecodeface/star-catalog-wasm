export class CacheOld<Contents> {
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

export interface CacheKey {
  key_is_equal(other: CacheKey): boolean;
}

export class CacheSingleton<K extends CacheKey, T> {
  contents: T | null;
  key: K | null = null;
  constructor() {
    this.contents = null;
  }
  clear() {
    this.contents = null;
    this.key = null;
  }
  has_cached(k: K): boolean {
    if (this.key !== null) {
      return this.key!.key_is_equal(k);
    }
    return false;
  }
  set_contents(k: K, contents_fn: () => T) {
    if (!this.has_cached(k)) {
      this.contents = null;
      this.contents = contents_fn();
      this.key = k;
    }
  }
  get_contents(): T | null {
    return this.contents;
  }
  get(k: K, contents_fn: () => T): T {
    this.set_contents(k, contents_fn);
    return this.contents!;
  }
}
