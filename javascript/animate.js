/*

Example requestAnimationFrame

this.anim = new Animate( (time) => this.anim_tick(time) );
this.tick = 0;
this.anim.schedule();

anim_tick(_time:number): void {
  if (this.tick < this.fred.length) {
    this.redraw(this.tick);
    this.tick = this.tick + 1;
    this.anim.schedule(100);
  }
}
anim_restart(): void {
  this.tick = 0;
  this.anim_tick(0);
}
*/
/**
 * A class that provides an abstraction for calback at specifica times and rates
 *
 */
export class Animate {
    /**
     * Create an animation with a regular callback, and an optional starting
     * callback
     */
    constructor(animation_cb, start_cb = null) {
        /** The currently requested Animation callback, if any
         *
         * This has to be cancelled if the client changes the animation callback
         *
         * If this is not null then pending_timer will be null
         */
        this.animation_frame = null;
        /** The currently peding timer callback, if any
         *
         * This has to be cancelled if the client changes the animation callback
         *
         * If this is not null then animation_frame will be null
         */
        this.pending_timer = null;
        /**
         * The callback to invoke on the *first* animation step; if this is null then
         * the regular animatcion_cb is used
         */
        this.start_cb = null;
        /**
         * The callback to be invoked when the animation ends
         */
        this.cancel_cb = null;
        /**
         * The time of the last start of animation
         */
        this.start_time_ms = 0;
        /**
         * The time of the last stopping of animation, for clients to report (e.g.)
         * frames per second
         */
        this.last_time_ms = 0;
        this.animation_cb = animation_cb;
        this.start_cb = start_cb;
    }
    /**
     * Report the duration of the lsat animation from start to stop
     */
    duration() {
        return this.last_time_ms - this.start_time_ms;
    }
    /**
     * Restart an animation, specifying a start callback
     */
    restart(delay_ms = 0, start_cb = null) {
        this.start_cb = start_cb;
        // Set start_time_ms in case start_cb is null
        this.start_time_ms = performance.now();
        this.schedule(delay_ms);
    }
    /**
     * Stop an animation, recording the last time so the duration may be reported
     */
    stop() {
        this.clear_pending_timers();
    }
    /**
     * Schedule the next step of animation to be at a certain time (in the
     * timeframe of the animation/window)
     *
     * Usually the 'when_ms' is generate by adding a time duraton to the time
     * presented to the client in an animation callback function
     */
    schedule_at(when_ms, cb) {
        var delay = when_ms - performance.now();
        if (delay < 0) {
            delay = 0;
        }
        this.schedule(delay, cb);
    }
    /**
     * Schedule the next step of animation to be after a certain delay from now
     *
     * Potentially provide tha callback to use at the next step
     */
    schedule(delay_ms = 0, cb) {
        if (cb !== undefined) {
            this.animation_cb = cb;
        }
        this.clear_pending_timers();
        if (delay_ms > 0) {
            this.pending_timer = window.setTimeout(() => this.animate(performance.now()), delay_ms);
        }
        else {
            this.animation_frame = requestAnimationFrame((time) => this.animate(time));
        }
    }
    /** Clear the pending timers, if any */
    clear_pending_timers() {
        if (this.pending_timer !== null) {
            window.clearTimeout(this.pending_timer);
            this.pending_timer = null;
        }
        if (this.animation_frame !== null) {
            window.cancelAnimationFrame(this.animation_frame);
            this.animation_frame = null;
        }
    }
    /**
     * The actual callback invoked by a timer or animation frame; this invokes the
     * appropriate client callback
     */
    animate(time) {
        this.animation_frame = null;
        this.pending_timer = null;
        this.last_time_ms = time;
        if (this.start_cb !== null) {
            this.start_time_ms = time;
        }
        if (this.cancel_cb !== null) {
            this.cancel_cb(time);
            return;
        }
        if (this.start_cb !== null) {
            const cb = this.start_cb;
            this.start_cb = null;
            cb(time);
        }
        else {
            this.animation_cb(time);
        }
    }
}
