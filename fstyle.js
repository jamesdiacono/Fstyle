// fstyle.js
// James Diacono
// 2022-02-18

/*jslint browser */

const rx_class_character = /^[a-zA-Z0-9_\-]$/;
function encode(value) {

// The 'encode' function encodes a 'value' as a string which is safe to append
// on to a CSS class name.

//      encode("10%");          // "10\\000025"
//      encode("lightskyblue"); // "lightskyblue"

// Encoding is necessary because a fragment's "class" property doubles as its
// identifier. A class must therefore derive deterministically from the
// arguments passed to the factory which produced it, and these could very well
// contain characters not permitted within a class.

// The Array.from function splits the string into glyphs, keeping any surrogate
// pairs intact.

    return Array.from(String(value)).map(function (glyph) {
        if (rx_class_character.test(glyph)) {
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

function resolve(value) {
    return (
        typeof value === "function"
        ? value()
        : value
    );
}

const rx_named_placeholder = /<([^<>\s]+)>/g;
function place(name, template, substitutions) {

// The 'place' function makes a fragment from a 'template'.

    const replacements = {};
    function replacer(ignore, placeholder) {
        if (typeof substitutions === "function") {

// If 'substitutions' is a function, it is called with the placeholder and the
// return value is used as the replacement.

            replacements[placeholder] = substitutions(placeholder);
        } else {

// Otherwise, 'substitutions' is inspected for a matching property.

            if (Object.keys(substitutions).includes(placeholder)) {
                replacements[placeholder] = resolve(substitutions[placeholder]);
            }
        }
        if (
            typeof replacements[placeholder] !== "string"
            && typeof replacements[placeholder] !== "number"
        ) {

// A suitable replacement was not found. This is a mistake.

            throw new Error("Unplaceable <" + placeholder + ">.");
        }
        return replacements[placeholder];
    }
    const rules = template.replace(rx_named_placeholder, replacer);
    return {
        class: (
            typeof name === "string"
            ? Object.values(replacements).reduce(
                function hone(class_name, replacement) {
                    return class_name + "_" + encode(replacement);
                },
                name
            )
            : (
                typeof name === "function"
                ? name()
                : name.map(resolve).map(encode).join("_")
            )
        ),
        rules
    };
}

function rule(name, declarations, substitutions) {
    return function rule_styler() {
        if (substitutions === undefined) {
            return [{
                class: name,
                rules: "." + name + " {" + declarations + "}"
            }];
        }
        const the_fragment = place(name, declarations, substitutions);

// The fragment's "rules" property actually just contains declarations. Wrap it
// in a class selector to make the rule.

        the_fragment.rules = (
            "." + the_fragment.class + " {"
            + the_fragment.rules
            + "}"
        );
        return [the_fragment];
    };
}

const rx_class_placeholder = /<>/g;
function fragment(name, rules, substitutions = {}) {
    return function fragment_styler() {
        const the_fragment = place(name, rules, substitutions);

// Replace occurrences of the empty placeholder with the generated class.

        the_fragment.rules = the_fragment.rules.replace(
            rx_class_placeholder,
            the_fragment.class
        );
        return [the_fragment];
    };
}

function smush(fragments, styler) {
    return styler().concat(fragments);
}

function mix(styler_array) {
    return function mix_styler() {
        return styler_array.reduce(smush, []);
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
    style_element.textContent = fragment.rules.replace(

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
            handles: [],
            rules: fragment.rules
        };
        if (fragment.rules !== requisite.rules) {

// The class does not uniquely identify its rules. It is not safe to continue.

            throw new Error("Fragment changed: " + fragment.class + ".");
        }
        const handle = {};
        requisite.handles.push(handle);
        if (requisite.handles.length === 1) {
            requisite.remove = inserter(fragment);
        }
        requisites[fragment.class] = requisite;
        return function release_fragment() {
            const handle_nr = requisite.handles.indexOf(handle);
            if (handle_nr !== -1) {
                requisite.handles.splice(handle_nr, 1);
                if (requisite.handles.length === 0) {
                    requisite.remove();
                    delete requisites[fragment.class];
                }
            }
        };
    }
    return function require(styler) {
        const fragments = styler();
        const releasers = fragments.map(require_fragment);
        return function release() {
            return releasers.forEach(resolve);
        };
    };
}

function classes(styler) {
    return styler().map(function (fragment) {
        return fragment.class;
    });
}

const range = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function random_character() {
    return range[Math.floor(Math.random() * range.length)];
}

function random_string(length) {
    return new Array(length).fill().map(random_character).join("");
}

let names = new WeakMap();
function name(factory) {
    let string = names.get(factory);
    if (string === undefined) {

// We could use a counter to ensure uniqueness, but randomness is safer because
// it does not require us to manage global state. Even if the application uses
// multiple versions of this module, the generated names will remain unique
// everywhere.

// We can not rely on the factory name as a source of randomness, because
// function names are often removed or shortened by minification. Usually, a
// random string of four characters will protect against collisions in upwards
// of 500 names. Five characters is good for 10,000 names, and six characters is
// good for many more. In the interest of safety, and at the expense of
// aesthetics, we use the longer string.

        string = encode(factory.name) + "_" + random_string(6);
        names.set(factory, string);
    }
    return string;
}

export default Object.freeze({
    context,
    domsert,
    classes,
    rule,
    fragment,
    mix,
    none,
    name,
    resolve
});
