/**
 * This contains Directory, LocalStorage
 */

import { Log, Logger } from "./log.js";

/* History
 *
 * 12 April:
 *  Converted to TypeScript (temporarily removed DbStorage)
 *  Renamed FileSet to LocalStorage
 *
 * 31 March: Directory methods take files in root, suffix rather than the other ways round
 *
 */

/**
 * A directory that contains sets of files identified by the 'root' with specific 'suffixes'
 *
 * The aim is to provide a simple means to list files of a specific 'suffix'
 */
export class Directory {
  /**
   * The directory contents; a map from suffixes to a set of files that are in
   * the directory with that suffix
   */
  files: Map<string, Set<string>>;

  /**
   * Create a new Directory with no contents
   */
  constructor() {
    this.files = new Map();
  }

  /**
   * Split the filename into a root and suffix
   */
  split_filename(filename: string): [string, string] {
    const suffix = filename.split(".").pop();
    if (suffix) {
      const root = filename.slice(0, -suffix.length - 1);
      return [root, suffix];
    } else {
      return [filename, ""];
    }
  }

  /**
   * Clear the contents
   */
  clear() {
    this.files.clear();
  }

  /**
   * Determine if a file with a given suffix is in the directory
   *
   * @param root The root (basename) of the file
   * @param suffix The suffix (type) of the file
   * @return True if the file 'root.suffix' is in the directory
   */
  contains_file(root: string, suffix: string = ""): boolean {
    if (suffix == "") {
      [root, suffix] = this.split_filename(root);
    }
    if (!this.files.has(suffix)) {
      return false;
    }
    return this.files.get(suffix)!.has(root);
  }

  /**
   * Add file to the directory; if it already exists, then keep it
   *
   * @param root The root (basename) of the file
   * @param suffix The suffix (type) of the file
   */
  add_file(root: string, suffix: string = ""): boolean {
    if (suffix == "") {
      [root, suffix] = this.split_filename(root);
    }
    if (!this.files.has(suffix)) {
      this.files.set(suffix, new Set());
    }

    const files_of_suffix = this.files.get(suffix)!;
    if (files_of_suffix.has(root)) {
      return false;
    } else {
      files_of_suffix.add(root);
      return true;
    }
  }

  /**
   * Remove a file from the directory; if it does not exist, then do nothing
   *
   * @param root The root (basename) of the file
   * @param suffix The suffix (type) of the file
   */
  delete_file(root: string, suffix: string = ""): boolean {
    if (suffix == "") {
      [root, suffix] = this.split_filename(root);
    }
    if (!this.files.has(suffix)) {
      return false;
    }
    const files_of_suffix = this.files.get(suffix)!;
    const has_file = files_of_suffix.has(root);
    files_of_suffix.delete(root);
    if (files_of_suffix.size == 0) {
      this.files.delete(suffix);
    }
    return has_file;
  }

  /**
   *  Retrieve all of the files with a particular suffix in this Directory
   *
   * @param {string} suffix The suffix (type) of the file
   * @return {Set<string>} Set of all the root names of the files with the given suffix in the Directory
   */
  files_of_type(suffix: string): Set<string> {
    const file_set = this.files.get(suffix);
    if (!file_set) {
      return new Set<string>();
    }
    return file_set;
  }
}

export interface FileStorage<Data> {
  /**
   * Delete a file from Storage
   *
   * This will remove the file from the directory as well as deleting it
   *
   * The callback is invoked with success of 'true' if the directory contained the file, 'false' if it did not
   *
   */
  request_delete_file(
    filename: string,
    user_callback: (success: boolean) => void,
  ): void;

  /**
   * Rename a file from Storage
   *
   * This will rename the file if possible
   *
   * The callback is invoked with success of 'true' if the the rename was okay
   * (file existed and other filename was not a current file)
   *
   */
  request_rename_file(
    old_filename: string,
    new_filename: string,
    user_callback: (success: boolean) => void,
  ): void;

  /**
   * Request to get the file list from the backing storage
   *
   * This should be invoked after the constructor is invoked; the callback is
   * invoked when the storage provides the file list. Thereafter 'dir' will
   * provide the file list.
   *
   *
   * @param {(success: boolean) => void} user_callback Callback invoked on completion
   */
  request_get_file_list(user_callback: (success: boolean) => void): void;

  /**
   * Request to load a file from Storage, and invoke callback when it completes
   *
   * This does not check to see if it is in the directory - it goes straight to the storage
   *
   *
   * @param {string} filename  The file to load
   *
   * @param {(data: Data) => void} user_callback Invoked with the data (on
   * success) or null (on failure) when the data is loaded
   *
   */
  request_load_file(
    filename: string,
    user_callback: (data: Data | null) => void,
  ): void;

