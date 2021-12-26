// fstyle.js
// James Diacono
// 2021-12-18

/*jslint browser */

let counter = 0;
function uniqify(name) {

// We could use randomness, but counters make more readable names. A counter
// should provide uniqueness for the lifetime of the running application.

    name = "u" + counter + "_" + name;
    counter += 1;
    return name;
}

function resolve(value) {
    return (
        typeof value === "function"
        ? value()
        : value
    );
}

const rx_regular = /^[a-zA-Z0-9_\-]$/;
function encode(value) {

// We use the Array.from function to split the string into glyphs. This keeps
// any surrogate pairs together.

    return Array.from(
        String(resolve(value))
    ).map(function (glyph) {
        if (rx_regular.test(glyph)) {
            return glyph;
        }

// Most non-alphameric characters, like "." or "%", are only allowed in CSS
// classes if they are escaped.

        let unicode_hex = glyph.codePointAt(0).toString(16).toUpperCase();
        return (

// The escape sequence begins with a single backslash.

            "\\"

// The hex string can either be exactly 6 characters long, or terminated by a
// space. The second option is dubious, so we pad the hex string with zeros.

            + new Array(6 - unicode_hex.length + 1).join("0")
            + unicode_hex
        );
    }).join("");
}

const rx_placeholder = /<([^<>\s]+)>/g;
function fragment(class_name, rules, substitutions) {
    function replacer(ignore, placeholder) {
        let replacement;
        if (typeof substitutions === "function") {

// If 'substitutions' is a function, it is called with the placeholder and the
// return value is used as the replacement.

            replacement = substitutions(placeholder);
        } else {

// Otherwise, 'substitutions' is inspected for a matching property.

            if (Object.keys(substitutions).includes(placeholder)) {
                replacement = resolve(substitutions[placeholder]);
            }
        }
        if (
            typeof replacement !== "string"
            && typeof replacement !== "number"
        ) {

// A suitable replacement was not found. This is a mistake.

            throw new Error("Unreplaceable <" + placeholder + ">.");
        }
        return replacement;
    }
    return function fragment_styler() {
        return [{
            class: resolve(class_name),
            rules: (

// If substitutions are provided, the 'rules' string is treated as a template.
// Otherwise, the 'rules' are used verbatim.

                substitutions !== undefined
                ? rules.replace(rx_placeholder, replacer)
                : rules
            )
        }];
    };
}

function rule(class_name, declarations, substitutions) {
    const fragment_styler = fragment(class_name, declarations, substitutions);
    return function rule_styler() {
        const fragments = fragment_styler();

// Wrapping the declarations in a class selector makes a rule.

        fragments[0].rules = (
            "." + resolve(class_name) + " {"
            + fragments[0].rules
            + "}"
        );
        return fragments;
    };
}

function mix(styler_array) {
    function flatten(fragments, styler) {
        return styler().concat(fragments);
    }
    return function mix_styler() {
        return styler_array.reduce(flatten, []);
    };
}

function none() {
    return mix([]);
}

const rx_unicode_escape_sequence = /\\[0-9A-F]{6}/g;
function domsert(fragment) {
    const style_element = document.createElement("style");

// We assign each style element a unique attribute, to help the programmer
// distinguish between them when debugging.

    style_element.setAttribute("data-fragment", fragment.class);
    style_element.innerHTML = fragment.rules.replace(

// It is necessary to escape the backslash in any unicode escape sequences, so
// that they are not interpreted by the HTML parser.

        rx_unicode_escape_sequence,
        function escape_the_escape(match) {
            return "\\" + match;
        }
    );
    const existing = document.head.getElementsByTagName("style");
    if (existing.length === 0) {
        document.head.appendChild(style_element);
    } else {

// The order in which fragments are added to the page can affect the specificity
// of colliding declarations. Consider the "color" declaration in the following
// example:

//      <style>.red {color: red;}</style>
//      <style>.green {color: green;}</style>
//      <div class="green red">Text</div>

// The text will be green because the green ruleset is declared after the red
// ruleset. But the ordering of the style elements is not predictable, making
// this a subtle hazard. To help expose such mistakes quickly, the style
// elements are inserted in a random order.

        document.head.insertBefore(
            style_element,
            existing[Math.floor(Math.random() * existing.length)]
        );
    }
    return function remover() {
        if (style_element.parentElement) {

// It is possible that document.head has been replaced since the element was
// inserted. In such a case, calling document.head.removeChild(style_element)
// raises an exception because style_element is no longer a child of
// document.head. To be on the safe side, the style element is removed from
// whichever parent it has now.

            style_element.parentElement.removeChild(style_element);
        }
    };
}

// A valid class starts with a letter or underbar. Leading hyphens are reserved
// for browser implementations, so we do permit them. Subsequent characters may
// include letters, numbers, underbars, hyphens or unicode escape sequences. A
// unicode escape sequence is a backslash followed by 6 hexadecimal characters.

const rx_class = /^[_a-zA-Z](?:[_a-zA-Z0-9\-]|\\[0-9A-F]{6})*$/;
function context(inserter = domsert) {
    const requisites = Object.create(null);
    function require_fragment(fragment) {
        if (
            typeof fragment.class !== "string"
            || !rx_class.test(fragment.class)
        ) {
            throw new Error("Bad class.");
        }
        if (typeof fragment.rules !== "string") {
            throw new Error("Bad rules.");
        }
        const requisite = requisites[fragment.class] || {
            count: 0,
            rules: fragment.rules
        };
        if (fragment.rules !== requisite.rules) {

// The class does not uniquely identify its rules. It is not safe to continue.

            throw new Error("Rules must not change.");
        }
        requisite.count += 1;
        if (requisite.count === 1) {
            requisite.remove = inserter(fragment);
        }
        requisites[fragment.class] = requisite;
    }
    function release_fragment(fragment) {
        const requisite = requisites[fragment.class];
        if (requisite !== undefined) {
            requisite.count -= 1;
            if (requisite.count === 0) {
                requisite.remove();
                delete requisites[fragment.class];
            }
        }
    }
    return function require(styler) {
        const fragments = styler();
        fragments.forEach(require_fragment);
        return function release() {
            return fragments.forEach(release_fragment);
        };
    };
}

function classes(styler) {
    return styler().map(function (fragment) {
        return fragment.class;
    });
}

export default Object.freeze({
    uniqify,
    rule,
    fragment,
    mix,
    none,
    resolve,
    encode,
    classes,
    context,
    domsert
});
