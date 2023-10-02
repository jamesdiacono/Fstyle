// fstyle.js
// James Diacono
// 2023-10-03

/*jslint browser */

// A valid class starts with a letter or underbar. Each subsequent character is
// a letter, number, underbar, hyphen, or U+00A0 and above.

const rx_class_character = /^[a-zA-Z0-9\u00a0-\uffff_\-]$/;
const rx_named_placeholder = /<([^<>\s]+)>/g;
const rx_empty_placeholder = /<>/g;
const rx_unicode_escape_sequence = /\\[0-9A-F]{6}/g;
const rx_character = /./g;
const lookalikes = {
    ".": "\u2024", // One Dot Leader
    "#": "\uff03", // Fullwidth Number Sign
    "%": "\u2052", // Commercial Minus Sign
    "(": "\u27ee", // Mathematical Left Flattened Parenthesis
    ")": "\u27ef", // Mathematical Right Flattened Parenthesis
    ",": "\u201a", // Single Low-9 Quotation Mark
    " ": "\u2008"  // Punctuation Space
};

function spoof(string) {

// ASCII symbols are not allowed in classes, but symbols commonly present in CSS
// values have Unicode lookalikes. These can be substituted to improve
// readability, at the risk of introducing ambiguity.

    return string.replace(rx_character, function (character) {
        return (
            typeof lookalikes[character] === "string"
            ? lookalikes[character]
            : character
        );
    });
}

function encode(value) {

// The 'encode' function encodes a 'value' as a string that is safe to append on
// to a CSS class.

//      encode("10%");          // "10\\000025"
//      encode("1.4");          // "1\\00002E4"
//      encode("lightskyblue"); // "lightskyblue"

// The Array.from function splits the string into glyphs, keeping any surrogate
// pairs intact.

    return Array.from(String(value)).map(function (glyph) {
        if (rx_class_character.test(glyph)) {
            return glyph;
        }

// A Unicode escape sequence is a backslash followed by some hexadecimal
// characters. The hex string can either be exactly 6 characters long, or
// terminated by a space. The second option is likely to confuse, so we choose
// the first option and pad the hex string with leading zeros.

        const unicode_hex = glyph.codePointAt(0).toString(16).toUpperCase();
        return "\\" + unicode_hex.padStart(6, "0");
    }).join("");
}

function render(classify, styler, label, template, data, parameters = {}) {

// The 'render' function makes a fragment object, which is just data.

    let used = Object.create(null);
    const available = (
        typeof data === "function"
        ? data(parameters)
        : data || parameters
    );
    const statements = template.replace(
        rx_named_placeholder,
        function replacer(placeholder, key) {
            const value = available[key];
            if (typeof value === "string" || typeof value === "number") {
                used[key] = value;
                return value;
            }

// A matching replacement was not provided. This is a mistake.

            throw new Error(
                "Missing value for " + placeholder + " in styler \""
                + label + "\"."
            );
        }
    );
    return {
        class: encode(classify(styler, label, used, parameters)),
        statements
    };
}

function rule(label, template, data) {
    return function rule_styler(parameters) {
        return function rule_requireable(classify) {
            const the_fragment = render(
                classify,
                rule_styler,
                label,
                template,
                data,
                parameters
            );

// The fragment currently just contains CSS declarations. Wrap them in a class
// selector to make a ruleset.

            the_fragment.statements = (
                "." + the_fragment.class + " {" + the_fragment.statements + "}"
            );
            return [the_fragment];
        };
    };
}

function fragment(label, template, data) {
    return function fragment_styler(parameters) {
        return function fragment_requireable(classify) {
            const the_fragment = render(
                classify,
                fragment_styler,
                label,
                template,
                data,
                parameters
            );

// Replace occurrences of the empty placeholder with the generated class.

            the_fragment.statements = the_fragment.statements.replace(
                rx_empty_placeholder,
                the_fragment.class
            );
            return [the_fragment];
        };
    };
}

function domsert(css, the_class) {
    const style_element = document.createElement("style");

// We assign each style element a unique attribute, to help the programmer
// distinguish between them when debugging.

    style_element.setAttribute("data-fstyle", the_class);
    style_element.textContent = css.replace(

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
        style_element.remove();
    };
}

