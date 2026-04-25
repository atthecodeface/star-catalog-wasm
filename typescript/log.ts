import { HtmlElement } from "./html.js";

/** Severity for a log entry */
export enum Severity {
  Verbose = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
  Fatal = 5,
}

/** An entry in the log file */
class LogEntry {
  /** The severity of the LogEntry: this should be one of 'verbose', 'info', 'warning', 'error', or 'fatal' */
  severity: Severity;
  /** The source of the log LogEntry */
  src: Logger;
  /** The reason (e.g. function name) for the LogEntry */
  reason: string;
  /** The message of the LogEntry */
  message: string;

  /** Create a LogEntry with the contents
   *
   * @param {Severity} severity
   * @param {Logger} src
   * @param {string} reason
   * @param {string} message
   */
  constructor(
    severity: Severity,
    src: Logger,
    reason: string,
    message: string,
  ) {
    this.severity = severity;
    this.src = src;
    this.reason = reason;
    this.message = message;
  }
  severity_as_string(): String {
    return LogEntry.severity_to_string(this.severity);
  }

  static severity_to_string(s: Severity): String {
    switch (s) {
      case Severity.Verbose: {
        return "Verbose";
      }
      case Severity.Info: {
        return "Info";
      }
      case Severity.Warning: {
        return "Warning";
      }
      case Severity.Error: {
        return "Error";
      }
      default: {
        return "Fatal";
      }
    }
  }
}

/** This class is a source for a Log
 *
 * It should be instantiated by an object which provides a service to the
 * application (or the application class itself); it is used to generate log
 * messages for the Log.
 *
 */
export class Logger {
  /** The Log that this will add entries to   */
  log: Log;
  /** The name of this source, which is usually a short human-readable identifier such as 'sim' or 'render' */
  src: string;
  /** The stack of strings, the topmost of which is used as the current log reason
   *
   * A client will call 'push_reason' to add to this stack, and then simple log messages will appear with this as a base reason, until the client issues 'pop_reason'
   */
  reason_stack: Array<string>;

  /** Create a new Logger that adds entries to 'log' with a source of 'src'
   *
   * @param {Log} log the Log that entries will be added to
   * @param {string} src the source of all the log entries that this Logger will generate
   */
  constructor(log: Log, src: string) {
    this.log = log;
    this.src = src;
    this.reason_stack = [];
  }

  /** Push a reason onto the reason stack
   *
   * This is generally issued at the start of a method (such as 'draw'), so that
   * log entries within the method all have the same reason. The stack must be
   * popped before the function returns.
   *
   * @param {string} reason the 'reason' code us
   */
  push_reason(reason: string): void {
    this.reason_stack.push(reason);
  }

  /** Pop the reason stack
   *
   * This is usually called just prior to the return from a function that issued 'push_reason'
   */
  pop_reason(): void {
    this.reason_stack.pop();
  }

  /** Internal method to return the top of the stack
   *
   * If the stack is empty it returns the empty string
   */
  private reason_top(): string {
    const x = this.reason_stack[this.reason_stack.length - 1];
    if (x == undefined) {
      return "";
    } else {
      return x;
    }
  }

  /** Internal method to add a LogEntry to the log of a given level
   *
   * Use 'info', 'error', etc instead as a client
   */
  private message(level: Severity, reason: string, message?: string) {
    if (!message) {
      message = reason;
      reason = this.reason_top();
    }
    this.log.add_log(level, this, reason, message);
  }

  /** Add a message (with optional reason) to the log, if logging is at least 'verbose'
   *
   * @param {string} reason If message is supplied, this is used for the LogEntry reason; otherwise this is the message itself
   * @param {string} message The message for the LogEntry
   */
  verbose(reason: string, message?: string) {
    this.message(Severity.Verbose, reason, message);
  }

  /** Add a message (with optional reason) to the log, if logging is at least 'info'
   *
   * @param {string} reason If message is supplied, this is used for the LogEntry reason; otherwise this is the message itself
   * @param {string} message The message for the LogEntry
   */
  info(reason: string, message?: string) {
    this.message(Severity.Info, reason, message);
  }

  /** Add a message (with optional reason) to the log, if logging is at least 'warning'
   *
   * @param {string} reason If message is supplied, this is used for the LogEntry reason; otherwise this is the message itself
   * @param {string} message The message for the LogEntry
   */
  warning(reason: string, message?: string) {
    this.message(Severity.Warning, reason, message);
  }

  /** Add a message (with optional reason) to the log, if logging is at least 'error'
   *
   * @param {string} reason If message is supplied, this is used for the LogEntry reason; otherwise this is the message itself
   * @param {string} message The message for the LogEntry
   */
  error(reason: string, message?: string) {
    this.message(Severity.Error, reason, message);
  }

  /** Add a message (with optional reason) to the log with level of 'fatal'
   *
   * @param {string} reason If message is supplied, this is used for the LogEntry reason; otherwise this is the message itself
   * @param {string} message The message for the LogEntry
   */
  fatal(reason: string, message?: string) {
    this.message(Severity.Fatal, reason, message);
  }
}

export class Log {
  log: Array<LogEntry>;
  div: HtmlElement | null = null;
  div_min_severity: Severity;
  console_min_severity: Severity;
  refill_pending: boolean;

  /** Create a new Log that will fill the given 'div' which has an 'id' of div_id
   *
   * @param {HtmlElement | string}  div an HtmlElement, or 'id' of a div in the document, to place the log into; if none is provided then logging is only to the console
   *
   * @param {Severity} min_severity Minimum severity for logging in the div; defaults to Info
   *
   * @param {Severity} console_min_severity Minimum severity for logging in the console; defaults to Warning
   */
  constructor(
    div?: HtmlElement | string,
    min_severity: Severity = Severity.Info,
    console_min_severty: Severity = Severity.Warning,
  ) {
    this.log = [];

    if (div instanceof HtmlElement) {
      this.div = div;
    } else if (div) {
      const div_ele = document.getElementById(div);
      if (div_ele instanceof HTMLDivElement) {
        this.div = new HtmlElement(div_ele);
      }
    }

    this.div_min_severity = min_severity;
    this.console_min_severity = console_min_severty;
    this.refill_pending = false;
  }

  reset_log() {
    this.log = [];
    this.request_fill_div();
  }

  is_empty() {
    return this.log.length == 0;
  }

  add_log(severity: Severity, src: Logger, reason: string, error: string) {
    if (severity >= this.div_min_severity) {
      this.log.push(new LogEntry(severity, src, reason, error));
      this.request_fill_div();
    }
    if (severity >= this.console_min_severity) {
      console.log(
        `Log: ${LogEntry.severity_to_string(severity)} : ${src.src} : ${reason} : ${error}`,
      );
    }
  }

  request_fill_div() {
    if (this.div === null) return;
    if (!this.refill_pending) {
      requestAnimationFrame((_time) => this.fill_div());
    }
    this.refill_pending = true;
  }

  fill_div() {
    this.refill_pending = false;
    if (this.div === null) return;
    this.div.clear();
    const table = this.div.add_ele("table", { id: "log_table" });
    for (const e of this.log) {
      const tr = table.add_ele("tr", { classes: `log_entry_${e.severity}` });
      tr.add_ele("th").set_content(e.severity_as_string());
      tr.add_ele("td").set_content(e.src.src);
      tr.add_ele("td").set_content(e.reason);
      tr.add_ele("td").set_content(e.message);
    }
  }
}