  /**
   * Request to save a file to Storage, and invoke callback when it completes (with an indication of success or failure)
   *
   * This will add the file to the directory as well as storing it
   *
   * @param {string} filename The filename of the file
   *
   * @param {any} data The data to place in the file
   *
   * @param {(success: boolean) => void} user_callback Callback invoked when the file has been saved
   */
  request_save_file(
    filename: string,
    data: Data,
    user_callback: (success: boolean) => void,
  ): void;

  /**
   * Return the directory contents
   *
   */
  dir(): Directory;
}

/**
 * A class that manages local storage using a 'prefix' into the actual storage (to permit more than one such class with an 'application')
 *
 */
export class LocalStorage implements FileStorage<string> {
  /**
   * The storage this is associated with
   *
   */
  private storage: Storage;

  /**
   * The prefix (such as a fake directory name 'my_app_subset/' for all the files to be stored
   *
   */
  private prefix: string;

  /**
   * The prefix (such as a fake directory name 'my_app_subset/' for all the files to be stored
   *
   */
  private directory: Directory;

  /**
   * Construct a new LocalStorage for a given prefix, and retrieve the directory contents
   *
   */
  constructor(storage: Storage, prefix: string) {
    this.storage = storage;
    this.prefix = prefix;
    this.directory = new Directory();
    this.load_dir();
  }

  /**
   * Load the directory from the storage
   *
   */
  load_dir() {
    this.directory.clear();
    const n = this.storage.length;
    const pl = this.prefix.length;
    for (let i = 0; i < n; i++) {
      let k = this.storage.key(i);
      if (k!.startsWith(this.prefix)) {
        const f = k!.slice(pl);
        this.directory.add_file(f);
      }
    }
  }

  /**
   * Load a file from Storage immediately
   *
   * This does not check to see if it is in the directory - it goes straight to the storage
   *
   */
  load_file(filename: string): string | null {
    if (!this.directory.contains_file(filename)) {
      return null;
    }
    let f = this.prefix + filename;
    return this.storage.getItem(f);
  }

  /**
   * Save a file to Storage
   *
   * This will add the file to the directory as well as storing it
   *
   */
  save_file(filename: string, data: string) {
    let f = this.prefix + filename;
    this.storage.setItem(f, data);
    this.directory.add_file(filename);
  }

  /**
   * Delete a file from Storage
   *
   * This will remove the file from the directory as well as deleting it
   *
   * Returns true if the file was in the storage
   */
  delete_file(filename: string): boolean {
    let f = this.prefix + filename;
    this.storage.removeItem(f);
    return this.directory.delete_file(filename);
  }

  /**
   * Request to get the file list
   *
   */
  request_get_file_list(user_callback: (success: boolean) => void): void {
    user_callback(true);
  }

  request_rename_file(
    old_filename: string,
    new_filename: string,
    user_callback: (success: boolean) => void,
  ): void {
    if (
      !this.directory.contains_file(old_filename) ||
      this.directory.contains_file(new_filename)
    ) {
      user_callback(false);
      return;
    }
    let data = this.load_file(old_filename);
    if (data === null) {
      user_callback(false);
      return;
    }
    this.save_file(new_filename, data);
    this.delete_file(old_filename);
    user_callback(true);
  }

  /**
   * Request to delete a file from Storage, and invoke callback when it completes
   *
   */
  request_delete_file(
    filename: string,
    user_callback: (success: boolean) => void,
  ): void {
    const success = this.delete_file(filename);
    user_callback(success);
  }

  /**
   * Request to load a file from Storage, and invoke callback when it completes
   *
   */
  request_load_file(
    filename: string,
    user_callback: (data: string | null) => void,
  ): void {
    const data = this.load_file(filename);
    user_callback(data);
  }

  /**
   * Request to save a file to Storage, and invoke callback when it completes (with an indication of success or failure)
   *
   * This will add the file to the directory as well as storing it
   *
   */
  request_save_file(
    filename: string,
    data: string,
    user_callback: (success: boolean) => void,
  ) {
    this.save_file(filename, data);
    user_callback(true);
  }

  /**
   * Return the directory contents
   *
   */
  dir() {
    return this.directory;
  }
}

export class DBStorage implements FileStorage<Uint8Array> {
  private db_name: string;
  private db_open_request: IDBOpenDBRequest;
  private db: null | IDBDatabase;
  private directory: Directory;
  private db_init_callback: (success: boolean) => void;
  private logger: null | Logger = null;

