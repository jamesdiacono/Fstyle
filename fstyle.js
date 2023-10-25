// fstyle.js
// James Diacono
// 2023-10-25

/*jslint browser */

// A valid class starts with a letter or underbar. Each subsequent character is
// a letter, number, underbar, hyphen, or U+00A0 and above.

const rx_class_character = /^[a-zA-Z0-9\u00A0-\uFFFF_\-]$/;
const rx_placeholder = /\[\]/g;
const rx_unicode_escape_sequence = /\\[0-9A-F]{6}/g;
const rx_character = /./g;
const lookalikes = {
    ".": "\u2024", // One Dot Leader
    "#": "\uFF03", // Fullwidth Number Sign
    "%": "\u2052", // Commercial Minus Sign
    "(": "\u27EE", // Mathematical Left Flattened Parenthesis
    ")": "\u27EF", // Mathematical Right Flattened Parenthesis
    ",": "\u201A", // Single Low-9 Quotation Mark
    " ": "\u2423"  // Open Box
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

function check_template(template) {
    if (typeof template !== "function") {
        throw new Error("Not a template function: '" + template + "'");
    }
}

function check_parameters(parameters, template_name) {
    if (parameters !== undefined) {
        Object.entries(parameters).forEach(function ([key, value]) {
            if (typeof value === "function" || (
                value && typeof value === "object"
            )) {

// The value does not have a meaningful string representation. This could cause
// a class collision.

                throw new Error(
                    "Bad parameter \"" + key
                    + "\" provided to styler \"" + template_name + "\"."
                );
            }
        });
    }
}

function rule(template) {
    check_template(template);
    return function rule_styler(parameters = {}) {
        check_parameters(parameters, template.name);
        const declarations = template(parameters);
        return function rule_requireable(classify) {
            const the_class = encode(classify(template, parameters));
            return [{
                class: the_class,

// Wrap the rendered CSS declarations in a class selector to make a ruleset.

                statements: "." + the_class + " {" + declarations + "}"
            }];
        };
    };
}

function css(template) {
    check_template(template);
    return function fragment_styler(parameters = {}) {
        check_parameters(parameters, template.name);
        const statements = template(parameters);
        return function fragment_requireable(classify) {
            const the_class = encode(classify(template, parameters));
            return [{
                class: the_class,

// Replace occurrences of "[]" with the generated class.

                statements: statements.replace(rx_placeholder, the_class)
            }];
        };
    };
}

function domsert(fragment, parent = document.head) {
    const style_element = document.createElement("style");

// We assign each style element a unique attribute so that we can find them
// easily, and to help the programmer distinguish between them when debugging.

    style_element.setAttribute("data-fstyle", fragment.class);
    style_element.textContent = fragment.statements.replace(

// It is necessary to escape the backslash in any unicode escape sequences, so
// that they are not interpreted by the HTML parser.

        rx_unicode_escape_sequence,
        function escape_the_escape(match) {
            return "\\" + match;
        }
    );

// Find any style elements that we added previously. Only direct children are
// considered.

    const existing = parent.querySelectorAll(":scope > style[data-fstyle]");
    if (existing.length === 0) {
        parent.appendChild(style_element);
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

        parent.insertBefore(
            style_element,
            existing[Math.floor(Math.random() * existing.length)]
        );
    }
    return function remover() {
        style_element.remove();
    };
}

function fragify(requireable, classify) {

// A requireable is either a function or an array of requireables. Such a
// recursive definition warrants a recursive function. The 'fragify' function
// walks the tree (made up of arrays), invoking each function it finds with the
// 'classify' function.

    return (
        typeof requireable === "function"
        ? requireable(classify)
        : requireable.map(function (the_requireable) {
            return fragify(the_requireable, classify);
        }).flat()
    );
}

function context(spec = {}) {
    let insert = spec.insert || domsert;
    let requisitions = Object.create(null);
    let ids = new WeakMap();
    let counter = 0;
    let intern_counter = 0;
    let interned = Object.create(null);

    function classify(template, parameters) {

// This 'classify' function returns class strings derived deterministically from
// a template function (both its object reference and name) and the named
// parameters.

// The classes are readable and meaningful, but can yield redundant fragments
// when optional parameters are used. I have not yet found a good solution for
// this.

// Interning makes the class names much shorter, but leaks memory for the
// lifetime of the context. Interning is intended for production scenarios
// where HTML and CSS is being generated on the server and will incur a network
// cost.

        let the_class;
        if (ids.has(template)) {
            the_class = ids.get(template);
        } else {
            the_class = "f" + counter + "⎧" + template.name + "⎭";
            counter += 1;
            ids.set(template, the_class);
        }
        Object.keys(parameters).sort().forEach(function (key) {
            const value = parameters[key];
            if (value !== undefined) {
                the_class += "·" + key + "→" + spoof(String(value));
            }
        });
        if (spec.intern === true) {
            if (interned[the_class] === undefined) {
                interned[the_class] = "f" + intern_counter;
                intern_counter += 1;
            }
            return interned[the_class];
        }
        return the_class;
    }

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
                remove: insert(fragment),
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
        }
    });
}

export default Object.freeze({rule, css, context, domsert});
