// fstyle.js
// James Diacono
// 2022-02-28

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
// space. The second option is likely to confuse, so we choose the first option
// and pad the hex string with zeros.

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
function place(name, template, substitutions, parameters, identifier) {

// The 'place' function makes a fragment from a 'template'.

    const replacements = {};
    const rules = template.replace(
        rx_named_placeholder,
        function replacer(ignore, placeholder) {
            if (typeof substitutions === "function") {

// If 'substitutions' is a function, it is called with the placeholder and the
// return value is used as the replacement.

                replacements[placeholder] = substitutions(placeholder);
            } else if (substitutions[placeholder] !== undefined) {

// Otherwise, 'substitutions' is inspected for a matching property.

                replacements[placeholder] = resolve(substitutions[placeholder]);
            }
            if (
                typeof replacements[placeholder] !== "string"
                && typeof replacements[placeholder] !== "number"
            ) {

// A suitable replacement was not found. This is a mistake.

                throw new Error("Unreplaceable <" + placeholder + ">.");
            }
            return replacements[placeholder];
        }
    );
    if (parameters === undefined) {
        parameters = Object.values(replacements);
    }
    return {
        class: [
            identifier(name)
        ].concat(
            parameters.map(resolve)
        ).map(
            encode
        ).join(
            "_"
        ),
        rules
    };
}

function rule(name, declarations, substitutions, parameters) {
    return function rule_styler(identifier) {
        const the_fragment = place(
            name,
            declarations,
            substitutions,
            parameters,
            identifier
        );

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
function fragment(name, rules, substitutions, parameters) {
    return function fragment_styler(identifier) {
        const the_fragment = place(
            name,
            rules,
            substitutions,
            parameters,
            identifier
        );

// Replace occurrences of the empty placeholder with the generated class.

        the_fragment.rules = the_fragment.rules.replace(
            rx_class_placeholder,
            the_fragment.class
        );
        return [the_fragment];
    };
}

function mix(styler_array) {
    return function mix_styler(identifier) {
        return styler_array.reduce(
            function (fragments, styler) {
                return fragments.concat(styler(identifier));
            },
            []
        );
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

function identify() {
    let names = new WeakMap();
    let counter = 0;
    return function identifier(value) {
        if (typeof value === "string") {

// The value is a string. It is the responsibility of the caller to ensure that
// it is unique.

            return value;
        }

// The value is a function. Check if we have already generated a name for it,
// and if not, ensure a unique name by incrementing a counter.

        if (names.has(value)) {
            return names.get(value);
        }
        const name = "u" + counter + "_" + value.name;
        counter += 1;
        names.set(value, name);
        return name;
    };
}

// A valid class starts with a letter or underbar. Leading hyphens are reserved
// for browser implementations, so we do permit them. Subsequent characters may
// include letters, numbers, underbars, hyphens or unicode escape sequences. A
// unicode escape sequence is a backslash followed by 6 hexadecimal characters.

const rx_class = /^[_a-zA-Z](?:[_a-zA-Z0-9\-]|\\[0-9A-F]{6})*$/;
function context(
    inserter = domsert,
    identifier = identify()
) {
    let requisites = Object.create(null);
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
            references: [],
            rules: fragment.rules
        };
        if (fragment.rules !== requisite.rules) {

// The class does not uniquely identify its rules. It is not safe to continue.

            throw new Error("Fragment changed: " + fragment.class + ".");
        }
        const reference = {};
        requisite.references.push(reference);
        if (requisite.references.length === 1) {
            requisite.remove = inserter(fragment);
        }
        requisites[fragment.class] = requisite;
        return function release_fragment() {
            const reference_nr = requisite.references.indexOf(reference);
            if (reference_nr !== -1) {
                requisite.references.splice(reference_nr, 1);
                if (requisite.references.length === 0) {
                    requisite.remove();
                    delete requisites[fragment.class];
                }
            }
        };
    }
    return function require(styler) {
        const fragments = styler(identifier);
        const releasers = fragments.map(require_fragment);
        return {
            classes: fragments.map(function (fragment) {
                return fragment.class;
            }),
            release() {
                return releasers.forEach(resolve);
            }
        };
    };
}

export default Object.freeze({
    context,
    domsert,
    identify,
    rule,
    fragment,
    mix,
    none,
    resolve
});
