# Fstyle

_Fstyle_ is a functional approach to styling web applications. It lets you structure your styles as modules, which can then be composed together. When _Fstyle_ is used in conjuction with a reactivity system, styles can be made to change dynamically. _Fstyle_ does not have a build step.

_Fstyle_ is in the Public Domain.

_Fstyle_ specifies the signature of a special kind of function, called a __styler__. A styler takes no arguments and returns an array of fragments.

A __fragment__ represents an aspect of the appearance or behaviour of a DOM element. Many different fragments may be applied to a single element, and a single fragment may be applied to many different elements. A fragment is an object containing two properties:

- `class`: A string consisting of a single CSS class name. A class must uniquely identify its rules.
- `rules`: A string containing some CSS source code which affects only those elements assigned the class.

A __factory__ is any function which returns a styler function.

## A demonstration

The following example demonstrates how _Fstyle_ might be used in a trivial web application.

Firstly, a new context is created. The context is responsible for injecting CSS into the page.

    const require = style.context();

The `style_button` function is a factory which styles lurid buttons. It has access to its very own unique class. It demonstrates how factories, stylers and fragments work together.

    const button_class = style.uniqify("button");
    function style_button() {
        return function button_styler() {
            return [{
                class: button_class,
                rules: `
                    .${button_class} {
                        border: 0.1em solid black;
                        color: black;
                        background: fuchsia;
                        padding: 1em;
                    }
                    .${button_class}:active {
                        background: cyan;
                    }
                `    
            }];
        };
    }

The factory returns a styler which is then "required", causing its fragments to be inserted into the page.

    const button_styler = style_button();
    require(button_styler);

The styler's classes are assigned to an element.

    const button_element = document.createElement("button");
    button_element.innerText = "Fabulous";
    button_element.className = style.classes(button_styler).join(" ");
    document.body.appendChild(button_element);

The page now contains the following two elements:

    <style>
        .u0_button {
            border: 0.1em solid black;
            color: black;
            background: fuchsia;
            padding: 1em;
        }
        .u0_button:active {
            background: cyan;
        }
    </style>

    <button class="u0_button">Fabulous</button>

Clearly, the button looks fabulous.

## The functions

An object containing some useful functions is exported by fstyle.js:

    import style from "./fstyle.js";

### style.uniqify(_name_)

The __uniqify__ function takes a meaningful _name_ string. It returns a string which incorporates _name_, yet is guaranteed to be unique. The returned string is a valid class only if _name_ is a valid class.

    style.uniqify("potato"); // "u1_potato"
    style.uniqify("potato"); // "u2_potato"

### style.rule(_class_, _declarations_)

The __rule__ factory makes a styler representing a single CSS rule. The styler will return an array containing a single fragment, consisting of the _declarations_ wrapped in a _class_ selector.

    const centered_class = style.uniqify("centered");
    function style_centered() {
        return style.rule(centered_class, `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `);
    }

### style.rule(_class_, _declarations_, _substitutions_)

Specifying the _substitutions_ parameter causes the _declarations_ to be interpreted as a template. Each placeholder found in _declarations_ is replaced with a value from _substitutions_. A placeholder takes the form `<my_placeholder_name>`. If _substitutions_ is a function, it is called with the placeholder name and returns the replacement. Otherwise, _substitutions_ is an object with placeholder names as keys and replacements as values.

    const link_name = style.uniqify("link");
    function style_link(color) {
        return style.rule(
            function link_class() {
                return link_name + "_" + style.encode(color);
            },
            `
                font-weight: bold;
                color: <color>;
            `,
            {color}
        );
    }

This approach reads a bit better than template literals, which were used earlier in the `style_button` factory. But more importantly, it allows the same factory to produce both reactive and non-reactive stylers. The `style_link` factory above can take a color string, yet it can also take a function which returns a color string. If `color` is a reactive function, this makes the styler reactive. Reactive stylers are discussed further in the "Reactivity" section below.

### style.fragment(_class_, _rules_)

The __fragment__ factory makes a styler which returns an array containing a single fragment.

    const spinner_name = style.uniqify("spinner");
    function style_spinner() {
        return style.fragment(spinner_name, `
            @keyframes ${spinner_name} {
                0% {
                    transform: rotate(0deg);
                }
                100% {
                    transform: rotate(360deg);
                }
            }
            .${spinner_name} {
                display: block;
                width: 20px;
                height: 20px;
                border-radius: 10px;
                border-top: 4px solid pink;
                animation: ${spinner_name} 1s linear infinite;
            }
        `);
    }

### style.fragment(_class_, _rules_, _substitutions_)

