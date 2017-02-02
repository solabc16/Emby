define(['browser', 'layoutManager', 'dom', 'focusManager', 'scrollStyles'], function (browser, layoutManager, dom, focusManager) {
    'use strict';

    /**
* Return type of the value.
*
* @param  {Mixed} value
*
* @return {String}
*/
    function type(value) {
        if (value == null) {
            return String(value);
        }

        if (typeof value === 'object' || typeof value === 'function') {
            return Object.prototype.toString.call(value).match(/\s([a-z]+)/i)[1].toLowerCase() || 'object';
        }

        return typeof value;
    }

    /**
	 * Disables an event it was triggered on and unbinds itself.
	 *
	 * @param  {Event} event
	 *
	 * @return {Void}
	 */
    function disableOneEvent(event) {
        /*jshint validthis:true */
        event.preventDefault();
        event.stopPropagation();
        this.removeEventListener(event.type, disableOneEvent);
    }

    /**
	 * Make sure that number is within the limits.
	 *
	 * @param {Number} number
	 * @param {Number} min
	 * @param {Number} max
	 *
	 * @return {Number}
	 */
    function within(number, min, max) {
        return number < min ? min : number > max ? max : number;
    }

    // Other global values
    var dragMouseEvents = ['mousemove', 'mouseup'];
    var dragTouchEvents = ['touchmove', 'touchend'];
    var wheelEvent = (document.implementation.hasFeature('Event.wheel', '3.0') ? 'wheel' : 'mousewheel');
    var interactiveElements = ['INPUT', 'SELECT', 'TEXTAREA'];
    var tmpArray = [];
    var time;

    // Math shorthands
    var abs = Math.abs;
    var sqrt = Math.sqrt;
    var pow = Math.pow;
    var round = Math.round;
    var max = Math.max;
    var min = Math.min;

    var scrollerFactory = function (frame, options) {

        // Extend options
        var o = Object.assign({}, {
            slidee: null, // Selector, DOM element, or jQuery object with DOM element representing SLIDEE.
            horizontal: false, // Switch to horizontal mode.

            // Scrolling
            scrollSource: null, // Element for catching the mouse wheel scrolling. Default is FRAME.
            scrollBy: 0, // Pixels or items to move per one mouse scroll. 0 to disable scrolling.
            scrollHijack: 300, // Milliseconds since last wheel event after which it is acceptable to hijack global scroll.

            // Dragging
            dragSource: null, // Selector or DOM element for catching dragging events. Default is FRAME.
            mouseDragging: 1, // Enable navigation by dragging the SLIDEE with mouse cursor.
            touchDragging: 1, // Enable navigation by dragging the SLIDEE with touch events.
            swingSpeed: 0.2, // Swing synchronization speed, where: 1 = instant, 0 = infinite.
            dragThreshold: 3, // Distance in pixels before Sly recognizes dragging.
            intervactive: null, // Selector for special interactive elements.

            // Mixed options
            speed: 0, // Animations speed in milliseconds. 0 to disable animations.

            // Classes
            draggedClass: 'dragged', // Class for dragged elements (like SLIDEE or scrollbar handle).
            activeClass: 'active', // Class for active items and pages.
            disabledClass: 'disabled' // Class for disabled navigation elements.
        }, options);

        var isSmoothScrollSupported = 'scrollBehavior' in document.documentElement.style;

        // native scroll is a must with touch input
        // also use native scroll when scrolling vertically in desktop mode - excluding horizontal because the mouse wheel support is choppy at the moment
        // in cases with firefox, if the smooth scroll api is supported then use that because their implementation is very good
        if (isSmoothScrollSupported && browser.firefox) {
            // native smooth scroll
            options.enableNativeScroll = true;
        }
        else if (options.requireAnimation) {

            // transform is the only way to guarantee animation
            options.enableNativeScroll = false;
        }
        else if (!layoutManager.tv || !browser.animate) {

            options.enableNativeScroll = true;
        }

        // Private variables
        var self = this;
        self.options = o;

        // Frame
        var frameElement = frame;
        var slideeElement = o.slidee ? o.slidee : sibling(frameElement.firstChild)[0];
        var frameSize = 0;
        var pos = {
            start: 0,
            center: 0,
            end: 0,
            cur: 0,
            dest: 0
        };

        var transform = !options.enableNativeScroll;

        var hPos = {
            start: 0,
            end: 0,
            cur: 0
        };

        // Miscellaneous
        var scrollSource = o.scrollSource ? o.scrollSource : frameElement;
        var dragSourceElement = o.dragSource ? o.dragSource : frameElement;
        var animation = {};
        var dragging = {
            released: 1
        };
        var scrolling = {
            last: 0,
            delta: 0,
            resetTime: 200
        };

        var i, l;

        // Normalizing frame
        frame = frameElement;

        // Expose properties
        self.initialized = 0;
        self.frame = frame;
        self.slidee = slideeElement;
        self.options = o;
        self.dragging = dragging;

        function sibling(n, elem) {
            var matched = [];

            for (; n; n = n.nextSibling) {
                if (n.nodeType === 1 && n !== elem) {
                    matched.push(n);
                }
            }
            return matched;
        }

        /**
		 * Loading function.
		 *
		 * Populate arrays, set sizes, bind events, ...
		 *
		 * @param {Boolean} [isInit] Whether load is called from within self.init().
		 * @return {Void}
		 */
        function load(isInit) {

            // Reset global variables
            frameSize = getWidthOrHeight(frameElement, o.horizontal ? 'width' : 'height');
            var slideeSize = o.scrollWidth || Math.max(slideeElement[o.horizontal ? 'offsetWidth' : 'offsetHeight'], slideeElement[o.horizontal ? 'scrollWidth' : 'scrollHeight']);

            // Set position limits & relativess
            pos.start = 0;
            pos.end = max(slideeSize - frameSize, 0);

            if (!isInit) {
                // Fix possible overflowing
                slideTo(within(pos.dest, pos.start, pos.end));
            }
        }

        var pnum = (/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/).source;
        var rnumnonpx = new RegExp("^(" + pnum + ")(?!px)[a-z%]+$", "i");

        function getWidthOrHeight(elem, name, extra) {

            // Start with offset property, which is equivalent to the border-box value
            var valueIsBorderBox = true,
                val = name === "width" ? elem.offsetWidth : elem.offsetHeight,
                styles = getComputedStyle(elem, null),
                isBorderBox = styles.getPropertyValue("box-sizing") === "border-box";

            // Some non-html elements return undefined for offsetWidth, so check for null/undefined
            // svg - https://bugzilla.mozilla.org/show_bug.cgi?id=649285
            // MathML - https://bugzilla.mozilla.org/show_bug.cgi?id=491668
            if (val <= 0 || val == null) {
                // Fall back to computed then uncomputed css if necessary
                //val = curCSS(elem, name, styles);
                if (val < 0 || val == null) {
                    val = elem.style[name];
                }

                // Computed unit is not pixels. Stop here and return.
                if (rnumnonpx.test(val)) {
                    return val;
                }

                // Check for style in case a browser which returns unreliable values
                // for getComputedStyle silently falls back to the reliable elem.style
                valueIsBorderBox = isBorderBox &&
                (support.boxSizingReliable() || val === elem.style[name]);

                // Normalize "", auto, and prepare for extra
                val = parseFloat(val) || 0;
            }

            // Use the active box-sizing model to add/subtract irrelevant styles
            return (val +
                    augmentWidthOrHeight(
                        elem,
                        name,
                        extra || (isBorderBox ? "border" : "content"),
                        valueIsBorderBox,
                        styles
                    )
            );
        }

        var cssExpand = ["Top", "Right", "Bottom", "Left"];

        function augmentWidthOrHeight(elem, name, extra, isBorderBox, styles) {
            var i = extra === (isBorderBox ? "border" : "content") ?
                    // If we already have the right measurement, avoid augmentation
                    4 :
                    // Otherwise initialize for horizontal or vertical properties
                    name === "width" ? 1 : 0,

                val = 0;

            for (; i < 4; i += 2) {
                // Both box models exclude margin, so add it if we want it
                if (extra === "margin") {
                    //val += jQuery.css(elem, extra + cssExpand[i], true, styles);
                }

                if (isBorderBox) {
                    // border-box includes padding, so remove it if we want content
                    if (extra === "content") {
                        //val -= jQuery.css(elem, "padding" + cssExpand[i], true, styles);
                    }

                    // At this point, extra isn't border nor margin, so remove border
                    if (extra !== "margin") {
                        //val -= jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
                    }
                } else {
                    // At this point, extra isn't content, so add padding
                    //val += jQuery.css(elem, "padding" + cssExpand[i], true, styles);

                    // At this point, extra isn't content nor padding, so add border
                    if (extra !== "padding") {
                        //val += jQuery.css(elem, "border" + cssExpand[i] + "Width", true, styles);
                    }
                }
            }

            return val;
        }

        self.reload = function () { load(); };

        function nativeScrollTo(container, pos, immediate) {

            if (!immediate && container.scrollTo) {
                if (o.horizontal) {
                    container.scrollTo(pos, 0);
                } else {
                    container.scrollTo(0, pos);
                }
            } else {
                if (o.horizontal) {
                    container.scrollLeft = Math.round(pos);
                } else {
                    container.scrollTop = Math.round(pos);
                }
            }
        }

        /**
		 * Animate to a position.
		 *
		 * @param {Int}  newPos    New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        function slideTo(newPos, immediate) {

            newPos = within(newPos, pos.start, pos.end);

            if (!transform) {

                nativeScrollTo(slideeElement, newPos, immediate);
                return;
            }

            // Update the animation object
            animation.from = pos.cur;
            animation.to = newPos;
            animation.tweesing = dragging.tweese || dragging.init && !dragging.slidee;
            animation.immediate = !animation.tweesing && (immediate || dragging.init && dragging.slidee || !o.speed);

            // Reset dragging tweesing request
            dragging.tweese = 0;

            // Start animation rendering
            if (newPos !== pos.dest) {
                pos.dest = newPos;
                renderAnimate(animation);
            }
        }

        var scrollEvent = new CustomEvent("scroll");

        function renderAnimate() {

            var obj = getComputedStyle(slideeElement, null).getPropertyValue('transform').match(/([-+]?(?:\d*\.)?\d+)\D*, ([-+]?(?:\d*\.)?\d+)\D*\)/);
            if (obj) {
                // [1] = x, [2] = y
                pos.cur = parseInt(o.horizontal ? obj[1] : obj[2]) * -1;
            }

            var keyframes;

            animation.to = round(animation.to);

            if (o.horizontal) {
                keyframes = [
                    { transform: 'translate3d(' + (-round(pos.cur || animation.from)) + 'px, 0, 0)', offset: 0 },
                    { transform: 'translate3d(' + (-round(animation.to)) + 'px, 0, 0)', offset: 1 }
                ];
            } else {
                keyframes = [
                    { transform: 'translate3d(0, ' + (-round(pos.cur || animation.from)) + 'px, 0)', offset: 0 },
                    { transform: 'translate3d(0, ' + (-round(animation.to)) + 'px, 0)', offset: 1 }
                ];
            }

            var speed = o.speed;

            if (animation.immediate) {
                speed = o.immediateSpeed || 50;
                if (!browser.animate) {
                    o.immediateSpeed = 0;
                }
            }

            var animationConfig = {
                duration: speed,
                iterations: 1,
                fill: 'both'
            };

            if (browser.animate) {
                animationConfig.easing = 'ease-out';
            }

            var animationInstance = slideeElement.animate(keyframes, animationConfig);

            animationInstance.onfinish = function () {
                pos.cur = animation.to;
                document.dispatchEvent(scrollEvent);
            };
        }

        function getBoundingClientRect(elem) {

            // Support: BlackBerry 5, iOS 3 (original iPhone)
            // If we don't have gBCR, just use 0,0 rather than error
            if (elem.getBoundingClientRect) {
                return elem.getBoundingClientRect();
            } else {
                return { top: 0, left: 0 };
            }
        }

        /**
         * Returns the position object.
         *
         * @param {Mixed} item
         *
         * @return {Object}
         */
        self.getPos = function (item) {

            var slideeOffset = getBoundingClientRect(slideeElement);
            var itemOffset = getBoundingClientRect(item);

            var offset = o.horizontal ? itemOffset.left - slideeOffset.left : itemOffset.top - slideeOffset.top;
            var size = o.horizontal ? itemOffset.width : itemOffset.height;
            if (!size && size !== 0) {
                size = item[o.horizontal ? 'offsetWidth' : 'offsetHeight'];
            }

            var centerOffset = o.centerOffset || 0;

            if (!transform) {
                centerOffset = 0;
                if (o.horizontal) {
                    offset += slideeElement.scrollLeft;
                } else {
                    offset += slideeElement.scrollTop;
                }
            }

            return {
                start: offset,
                center: offset + centerOffset - (frameSize / 2) + (size / 2),
                end: offset - frameSize + size,
                size: size
            };
        };

        self.getCenterPosition = function (item) {

            var pos = self.getPos(item);
            return within(pos.center, pos.start, pos.end);
        };

        /**
		 * Slide SLIDEE by amount of pixels.
		 *
		 * @param {Int}  delta     Pixels/Items. Positive means forward, negative means backward.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        self.slideBy = function (delta, immediate) {
            if (!delta) {
                return;
            }
            slideTo(pos.dest + delta, immediate);
        };

        /**
		 * Animate SLIDEE to a specific position.
		 *
		 * @param {Int}  pos       New position.
		 * @param {Bool} immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        self.slideTo = function (pos, immediate) {
            slideTo(pos, immediate);
        };

        /**
		 * Core method for handling `toLocation` methods.
		 *
		 * @param  {String} location
		 * @param  {Mixed}  item
		 * @param  {Bool}   immediate
		 *
		 * @return {Void}
		 */
        function to(location, item, immediate) {
            // Optional arguments logic
            if (type(item) === 'boolean') {
                immediate = item;
                item = undefined;
            }

            if (item === undefined) {
                slideTo(pos[location], immediate);
            } else {

                //if (!transform) {

                //    item.scrollIntoView();
                //    return;
                //}

                var itemPos = self.getPos(item);
                if (itemPos) {
                    slideTo(itemPos[location], immediate, true);
                }
            }
        }

        /**
		 * Animate element or the whole SLIDEE to the start of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        self.toStart = function (item, immediate) {
            to('start', item, immediate);
        };

        /**
		 * Animate element or the whole SLIDEE to the end of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        self.toEnd = function (item, immediate) {
            to('end', item, immediate);
        };

        /**
		 * Animate element or the whole SLIDEE to the center of the frame.
		 *
		 * @param {Mixed} item      Item DOM element, or index starting at 0. Omitting will animate SLIDEE.
		 * @param {Bool}  immediate Reposition immediately without an animation.
		 *
		 * @return {Void}
		 */
        self.toCenter = function (item, immediate) {
            to('center', item, immediate);
        };

        /**
		 * Initialize continuous movement.
		 *
		 * @return {Void}
		 */
        function continuousInit(source) {
            dragging.released = 0;
            dragging.source = source;
            dragging.slidee = source === 'slidee';
        }

        function dragInitSlidee(event) {
            dragInit(event, 'slidee');
        }

        /**
		 * Dragging initiator.
		 *a
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
        function dragInit(event, source) {
            var isTouch = event.type === 'touchstart';
            var isSlidee = source === 'slidee';

            // Ignore when already in progress, or interactive element in non-touch navivagion
            if (dragging.init || !isTouch && isInteractive(event.target)) {
                return;
            }

            // SLIDEE dragging conditions
            if (isSlidee && !(isTouch ? o.touchDragging : o.mouseDragging && event.which < 2)) {
                return;
            }

            if (!isTouch) {
                // prevents native image dragging in Firefox
                event.preventDefault();
            }

            // Reset dragging object
            continuousInit(source);

            // Properties used in dragHandler
            dragging.init = 0;
            dragging.source = event.target;
            dragging.touch = isTouch;
            var pointer = isTouch ? event.touches[0] : event;
            dragging.initX = pointer.pageX;
            dragging.initY = pointer.pageY;
            dragging.initPos = isSlidee ? pos.cur : hPos.cur;
            dragging.start = +new Date();
            dragging.time = 0;
            dragging.path = 0;
            dragging.delta = 0;
            dragging.locked = 0;
            dragging.pathToLock = isSlidee ? isTouch ? 30 : 10 : 0;

            // Bind dragging events
            if (isTouch) {
                dragTouchEvents.forEach(function (eventName) {
                    dom.addEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            } else {
                dragMouseEvents.forEach(function (eventName) {
                    dom.addEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            }

            // Add dragging class
            if (isSlidee) {
                slideeElement.classList.add(o.draggedClass);
            }
        }

        /**
		 * Handler for dragging scrollbar handle or SLIDEE.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
        function dragHandler(event) {
            dragging.released = event.type === 'mouseup' || event.type === 'touchend';
            var pointer = dragging.touch ? event[dragging.released ? 'changedTouches' : 'touches'][0] : event;
            dragging.pathX = pointer.pageX - dragging.initX;
            dragging.pathY = pointer.pageY - dragging.initY;
            dragging.path = sqrt(pow(dragging.pathX, 2) + pow(dragging.pathY, 2));
            dragging.delta = o.horizontal ? dragging.pathX : dragging.pathY;

            if (!dragging.released && dragging.path < 1) {
                return;
            }

            // We haven't decided whether this is a drag or not...
            if (!dragging.init) {
                // If the drag path was very short, maybe it's not a drag?
                if (dragging.path < o.dragThreshold) {
                    // If the pointer was released, the path will not become longer and it's
                    // definitely not a drag. If not released yet, decide on next iteration
                    return dragging.released ? dragEnd() : undefined;
                } else {
                    // If dragging path is sufficiently long we can confidently start a drag
                    // if drag is in different direction than scroll, ignore it
                    if (o.horizontal ? abs(dragging.pathX) > abs(dragging.pathY) : abs(dragging.pathX) < abs(dragging.pathY)) {
                        dragging.init = 1;
                    } else {
                        return dragEnd();
                    }
                }
            }

            event.preventDefault();

            // Disable click on a source element, as it is unwelcome when dragging
            if (!dragging.locked && dragging.path > dragging.pathToLock && dragging.slidee) {
                dragging.locked = 1;
                dragging.source.addEventListener('click', disableOneEvent);
            }

            // Cancel dragging on release
            if (dragging.released) {
                dragEnd();
            }

            slideTo(dragging.slidee ? round(dragging.initPos - dragging.delta) : handleToSlidee(dragging.initPos + dragging.delta));
        }

        /**
		 * Stops dragging and cleans up after it.
		 *
		 * @return {Void}
		 */
        function dragEnd() {
            dragging.released = true;

            if (dragging.touch) {
                dragTouchEvents.forEach(function (eventName) {
                    dom.removeEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            } else {
                dragMouseEvents.forEach(function (eventName) {
                    dom.removeEventListener(document, eventName, dragHandler, {
                        passive: true
                    });
                });
            }

            if (dragging.slidee) {
                slideeElement.classList.remove(o.draggedClass);
            }

            // Make sure that disableOneEvent is not active in next tick.
            setTimeout(function () {
                dragging.source.removeEventListener('click', disableOneEvent);
            });

            dragging.init = 0;
        }

        /**
		 * Check whether element is interactive.
		 *
		 * @return {Boolean}
		 */
        function isInteractive(element) {

            while (element) {

                if (interactiveElements.indexOf(element.tagName) !== -1) {
                    return true;
                }

                element = element.parentNode;
            }
            return false;
        }

        /**
		 * Mouse wheel delta normalization.
		 *
		 * @param  {Event} event
		 *
		 * @return {Int}
		 */
        function normalizeWheelDelta(event) {
            // wheelDelta needed only for IE8-
            scrolling.curDelta = ((o.horizontal ? event.deltaY || event.deltaX : event.deltaY) || -event.wheelDelta);

            if (transform) {
                scrolling.curDelta /= event.deltaMode === 1 ? 3 : 100;
            }
            return scrolling.curDelta;
        }

        /**
		 * Mouse scrolling handler.
		 *
		 * @param  {Event} event
		 *
		 * @return {Void}
		 */
        function scrollHandler(event) {

            // Ignore if there is no scrolling to be done
            if (!o.scrollBy || pos.start === pos.end) {
                return;
            }
            var delta = normalizeWheelDelta(event);

            if (transform) {
                // Trap scrolling only when necessary and/or requested
                if (delta > 0 && pos.dest < pos.end || delta < 0 && pos.dest > pos.start) {
                    //stopDefault(event, 1);
                }

                self.slideBy(o.scrollBy * delta);
            } else {

                if (isSmoothScrollSupported) {
                    delta *= 12;
                }

                if (o.horizontal) {
                    slideeElement.scrollLeft += delta;
                } else {
                    slideeElement.scrollTop += delta;
                }
            }
        }

        /**
		 * Destroys instance and everything it created.
		 *
		 * @return {Void}
		 */
        self.destroy = function () {

            dom.removeEventListener(window, 'resize', onResize, {
                passive: true
            });

            // Reset native FRAME element scroll
            dom.removeEventListener(frameElement, 'scroll', resetScroll, {
                passive: true
            });

            dom.removeEventListener(scrollSource, wheelEvent, scrollHandler, {
                passive: true
            });

            dom.removeEventListener(dragSourceElement, 'touchstart', dragInitSlidee, {
                passive: true
            });

            dom.removeEventListener(frameElement, 'click', onFrameClick, {
                passive: true,
                capture: true
            });

            dom.removeEventListener(dragSourceElement, 'mousedown', dragInitSlidee, {
                //passive: true
            });

            // Reset initialized status and return the instance
            self.initialized = 0;
            return self;
        };

        function onResize() {
            load(false);
        }

        function resetScroll() {
            if (o.horizontal) {
                this.scrollLeft = 0;
            } else {
                this.scrollTop = 0;
            }
        }

        function onFrameClick(e) {
            if (e.which === 1) {
                var focusableParent = focusManager.focusableParent(e.target);
                if (focusableParent && focusableParent !== document.activeElement) {
                    focusableParent.focus();
                }
            }
        }

        /**
		 * Initialize.
		 *
		 * @return {Object}
		 */
        self.init = function () {
            if (self.initialized) {
                return;
            }

            // Disallow multiple instances on the same element
            if (frame.sly) {
                throw new Error('There is already a Sly instance on this element');
            }

            frame.sly = true;

            // Set required styles
            var movables = [];
            if (slideeElement) {
                movables.push(slideeElement);
            }

            if (!transform) {
                if (o.horizontal) {
                    if (layoutManager.desktop) {
                        slideeElement.classList.add('smoothScrollX');
                    } else {
                        slideeElement.classList.add('hiddenScrollX');
                    }
                } else {
                    if (layoutManager.desktop) {
                        slideeElement.classList.add('smoothScrollY');
                    } else {
                        slideeElement.classList.add('hiddenScrollY');
                    }
                }
            } else {
                slideeElement.style['will-change'] = 'transform';
                if (o.horizontal) {
                    slideeElement.classList.add('animatedScrollX');
                } else {
                    slideeElement.classList.add('animatedScrollY');
                }
            }

            if (o.horizontal || transform) {
                // This can prevent others from being able to listen to mouse events
                dom.addEventListener(dragSourceElement, 'mousedown', dragInitSlidee, {
                    //passive: true
                });
            }

            if (transform) {

                dom.addEventListener(dragSourceElement, 'touchstart', dragInitSlidee, {
                    passive: true
                });

                if (!o.scrollWidth) {
                    dom.addEventListener(window, 'resize', onResize, {
                        passive: true
                    });
                }

                if (!o.horizontal) {
                    dom.addEventListener(frameElement, 'scroll', resetScroll, {
                        passive: true
                    });
                }

                // Scrolling navigation
                dom.addEventListener(scrollSource, wheelEvent, scrollHandler, {
                    passive: true
                });

            } else if (o.horizontal) {

                // Don't bind to mouse events with vertical scroll since the mouse wheel can handle this natively

                // Scrolling navigation
                dom.addEventListener(scrollSource, wheelEvent, scrollHandler, {
                    passive: true
                });
            }

            dom.addEventListener(frameElement, 'click', onFrameClick, {
                passive: true,
                capture: true
            });

            // Mark instance as initialized
            self.initialized = 1;

            // Load
            load(true);

            // Return instance
            return self;
        };
    };

    scrollerFactory.create = function (frame, options) {
        var instance = new scrollerFactory(frame, options);
        return Promise.resolve(instance);
    };

    return scrollerFactory;
});