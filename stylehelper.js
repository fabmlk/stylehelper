/**
 * This is a pure-JS helper module to handle various style-related actions.
 * Though part of the fake input project, this lib could be used outside of this project.
 *
 * Lib tested on recent versions of Chrome & Firefox.
 */

// https://github.com/umdjs/umd/blob/master/templates/returnExports.js
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD, Register as an anonymous module.
        define(['object-assign'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but only CommonJS-like environments
        // that support module.exports, like Node.
        module.exports = factory(['object-assign']);
    } else {
        // Browser globals (root is window)
        root.StyleHelper = factory('object-assign');
    }
}(this, function (objectAssign) {
    var inertSheet = null;

    if (typeof Object.assign === "function") {
        objectAssign = Object.assign;
    }

    return {

        /**
         * Returns the stylesheet containing the .inert rule. If it does not exist, a new <style> is prepended
         * in the head with the newly created .inert class rule.
         * (There was a talk to add a inert attribute in HTML5 but it is not implemented and the spec
         * is not working on it so much...)
         * @returns {Stylesheet} the stylesheet we injected .inert style on
         */
        getInertSheet: function () {
            var css, head, style;

            if (inertSheet === null) {
                css = '.inert {' +
                        /* position: absolute changes display to block.
                         We set display explicitly so that makeInert() can returns default display style too.
                         */
                        'position: absolute;' +
                        'display: block;' + /* could be anything actually */
                        'visibility: hidden;' +
                        'z-index: -1;' +
                        '-webkit-user-select: none;' +
                        '-moz-user-select: none;' +
                        '-ms-user-select: none;' +
                        'user-select: none;' +
                        'pointer-events: none;' +
                '}';
                head = document.head || document.getElementsByTagName('head')[0];
                style = document.createElement('style');
                style.type = 'text/css';
                style.dataset.title = "style-helper"; // just in case we want to identify our stylesheet later

                if (style.styleSheet) { // IE only
                    style.styleSheet.cssText = css;
                } else {
                    style.appendChild(document.createTextNode(css));
                }
                // insert stylesheet before everything else so they can be overridden easily
                head.insertBefore(style, head.firstChild);
                inertSheet = style.sheet;
            };
            return inertSheet;
        },


        /**
         * Get computed cssText from element.
         *
         * @param {Element} elt
         * @returns {String} the css text
         */
        getComputedStyleCssText: function (elt) {
            var style = window.getComputedStyle(elt);

            return this.getCssTextFromStyle(style);
        },


        /**
         * Get cssText from style
         * There is an old bug in Firefox where cssText returns empty "" on
         * a CSSStyleDeclaration object (we can also notice from the Firefox debugger
         * that getComputedStyle() returns a CSS2Properties Object instead of CSSStyleDeclaration).
         * See https://bugzilla.mozilla.org/show_bug.cgi?id=137687.
         * (still present in version 49.0.1).
         *
         * @param {Object} style - a CSSStyleDeclaration or CSS2Properties or object as returned from getVisibleComputedStyle()
         * @returns {String} the css text
         */
        getCssTextFromStyle: function (style) {
            var cssText = "";


            if (style.cssText) { // present and non empty cssText
                return style.cssText;
            }

            for (var prop in style) {
                cssText += prop + ": " + (style.getPropertyValue ? style.getPropertyValue(prop) : style[prop]) + "; ";
            }

            return cssText;
        },


        /**
         * Returns the css computed style of an element. If the element is not visible, this function tries to calculate
         * the style of the element as it would appear if visible.
         *
         * The object returned is a trimmed CSSStyleDeclaration due to the use of Object.assign() to clone
         * the resultset. As such, the returned object is not a CSSStyleDeclaration anymore and does not contain
         * functions like getPropertyValue, getPropertyPriority, length property, numeric keys etc...
         * It is then a simple object literal whose keys are the css key rule and values the css values.
         * The exception is the preservation of the cssText property.
         * Note that on Firefox, the resulset was derived from a CSS2Properties instead of CSSStyleDeclaration, and as
         * such does not provide a usable cssText: we thus remove it.
         *
         * @param {Element} elt
         * @returns {Object}
         */
        getVisibleComputedStyle: function (elt) {
            var savedDisplayNone = [],
                cur, prop,
                overridenStyles = {
                    display: "block",
                    position: "absolute",
                    opacity: 0,
                    top: "-999999px"
                },
                visibleComputedStyle
            ;

            // Algo: for any ancestor with display none, display the ancestor back, outside of the viewport,
            // and compute the style there. On the way, save any overriden inline styles so we can
            // restore them when we're done.
            for (cur = elt; cur !== null; cur = cur.parentNode) {
                if (cur.nodeType === 1 && window.getComputedStyle(cur).display === "none") {
                    savedDisplayNone.unshift({
                        elm: cur,
                        inlineStyle: {}
                    });
                    for (prop in overridenStyles) {
                        if (cur.style[prop]) {
                            savedDisplayNone[0].inlineStyle[prop] = cur.style[prop];
                        }
                        cur.style.setProperty(prop, overridenStyles[prop], "important");
                    }
                }
            }
            visibleComputedStyle = window.getComputedStyle(elt);

            // we shallow copy to make sure the styles remain unchanged if the DOM changes.
            // Object.assign removes:
            //   - properties with values undefined|null (ex: src: "")
            //   - inherited properties (hasOwnProperty() is false) (ex: cssText, length)
            //   - non-enumerable properties (propertyIsEnumerable() is false) <=> all properties retrievable from .item() (ex: 0: animation-delay)
            // This results in a trim CSSStyleDeclaration (or CSS2Properties on Firefox)
            visibleComputedStyle = objectAssign({
                cssText: visibleComputedStyle.cssText, // keep cssText in case is present
            }, visibleComputedStyle);

            if (visibleComputedStyle.cssText === "") { // Firefox
                delete visibleComputedStyle.cssText;
            }

            // restore modified properties
            savedDisplayNone.forEach(function (saved) {
                for (prop in overridenStyles) {
                    saved.elm.style.removeProperty(prop);
                }
                for (prop in saved.inlineStyle) {
                    saved.elm.style[prop] = saved.inlineStyle[prop];
                }
            });

            return visibleComputedStyle;
        },


        /**
         * Returns a reference to the stylesheet with the data-title attribute passed in argument.
         * We use data-title instead of title attribute as this is reserved for alternate stylesheets.
         * @param datatitle - the data-title attribute name to look for
         * @returns {Stylesheet} the found stylesheet or null
         */
        getSheetFromDataDataTitle: function (datatitle) {
            var sheet = null;

            for (var i = 0; i < document.styleSheets.length; i++) {
                sheet = document.styleSheets[i];
                if (sheet.dataset.title === datatitle) {
                    break;
                }
            }
            return sheet;
        },

        /**
         * Returns an object that contains the style defined for 'selector' in the stylesheet 'sheet'
         * (defaults to inert stylesheet if not provided).
         * @param selector (String} the selector to retrieve the style from
         * @param sheet {Stylesheet} (Optional) the stylesheet where to look for the selector
         * @returns {Object|null} the filled object if the style is retrieved, null otherwise
         */
        getStyleAttributes: function (selector, sheet) {
            sheet = sheet || this.getInertSheet();
            var styleMatchMap = {},
                cssStyleDeclaration = this.getRawStyleDeclaration(selector, sheet),
                styleAttributes
            ;

            // TODO: find a solution for Firefox. We need to return a live styleDeclaration we can alter later
            // instead of a simple literal object.

            // if (cssStyleDeclaration !== null) {
            //     // cssStyleDeclaration is not completely enumerable in Firefox (bug?)
            //     // so instead we use cssText to parse the individual attributes
            //     styleAttributes = cssStyleDeclaration.cssText.split(';');
            //     styleAttributes.forEach(function (styleAttribute) {
            //         var splitStyleAttribute = styleAttribute.split(':');
            //
            //         if (splitStyleAttribute.length === 2) {
            //             styleMatchMap[splitStyleAttribute[0].trim()] = splitStyleAttribute[1].trim();
            //         }
            //     });
            // }

            return cssStyleDeclaration;
        },

        /**
         * Get raw CSSStyleDeclaration object associated to a selector in a stylesheet (default to inert stylesheet if absent).
         * @param selector {String} the selector to retrieve
         * @param sheet {Stylesheet} (Optional) the sheet where to search the selector
         * @returns {CSSStyleDeclaration} if the selector exists, null otherwise
         */
        getRawStyleDeclaration: function (selector, sheet) {
            sheet = sheet || this.getInertSheet();
            var cssRules = sheet.cssRules || [];

            for (var x = 0; x < cssRules.length; x++) {
                if (cssRules[x].selectorText == selector) {
                    return cssRules[x].style;
                }
            }

            return null;
        },

        /**
         * Add a css rule from raw string parameters in the specified stylesheet or "inert stylesheet" if no stylesheet provided.
         * @param {String} selector - the selector rule to add, ex: ".foo"
         * @param {String} body - the body of the rule to add, ex: "margin-right: 15px; display: inline-block"
         * @param {Stylesheet} (Optional) sheet - the stylesheet where we want to add the rule, uses inert stylesheet by default
         * @returns {CSSStyleDeclaration} a reference to the style object we added
         */
        addRawCSSRule: function (selector, body, sheet) {
            var styleDeclaration;

            sheet = sheet || this.getInertSheet();

            styleDeclaration = this.getRawStyleDeclaration(selector, sheet);
            if (styleDeclaration !== null) { // already exists
                return styleDeclaration;
            }

            if (sheet.insertRule) { // standard
                sheet.insertRule(selector + '{' + body + '}', 0); // insert first
            } else { // non-standard addRule
                sheet.addRule(selector, body, 0);
            }

            return sheet.cssRules[0].style;
        },


        /**
         * Add a css rule from CSSStyleDeclaration|CSS2Properties parameter in the specified stylesheet
         * or "inert stylesheet" if no stylesheet provided.
         * @param {String} selector - the selector rule to add, ex ".foo"
         * @param {CSSStyleDeclaration|CSS2Properties} data
         * @param {Stylesheet} (Optional) sheet - the stylesheet where to add the rule
         */
        addCSSRule: function (selector, data, sheet) {
            this.addRawCSSRule(selector, this.getCssTextFromStyle(data), sheet || this.getInertSheet());
        },

        /**
         * Make an element "inert" aka totally invisible in the DOM. Saves into 2nd param the styles
         * that were overriden during the process.
         * @param {HTMLElement} elt - the DOM node we want to make inert
         * @param {Object} (Optional) affectedStyles - an empty object that will contain the overriden styles
         * @returns {Object} (Optional) an object holding all the original styles of arg elt that were overriden
         *                              to make it inert
         */
        makeInert: function (elt, affectedStyles) {
            var defaults = window.getComputedStyle(elt),
                inertStyle = this.getStyleAttributes('.inert', this.getInertSheet())
            ;

            // save all default styles we will override by the .inert rule
            // Note: this code must come before adding the .inert class to the element as it
            // will dynamically change our referenced defaults object in Firefox
            // despite being read-only (not happening in Chrome).
            if (affectedStyles) {
                for (var prop in inertStyle) {
                    if (inertStyle.hasOwnProperty(prop)) {
                        // we make sure prop the property is camel-cased as at least Firefox
                        // doesn't provide hyphenated properties when vendor-prefixed
                        prop = prop.replace(/-([a-z])/g, function (str, letter) {
                            return letter.toUpperCase();
                        });
                        affectedStyles[prop] = defaults[prop] || "initial";
                    }
                }
            }

            elt.dataset.tabindex = elt.getAttribute("tabindex"); // save original tabindex to restore later
            elt.setAttribute("tabindex", "-1"); // prevent focusable/tabbable

            elt.classList.add("inert");
        },

        /**
         * Restore an element made inert to its original styles
         * @param {HTMLElement} elt - the element to restore
         */
        unmakeInert: function (elt) {
            elt.classList.remove("inert");
            elt.setAttribute("tabindex", elt.dataset.tabindex);
        },


        /**
         * Remove a css property from a CSSStyleDeclaration-like.
         * This method accepts as param both a selector whose declaration we want to alter, or a direct declaration.
         * If the param is a declaration object, it can be a CSSStyleDeclaration, CSS2Properties or object as returned by
         * getVisibleComputedStyle.
         *
         * @param {Object|String] styleDeclaration or selector
         * @param {String} prop - the name of the property to remove
         */
        removeProp: function (styleDeclarationOrSelector, prop) {

            if (typeof styleDeclarationOrSelector === "string") { // got a selector
                styleDeclarationOrSelector = this.getStyleAttributes(styleDeclarationOrSelector);
            }
            if (styleDeclarationOrSelector) {
                delete styleDeclarationOrSelector[prop];
                if (styleDeclarationOrSelector.cssText) {
                    // remove also from cssText
                    styleDeclarationOrSelector.cssText = styleDeclarationOrSelector.cssText.replace(new RegExp("[;^] *" + prop + ":[^;]+(?=;)"), "");
                }
            }
        },


        /**
         * Remove a css rule defined by its selector from the stylesheet (defaults to inert stylesheet if arg not specified).
         * If the stylesheet contains duplicated rules, only the first one will be removed.
         * @param {String} selector - the selector matching the rule to remove
         * @param {Stylesheet} (Optional) sheet - the sheet to remove the selector from
         */
        removeRule: function (selector, sheet) {
            sheet = sheet || this.getInertSheet();
            var cssRules = sheet.cssRules || [];

            for (var x = 0; x < cssRules.length; x++) {
                if (cssRules[x].selectorText == selector) {
                    sheet.deleteRule(x);
                    break;
                }
            }
        }
    };
}));