Specifying the _substitutions_ parameter causes the the _rules_ parameter to be interpreted as a template. See `style.rule`.

### style.mix(_styler_array_)

The __mix__ factory makes a styler which returns an array containing every fragment from every styler in the _styler_array_.

    function style_centered_link(color) {
        return style.mix([
            style_link(color),
            style_centered()
        ]);
    }

### style.none()

The __none__ factory makes a styler which returns an empty array.

    function style_maybe_centered() {
        return (
            Math.random() < 0.5
            ? style_centered()
            : style.none()
        );
    }

### style.resolve(_value_)

The __resolve__ function takes a _value_. If that _value_ is a function, then it is called to produce the return value. Otherwise, the _value_ is the return value.

In the following example, `resolve` is used in a factory which does not care whether its `highlighted` parameter is a boolean, or a function which returns a boolean. The returned styler will be reactive if `highlighted` is reactive.

    const snippet_name = style.uniqify("snippet");
    function style_snippet(highlighted) {
        function background_color() {
            return (
                style.resolve(highlighted)
                ? "magenta"
                : "transparent"
            );
        }
        return style.rule(
            function snippet_class() {
                return snippet_name + "_" + style.encode(background_color);
            },
            `
                background-color: <background_color>;
                font-family: monospace;
            `,
            {background_color}
        );
    }

### style.encode(_value_)

The __encode__ function resolves a _value_ and encodes it as a string which is safe to append to a CSS class name.

    style.encode("10%");          // "10\\000025"
    style.encode("lightskyblue"); // "lightskyblue"

Encoding is necessary because a fragment's "class" property doubles as its identifier. A class must therefore derive from the arguments passed to the factory which produced it, and these could contain characters not permitted within a class.

### style.classes(_styler_)

The __classes__ function invokes the _styler_ and returns an array containing the class of each fragment.

    style.classes(style_centered_button); // ["u0_button", "u3_centered"]

### style.context(_inserter_) → requirer(_styler_) → releaser()

The __context__ function creates a new context, which manages the insertion and removal of fragments without duplication. Fragments are considered equal if their "class" properties are equal.

A __requirer__ function is returned, which takes a _styler_. When called, the requirer guarantees that the _styler_'s fragments remain available to the context until the returned __releaser__ function is called.

    const require = style.context();
    const release = require(button_styler);

If there comes a time when the _styler_ is no longer required, it should be released:

    release();

An _inserter_ function may be provided, which takes a fragment and inserts it into the context. The _inserter_ may return a __remover__ function, which takes no arguments and removes the fragment from the context. If the _inserter_ is undefined, `style.domsert` is used.

### style.domsert(_fragment_) → remover()

The __domsert__ function may be used in conjunction with `style.context` when the DOM is available. Each time it is called, a new style element is populated with the _fragment_'s rules and inserted into the head of the current document. It returns a remover function which removes the style element.

## Reactivity

_Fstyle_ is compatible with any reactivity system. This will be demonstrated using a fictional reactivity library, consisting of two functions, `cell` and `watch`.

    const {cell, watch} = make_reactiveness();

In this example, we observe changes to an element's dimensions and restyle it accordingly. Firstly, we create an element and insert it into the DOM.

    const element = document.createElement("div");
    element.innerText = "My responsively styled element.";
    document.body.appendChild(element);

We create a cell to hold the element's width in pixels. A "cell" is a reactive function which, when called with no arguments, returns its inner value. When it is called with an argument the inner value is overwritten.

    const width_cell = cell();

We set up a `ResizeObserver`, which updates `width_cell` whenever the element is resized.

    const width_observer = new window.ResizeObserver(
        function on_resize(entries) {
            width_cell(entries[0].contentRect.width);
        }
    );
    width_observer.observe(element);

We define a factory which makes a reactive styler. The `responsive_styler` function is reactive because it accesses the `width_cell` when it is invoked. 

    function style_responsive() {
        const narrow_styler = style_narrow();
        const wide_styler = style_wide();
        return function responsive_styler() {
            return (
                width_cell() > 640
                ? wide_styler()
                : narrow_styler()
            );
        };
    }
    const responsive_styler = style_responsive();

We register a watcher which restyles the element whenever its width changes.

    let release;
    watch(function watcher() {
        if (release !== undefined) {
            release();
        }
        release = require(responsive_styler);
        element.className = style.classes(responsive_styler).join(" ");
    });

The `watch` function knows to run the watcher every time `width_cell` changes. This is because, within the watcher, the calls to `require` and `style.classes` both invoke `responsive_styler` and hence access `width_cell`.