  /**
   * Construct a database (a browser IndexedDB) for storing binary (and other) files
   *
   * Invokes the callback when the DBStorage is ready
   *
   * @param event
   */
  constructor(
    indexedDB: IDBFactory,
    db_name: string,
    init_callback: (success: boolean) => void,
    log?: Log,
  ) {
    this.db = null;
    this.db_init_callback = init_callback;
    this.db_name = db_name;
    this.directory = new Directory();
    if (log !== undefined) {
      this.logger = new Logger(log, this.db_name);
    }

    this.db_open_request = indexedDB.open(db_name, 1);
    this.db_open_request.onerror = (event: Event) => {
      this.db_open_error(event);
    };
    this.db_open_request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      this.db_upgrade(event);
    };
    this.db_open_request.onsuccess = (event: Event) => {
      this.db_open_success(event);
    };
  }

  /**
   * Internal method invoked when the database fails to open
   *
   * Invokes the db_callback with 'false'
   *
   * @param event
   */
  db_open_error(event: Event) {
    if (this.logger) {
      this.logger!.fatal(`Error loading Fonts database: ${event}`);
    }
    this.db_init_callback(false);
  }

  /**
   * Internal method invoked when the database open requires an update to the database (including initialization from nothing)
   *
   * After this a 'success' event should occur
   *
   * @param event
   */
  db_upgrade(_event: IDBVersionChangeEvent) {
    // This occurs if the database does not exist or is at a lower version number
    //
    // Once this has done things the database should later open successfully
    this.db = this.db_open_request.result;
    if (this.logger) {
      this.logger!.info(`Upgrading storage`);
    }
    if (!this.db.objectStoreNames.contains("storage")) {
      this.db.createObjectStore("storage", { keyPath: "filename" });
    }
  }

  /**
   * Internal method invoked when the database open succeeds
   *
   * After this occurs the 'db' property will be set up.
   *
   * Invokes the db_callback with 'true'
   *
   * @param event
   */
  db_open_success(_event: Event) {
    if (this.logger) {
      this.logger!.info(`DBStorage opened database ${this.db_name}`);
    }
    this.db = this.db_open_request.result;
    this.db_init_callback(true);
  }

  /** Invoked when some internal database function completes
   *
   * @param {boolean} success Indicates the request function execute correctly
   * @param {(cb: (data: any) => void, success: boolean, data: any) => void} callback Invoked with the user callback, success, and any data
   * @param {(reason: any) => void} user_callback The user callback to invoke
   * @param {any} data The data returned by the request, if any
   */
  private db_request_complete(
    success: boolean,
    callback: (cb: (data: any) => void, success: boolean, data: any) => void,
    user_callback: (reason: any) => void,
    data: any,
  ) {
    if (this.logger) {
      this.logger!.verbose(
        `DBStorage ${this.db_name} completed request with success ${success}`,
      );
    }
    callback(user_callback, success, data);
  }

  /** Invoke a db readonly request
   *
   * @param request_fn
   * @param callback
   * @param user_callback
   */
  private db_read_request(
    request_fn: (storage: IDBObjectStore) => IDBRequest<any>,
    callback: (cb: (data: any) => void, success: boolean, data: any) => void,
    user_callback: (reason: any) => void,
  ): void {
    const transaction = this.db!.transaction("storage", "readonly");
    const storage = transaction.objectStore("storage");
    const request = request_fn(storage);

    request.onsuccess = (_event: Event) => {
      // const db_result = result.target.result;
      const db_result = request.result;
      // console.log("onsuccess", request);
      this.db_request_complete(true, callback, user_callback, db_result);
    };
    request.onerror = (error: Event) => {
      // console.log("onerror", error);
      this.db_request_complete(false, callback, user_callback, error);
    };
  }

  /** Invoke a db readwrite request
   *
   * @param request_fn
   * @param callback
   * @param user_callback
   */
  private db_readwrite_request(
    request_fn: (storage: IDBObjectStore) => IDBRequest<any>,
    callback: (cb: (data: any) => void, success: boolean, data: any) => void,
    user_callback: (reason: any) => void,
  ): void {
    const transaction = this.db!.transaction("storage", "readwrite");
    const storage = transaction.objectStore("storage");
    const request = request_fn(storage);

    request.onsuccess = (_event: Event) => {
      const db_result = request.result;
      this.db_request_complete(true, callback, user_callback, db_result);
    };
    request.onerror = (error: Event) => {
      this.db_request_complete(false, callback, user_callback, error);
    };
  }

  /** Request the getting of the file list
   *
   * @param user_callback
   */
  request_get_file_list(user_callback: (success: boolean) => void): void {
    this.db_read_request(
      (r) => {
        return r.getAllKeys();
      },
      this.file_list_retrieved.bind(this),
      user_callback,
    );
  }

  /** Invoked by the db request callback when that completes
   *
   * @param user_callback
   * @param success
   * @param result
   */
  private file_list_retrieved(
    user_callback: (data: any) => void,
    success: boolean,
    result: any,
  ): void {
    if (this.logger) {
      this.logger!.verbose(
        `DBStorage ${this.db_name} retrieved file list with success ${success}`,
      );
    }
    if (success && result !== undefined) {
      //console.log(`Retrieved file list ${result}`);
      this.directory.clear();
      if (result) {
        for (const filename of result) {
          this.directory.add_file(filename);
        }
      }
      user_callback(true);
    } else {
      user_callback(false);
    }
  }

  /**
   * Request to load a file from Storage, and invoke callback when it completes
   *
   * This does not check to see if it is in the directory - it goes straight to the storage
   *
   *
   * @param {string} filename  The file to load
   *
   * @param {(data: any) => void} user_callback Invoked with the data (on
   * success) or null (on failure) when the data is loaded
   *
   */
  request_load_file(
    filename: string,
    user_callback: (data: Uint8Array | null) => void,
  ): void {
    this.db_read_request(
      (r) => {
        return r.get(filename);
      },
      this.file_loaded.bind(this),
      user_callback,
    );
  }

  private file_loaded(
    user_callback: (data: Uint8Array | null) => void,
    success: boolean,
    result: any,
  ): void {
    if (this.logger) {
      this.logger!.verbose(
        `DBStorage ${this.db_name} loaded file with success ${success}`,
      );
    }

    if (success && result !== undefined) {
      user_callback(result.content);
    } else {
      user_callback(null);
    }
  }

  /**
   * Request to save a file to Storage, and invoke callback when it completes (with an indication of success or failure)
   *
   * This will add the file to the directory as well as storing it
   *
   * @param {string} filename The filename of the file
   *
   * @param {any} data The data to place in the file
   *
   * @param {(success: boolean) => void} user_callback Callback invoked when the file has been saved
   */
  request_save_file(
    filename: string,
    data: Uint8Array,
    user_callback: (success: boolean) => void,
  ): void {
    this.db_readwrite_request(
      (r) => {
        return r.put({
          filename: filename,
          content: data,
        });
      },
      this.file_saved.bind(this),
      user_callback,
    );
    this.directory.add_file(filename);
  }

  private file_saved(
    user_callback: (data: any) => void,
    success: boolean,
    result: any,
  ): void {
    if (this.logger) {
      this.logger!.verbose(
        `DBStorage ${this.db_name} saved file with success ${success}`,
      );
    }
    user_callback(success && result !== undefined);
  }

  /**
   * Delete a file from Storage
   *
   * This will remove the file from the directory as well as deleting it
   *
   * The callback is invoked with success of 'true' if the directory contained the file, 'false' if it did not
   *
   */
  request_delete_file(
    filename: string,
    user_callback: (success: boolean) => void,
  ): void {
    if (!this.directory.contains_file(filename)) {
      return user_callback(false);
    }
    this.db_readwrite_request(
      (r) => {
        return r.delete(filename);
      },
      this.file_deleted.bind(this),
      user_callback,
    );
    this.directory.delete_file(filename);
  }

  private file_deleted(
    user_callback: (data: any) => void,
    success: boolean,
    _result: any,
  ): void {
    if (this.logger) {
      this.logger!.verbose(
        `DBStorage ${this.db_name} deleted file with success ${success}`,
      );
    }
    // _result is undefined for a 'delete' IDbRequest
    user_callback(success);
  }

  /**
   * Rename a file from Storage
   *
   * This will rename the file if possible
   *
   * The callback is invoked with success of 'true' if the the rename was okay
   * (file existed and other filename was not a current file)
   *
   */
  request_rename_file(
    old_filename: string,
    new_filename: string,
    user_callback: (success: boolean) => void,
  ): void {
    if (
      !this.directory.contains_file(old_filename) ||
      this.directory.contains_file(new_filename)
    ) {
      if (this.logger) {
        this.logger!.error(
          `DBStorage ${this.db_name} could not rename file from ${old_filename} to ${new_filename}`,
        );
      }
      user_callback(false);
      return;
    }
    this.request_load_file(old_filename, (data) => {
      if (data !== null) {
        this.request_save_file(new_filename, data, (success) => {
          if (success) {
            if (this.logger) {
              this.logger!.verbose(
                `DBStorage ${this.db_name} created new file for rename, issuing delete of ${old_filename}`,
              );
            }
            this.request_delete_file(old_filename, user_callback);
          } else {
            if (this.logger) {
              this.logger!.verbose(
                `DBStorage ${this.db_name} failed to rename file, as saving as new file ${new_filename} failed`,
              );
            }
            user_callback(false);
          }
        });
      } else {
        if (this.logger) {
          this.logger!.verbose(
            `DBStorage ${this.db_name} failed to rename file, as loading old file ${old_filename} failed`,
          );
        }
        user_callback(false);
      }
    });
  }

  /**
   * Return the directory contents
   *
   */
  dir(): Directory {
    return this.directory;
  }
}
