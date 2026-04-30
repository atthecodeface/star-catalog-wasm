export class MousePressActions {
    constructor() {
        this.can_drag = true;
        this.can_move = true;
        this.can_zoom = true;
        this.can_rotate = true;
        this.can_scale = true;
        this.ignore_second_touch = false;
        this.drag_sensitivity = 5;
    }
}
var InteractionState;
(function (InteractionState) {
    // Mouse down has occurred; user_press has been issued
    InteractionState[InteractionState["MousePressed"] = 0] = "MousePressed";
    // Mouse drag in process; user_press has been cancelled, drag_start has been issued
    InteractionState[InteractionState["MouseDragging"] = 1] = "MouseDragging";
    // One touch event has occurred; user_press has been issued
    InteractionState[InteractionState["TouchedOncePressed"] = 2] = "TouchedOncePressed";
    // Touch drag in process; user_press has been cancelled, drag_start has been issued
    InteractionState[InteractionState["TouchedOnceDragging"] = 3] = "TouchedOnceDragging";
    // Second touch event has occurred; user_press has been cancelled
    InteractionState[InteractionState["TouchedTwice"] = 4] = "TouchedTwice";
})(InteractionState || (InteractionState = {}));
class ClientInteraction {
    /**
     * An interaction state
     *
     * @param {MouseEvent | Touch} event Event that invokes the interaction
     */
    constructor(client, ele, event) {
        /** The last XY of a drag position (if TouchOnceDragging or MouseDragging)
         */
        this.drag_xy = [0, 0];
        this.first_touch_index = 0;
        this.second_touch_index = 0;
        /** The first touch last relative location (if TouchedOncePressed, TouchOnceDragging or TouchedTwice, else invalid)
         */
        this.first_touch_xy = [0, 0];
        /** The second touch last relative location (if TouchedTwice, else invalid)
         */
        this.second_touch_xy = [0, 0];
        this.press_actions = new MousePressActions();
        this.client = client;
        const bbox = ele.getBoundingClientRect();
        const ele_tl_xy = [bbox.left, bbox.top];
        this.ele_tl_xy = ele_tl_xy;
        this.initial_xy = this.relative_xy(event);
        if (event instanceof MouseEvent) {
            this.state = InteractionState.MousePressed;
        }
        else {
            this.state = InteractionState.TouchedOncePressed;
            this.first_touch_index = event.identifier;
            this.first_touch_xy = this.initial_xy;
        }
        this.client.user_press(this.initial_xy, this.press_actions);
    }
    /**
     * Mouse has been pressed; start ClientInteraction
     * @param {MouseClient} client The client whose methods should be invoked when interactions take place
     *
     * @param {HTMLElement} ele The HTML element that the mouse/touch events must reach for the interaction
     *
     * @param {TouchEvent} event Event that invokes the interaction
     */
    static touch_start(client, ele, event) {
        if (event.touches.length != 1) {
            return null;
        }
        event.preventDefault();
        return new ClientInteraction(client, ele, event.touches[0]);
    }
    /**
     * Mouse has been pressed; start ClientInteraction
     * @param {MouseClient} client The client whose methods should be invoked when interactions take place
     *
     * @param {HTMLElement} ele The HTML element that the mouse/touch events must reach for the interaction
     *
     * @param {MouseEvent} event Event that invokes the interaction
     */
    static mouse_down(client, ele, event) {
        event.preventDefault();
        return new ClientInteraction(client, ele, event);
    }
    /** Convert an event position to relative location
     *
     * @param {MouseEvent | Touch} e Event or similar that has a clientX/Y
     *
     * @returns {[number, number]} The relative location of the event (0,0 being top left of the element)
     */
    relative_xy(e) {
        return [e.clientX - this.ele_tl_xy[0], e.clientY - this.ele_tl_xy[1]];
    }
    /**
     * Determine if a current relative location is far enough from a starting relative location to invoke dragging
     *
     * @param {[number, number]} xy Client relative location
     *
     * @returns {boolean} True if cxy is sufficiently distant from sxy to invoke dragging
     */
    has_dragged(xy) {
        if (!this.press_actions.can_drag) {
            return false;
        }
        return !(Math.abs(xy[0] - this.initial_xy[0]) <
            this.press_actions.drag_sensitivity &&
            Math.abs(xy[1] - this.initial_xy[1]) < this.press_actions.drag_sensitivity);
    }
    /**
     * Find which touch index in a TouchEvent is our touch_first
     *
     * @param {TouchEvent} e TouchEvent from the listener
     *
     * @returns {null | Touch} The touch that first_touch_index corresponds to
     */
    event_touches(e, second_valid) {
        let t0 = null;
        let t1 = null;
        if (e.touches.length > 0) {
            t0 = e.touches[0];
        }
        if (e.touches.length > 1) {
            t1 = e.touches[1];
        }
        if (t0 !== null && t0.identifier == this.first_touch_index) {
            if (second_valid) {
                if (t1 !== null && t1.identifier == this.second_touch_index) {
                    return [t0, t1];
                }
                else {
                    return null;
                }
            }
            else {
                return [t0, t1];
            }
        }
        if (t1 !== null && t1.identifier == this.first_touch_index) {
            if (second_valid) {
                if (t0 !== null && t0.identifier == this.second_touch_index) {
                    return [t1, t0];
                }
                else {
                    return null;
                }
            }
            else {
                return [t1, t0];
            }
        }
        return null;
    }
    abort(xy = null) {
        if (xy == null) {
            xy = this.initial_xy;
        }
        switch (this.state) {
            case InteractionState.MousePressed: {
                this.client.user_press_cancel(xy);
                break;
            }
            case InteractionState.TouchedOncePressed: {
                this.client.user_press_cancel(xy);
                break;
            }
            case InteractionState.MouseDragging: {
                this.client.drag_end(this.initial_xy, xy);
                break;
            }
            case InteractionState.TouchedOnceDragging: {
                this.client.drag_end(this.initial_xy, xy);
                break;
            }
            case InteractionState.TouchedTwice: {
                break;
            }
        }
        return false;
    }
    /**
     * Handle a TouchEvent for the 'touchstart' listener
     *
     * This can be invoked for the first 'touch', and also for a *second* touch
     * happening after a first touch has already occurred.
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_start(e) {
        e.preventDefault();
        if (this.press_actions.ignore_second_touch) {
            return true;
        }
        switch (this.state) {
            case InteractionState.TouchedOncePressed: {
                if (e.touches.length != 2) {
                    return this.abort(null);
                }
                const t01 = this.event_touches(e, false);
                if (t01 === null || t01[1] === null) {
                    return this.abort(null);
                }
                this.second_touch_index = t01[1].identifier;
                this.second_touch_xy = this.relative_xy(t01[1]);
                this.state = InteractionState.TouchedTwice;
                return true;
            }
            case InteractionState.TouchedOnceDragging: {
                if (e.touches.length != 2) {
                    return this.abort(null);
                }
                const t01 = this.event_touches(e, false);
                if (t01 === null || t01[1] === null) {
                    return this.abort(null);
                }
                this.client.drag_end(this.initial_xy, this.first_touch_xy);
                this.second_touch_index = t01[1].identifier;
                this.second_touch_xy = this.relative_xy(t01[1]);
                this.state = InteractionState.TouchedTwice;
                return true;
            }
            default: {
                return this.abort(this.first_touch_xy);
            }
        }
    }
    /**
     * Handle a TouchEvent due to moving one (or more) of the current Touch'es
     *
     * @param {TouchEvent} e Event from the listener
     */
    touch_move(e) {
        e.preventDefault();
        switch (this.state) {
            case InteractionState.TouchedTwice: {
                const t01 = this.event_touches(e, true);
                if (t01 === null) {
                    return this.abort(null);
                }
                const tf_new_cxy = this.relative_xy(t01[0]);
                const ts_new_cxy = this.relative_xy(t01[1]);
                const dx_orig = this.first_touch_xy[0] - this.second_touch_xy[0];
                const dy_orig = this.first_touch_xy[1] - this.second_touch_xy[1];
                const dx_new = tf_new_cxy[0] - ts_new_cxy[0];
                const dy_new = tf_new_cxy[1] - ts_new_cxy[1];
                const d_orig = Math.sqrt(dx_orig * dx_orig + dy_orig * dy_orig);
                const d_new = Math.sqrt(dx_new * dx_new + dy_new * dy_new);
                const old_cxy = [
                    (this.first_touch_xy[0] + this.second_touch_xy[0]) / 2,
                    (this.first_touch_xy[1] + this.second_touch_xy[1]) / 2,
                ];
                const new_cxy = [
                    (tf_new_cxy[0] + ts_new_cxy[0]) / 2,
                    (tf_new_cxy[1] + ts_new_cxy[1]) / 2,
                ];
                if (old_cxy[0] != new_cxy[0] || old_cxy[0] != new_cxy[0]) {
                    this.client.user_pan(new_cxy, [
                        -new_cxy[0] + old_cxy[0],
                        -new_cxy[1] + old_cxy[1],
                    ]);
                }
                if (d_orig != d_new) {
                    if (d_new > 0 && d_orig > 0) {
                        this.client.user_zoom(new_cxy, d_new / d_orig);
                    }
                }
                const a_orig = Math.atan2(dy_orig, dx_orig);
                const a_new = Math.atan2(dy_new, dx_new);
                if (a_orig != a_new) {
                    this.client.user_rotate(new_cxy, a_new - a_orig);
                }
                this.first_touch_xy = tf_new_cxy;
                this.second_touch_xy = ts_new_cxy;
                return true;
            }
            case InteractionState.TouchedOnceDragging: {
                const t01 = this.event_touches(e, false);
                if (t01 === null) {
                    return this.abort(null);
                }
                const tf_new_cxy = this.relative_xy(t01[0]);
                this.first_touch_xy = tf_new_cxy;
                this.client.drag_to(this.initial_xy, this.drag_xy, tf_new_cxy);
                this.drag_xy = tf_new_cxy;
                return true;
            }
            case InteractionState.TouchedOncePressed: {
                const t01 = this.event_touches(e, false);
                if (t01 === null) {
                    return this.abort(null);
                }
                const tf_new_cxy = this.relative_xy(t01[0]);
                this.first_touch_xy = tf_new_cxy;
                if (this.has_dragged(tf_new_cxy)) {
                    this.client.user_press_cancel(this.initial_xy);
                    this.client.drag_start(this.initial_xy, tf_new_cxy);
                    this.drag_xy = tf_new_cxy;
                    this.state = InteractionState.TouchedOnceDragging;
                }
                else {
                    if (this.press_actions.can_move) {
                        this.client.user_press_move(this.initial_xy, tf_new_cxy);
                    }
                }
                return true;
            }
            default: {
                return this.abort(this.first_touch_xy);
            }
        }
    }
    /** Handle removal of *one* touch in a TouchEvent
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_end(e) {
        e.preventDefault();
        switch (this.state) {
            case InteractionState.TouchedTwice: {
                return this.abort(this.first_touch_xy);
            }
            case InteractionState.TouchedOnceDragging: {
                this.client.drag_end(this.initial_xy, this.first_touch_xy);
                return false;
            }
            case InteractionState.TouchedOncePressed: {
                const t01 = this.event_touches(e, false);
                if (t01 == null) {
                    this.client.user_release(this.initial_xy, this.first_touch_xy);
                    return false;
                }
                return true;
            }
            default: {
                return this.abort(this.first_touch_xy);
            }
        }
    }
    /** Handle removal of *one* touch in a TouchEvent
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_cancel(e) {
        e.preventDefault();
        switch (this.state) {
            case InteractionState.TouchedTwice: {
                return this.abort(this.first_touch_xy);
            }
            case InteractionState.TouchedOnceDragging: {
                this.client.drag_end(this.initial_xy, this.first_touch_xy);
                return false;
            }
            case InteractionState.TouchedOncePressed: {
                this.client.user_press_cancel(this.initial_xy);
                return false;
            }
            default: {
                return this.abort(this.first_touch_xy);
            }
        }
    }
    /** Handle the mouse leaving the element (to an inner element or outside the bounds of the element)
     *
     * @param {MouseEvent} _e The event from the listener
     */
    mouse_leave(_e) {
        // e.preventDefault();
        return this.abort();
    }
    /** Handle the mouse button being released
     *
     * @param {MouseEvent} e The event from the listener
     */
    mouse_up(e) {
        const cxy = this.relative_xy(e);
        e.preventDefault();
        switch (this.state) {
            case InteractionState.MousePressed: {
                this.client.user_release(this.initial_xy, cxy);
                return false;
            }
            case InteractionState.MouseDragging: {
                this.client.drag_end(this.initial_xy, cxy);
                return false;
            }
            default: {
                return this.abort();
            }
        }
    }
    mouse_move(e) {
        const cxy = this.relative_xy(e);
        e.preventDefault();
        switch (this.state) {
            case InteractionState.MousePressed: {
                if (this.has_dragged(cxy)) {
                    this.client.user_press_cancel(this.initial_xy);
                    this.client.drag_start(this.initial_xy, cxy);
                    this.drag_xy = cxy;
                    this.state = InteractionState.MouseDragging;
                }
                else {
                    if (this.press_actions.can_move) {
                        this.client.user_press_move(this.initial_xy, cxy);
                    }
                }
                return true;
            }
            case InteractionState.MouseDragging: {
                this.client.drag_to(this.initial_xy, this.drag_xy, cxy);
                this.drag_xy = cxy;
                return true;
            }
            default: {
                return this.abort();
            }
        }
    }
}
/**
 * A mouse/touch handler, providing simple conversion from mouse events to
 * callbacks for pan, zoom, rotate, drag, etc
 */