function ref() {

// Makes a classifier that varies the class solely by the styler's object
// reference.

    let ids = new WeakMap();
    let counter = 0;
    return function ref_classifier(styler) {
        if (ids.has(styler)) {
            return ids.get(styler);
        }
        const the_class = "f" + counter;
        counter += 1;
        ids.set(styler, the_class);
        return the_class;
    };
}

function development() {

// Makes a classifier suitable for use in development.

// The class derives deterministically from the styler, the label, and the named
// parameters. This produces the most meaningful and readable classes, but can
// yield redundant fragments when optional parameters are used.
// The 'parameters' parameter must be an object containing only primitive
// values.

    const ref_classifier = ref();
    return function development_classifier(styler, label, ignore, parameters) {
        return Object.keys(parameters).sort().reduce(
            function append_parameter(the_class, key) {
                const value = parameters[key];
                if (typeof value === "function" || (
                    value && typeof value === "object"
                )) {

// The value does not have a useful string form. This could cause a collision.

                    throw new Error(
                        "Bad parameter \"" + key
                        + "\" provided to styler \"" + label + "\"."
                    );
                }
                return the_class + "·" + key + "→" + spoof(String(value));
            },
            ref_classifier(styler) + "⎧" + label + "⎭"
        );
    };
}

function production(intern = false) {

// Makes a classifier suitable for use in production.

// The class derives deterministically from the styler, the label, and the
// replacements (in the order that they were injected). This approach is very
// precise and mechanical. It also permits 'parameters' to be any kind of
// value. However, it produces long classes that are not very readable.

// Setting 'intern' to true makes the class names much shorter, but uses more
// memory. This strategy is intended for situations where HTML and CSS is being
// generated on the server and will incur a network cost.

    const ref_classifier = ref();
    let intern_counter = 0;
    let intern_memo = Object.create(null);
    return function production_classifier(styler, label, replacements) {
        const the_class = Object.keys(replacements).reduce(
            function append_replacement(the_class, key) {
                return the_class + "_" + key + "_" + replacements[key];
            },
            ref_classifier(styler) + "_" + label
        );
        if (intern) {
            if (intern_memo[the_class] === undefined) {
                intern_memo[the_class] = "f" + intern_counter;
                intern_counter += 1;
            }
            return intern_memo[the_class];
        }
        return the_class;
    };
}

function fragify(requireable, classify) {
    return (
        typeof requireable === "function"
        ? requireable(classify)
        : requireable.map(function (the_requireable) {
            return fragify(the_requireable, classify);
        }).flat()
    );
}

function context(capabilities = {}) {
    let insert = capabilities.insert || domsert;
    let classify = capabilities.classify || development();
    let requisitions = Object.create(null);

    function require_fragment(fragment) {

// Each time a fragment is required, a reference is stored in the appropriate
// 'requisition' object. References are discarded when their corresponding
// releaser function is invoked. When a requisition runs out of references, the
// fragment is removed.

        const reference = {};
        let requisition = requisitions[fragment.class];
        if (requisition === undefined) {
            requisition = {
                statements: fragment.statements,
                remove: insert(fragment.statements, fragment.class),
                references: [reference]
            };
        } else {
            requisition.references.push(reference);
        }
        requisitions[fragment.class] = requisition;
        return function release_fragment() {
            const reference_nr = requisition.references.indexOf(reference);
            if (reference_nr !== -1) {
                requisition.references.splice(reference_nr, 1);
                if (requisition.references.length === 0) {
                    requisition.remove();
                    delete requisitions[fragment.class];
                }
            }
        };
    }

    return Object.freeze({
        require(requireable) {
            const fragments = fragify(requireable, classify);
            const releasers = fragments.map(require_fragment);
            return {
                classes: fragments.map(function (fragment) {
                    return fragment.class;
                }),
                release() {
                    return releasers.forEach(function (releaser) {
                        releaser();
                    });
                }
            };
        },
        dispose() {
            if (insert !== undefined) {
                Object.values(requisitions).forEach(function (requisition) {
                    requisition.remove();
                });
            }
            insert = undefined;
            classify = undefined;
        }
    });
}

export default Object.freeze({
    rule,
    fragment,
    context,
    domsert,
    development,
    production
});