export class Mouse {
    /**
     * Add handlers to an HTMLElement for mouse interaction, issuing methods in
     * the client as callbacks
     *
     * @param {MouseClient} client The client whose methods should be invoked when interactions take place
     *
     * @param {HTMLElement} ele The HTML element that the mouse/touch events must reach for the interaction
     */
    constructor(client, ele) {
        /** The last XY of a drag position (touch or mouse)
         *
         * If this is not null then touch_second must be null
         */
        this.drag_sensitivity = 5;
        this.zoom_ratio = 0.97;
        this.client_interaction = null;
        this.client = client;
        this.ele = ele;
        ele.addEventListener("mousedown", this.mouse_down.bind(this));
        ele.addEventListener("mouseup", this.mouse_up.bind(this));
        ele.addEventListener("mouseleave", this.mouse_leave.bind(this));
        ele.addEventListener("mousemove", this.mouse_move.bind(this));
        ele.addEventListener("touchstart", this.touch_start.bind(this));
        ele.addEventListener("touchend", this.touch_end.bind(this));
        ele.addEventListener("touchcancel", this.touch_cancel.bind(this));
        ele.addEventListener("touchmove", this.touch_move.bind(this));
        ele.addEventListener("wheel", this.wheel.bind(this));
    }
    /** Convert an event position to relative location
     *
     * @param {MouseEvent | Touch} e Event or similar that has a clientX/Y
     *
     * @returns {[number, number]} The relative location of the event (0,0 being top left of the element)
     */
    relative_xy(e) {
        const rect = this.ele.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top];
    }
    /**
     * Handle a WheelEvent
     *
     * @param {WheelEvent} e Event from the 'onwheel' listener
     */
    wheel(e) {
        // WheelEvent with ctrlKey indicate the wheel is pressed, or equivalent
        //
        // If not then a pan can be performed
        if (e.ctrlKey) {
            if (e.deltaY != 0) {
                this.client.user_zoom(this.relative_xy(e), Math.pow(this.zoom_ratio, e.deltaY));
            }
            e.preventDefault();
        }
        else {
            this.client.user_pan(this.relative_xy(e), [e.deltaX, e.deltaY]);
            e.preventDefault();
        }
    }
    /**
     * Handle a TouchEvent for the 'touchstart' listener
     *
     * This can be invoked for the first 'touch', and also for a *second* touch
     * happening after a first touch has already occurred.
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_start(e) {
        if (this.client_interaction === null) {
            this.client_interaction = ClientInteraction.touch_start(this.client, this.ele, e);
        }
        else {
            if (!this.client_interaction.touch_start(e)) {
                this.client_interaction = null;
            }
        }
    }
    /**
     * Handle a TouchEvent due to moving one (or more) of the current Touch'es
     *
     * @param {TouchEvent} e Event from the listener
     */
    touch_move(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.touch_move(e)) {
                this.client_interaction = null;
            }
        }
    }
    /** Handle removal of *one* touch in a TouchEvent
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_end(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.touch_end(e)) {
                this.client_interaction = null;
            }
        }
    }
    /** Handle cancellation of touch (e.g. browser changes to a different page)
     *
     * @param {TouchEvent} e The event from the listener
     */
    touch_cancel(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.touch_cancel(e)) {
                this.client_interaction = null;
            }
        }
    }
    /** Handle the mouse button being pressed
     *
     * @param {MouseEvent} e The event from the listener
     */
    mouse_down(e) {
        if (this.client_interaction !== null) {
            this.client_interaction.abort();
            this.client_interaction = null;
        }
        if (this.client_interaction === null) {
            this.client_interaction = ClientInteraction.mouse_down(this.client, this.ele, e);
        }
    }
    /** Handle the mouse leaving the element (to an inner element or outside the bounds of the element)
     *
     * @param {MouseEvent} e The event from the listener
     */
    mouse_leave(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.mouse_leave(e)) {
                this.client_interaction = null;
            }
        }
    }
    /** Handle the mouse button being released
     *
     * @param {MouseEvent} e The event from the listener
     */
    mouse_up(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.mouse_up(e)) {
                this.client_interaction = null;
            }
        }
    }
    mouse_move(e) {
        if (this.client_interaction !== null) {
            if (!this.client_interaction.mouse_move(e)) {
                this.client_interaction = null;
            }
        }
    }
}
