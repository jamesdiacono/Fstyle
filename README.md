# Fstyle

_Fstyle_ is a functional approach to styling web applications. _Fstyle_ lets you parameterise arbitrary CSS, which can improve the modularity of styles without sacrificing control. When _Fstyle_ is used in conjuction with a reactivity system, styles can be made to change dynamically.

_Fstyle_ is in the Public Domain.

_Fstyle_ specifies the signature of a special kind of function, called a __styler__. A styler returns an array of fragments.

A __fragment__ represents an aspect of the appearance or behaviour of a DOM element. Many different fragments may be applied to a single element, and a single fragment may be applied to many different elements. A fragment is an object containing two properties:

- `class`: A string consisting of a single CSS class name. A class must uniquely identify its rules.
- `rules`: A string containing some CSS source code which affects only those elements assigned the class.

A __factory__ is any function which returns a styler function. The `button` factory below demonstrates how factories, stylers and fragments work together.

    function button() {
        return function button_styler() {
            return [{
                class: "my_button",
                rules: `
                    .my_button {
                        border: 0.1em solid black;
                        color: black;
                        background: fuchsia;
                        padding: 1em;
                    }
                    .my_button:active {
                        background: cyan;
                    }
                `    
            }];
        };
    }

## A demonstration

The following example demonstrates how _Fstyle_ might be used in a trivial web application.

Firstly, a new context is created. The context is responsible for injecting CSS into the page.

    const require = fstyle.context();

A styler is made and "required", causing its fragments to be inserted into the page.

    const styler = button();
    const handle = require(styler);

The handle's classes are assigned to an element.

    const element = document.createElement("button");
    element.innerText = "Fabulous";
    element.className = handle.classes.join(" ");
    document.body.appendChild(element);

The page now contains the elements

    <style>
        .my_button {
            border: 0.1em solid black;
            color: black;
            background: fuchsia;
            padding: 1em;
        }
        .my_button:active {
            background: cyan;
        }
    </style>

and

    <button class="my_button">Fabulous</button>

## The functions

An object containing some useful functions is exported by fstyle.js:

    import fstyle from "./fstyle.js";

### fstyle.rule(_name_, _declarations_)

The __rule__ factory makes a styler representing a single CSS rule.

    function centered() {
        return fstyle.rule("centered", `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `);
    }

The styler will return an array containing a single fragment, consisting of the _declarations_ wrapped by the _name_.

    [{
        class: "centered",
        rules: `
            .centered {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
        `
    }]

It important to ensure that the _name_ parameter is unique, otherwise the classes of distinct fragments might collide. In a very small application this might not be a problem, but as an application grows, unique string generation gets complicated. It is possible to avoid some of this complexity by leveraging the uniqueness of object references.

When a function is passed as the _name_ parameter, it is not invoked. Rather, it is examined and a name string is derived. Incorporating the function's "name" property, as well as its object reference, this name string is both meaningful and unique. Whilst it is possible to pass any function (even an anonymous function), it is most convenient to pass the factory function itself:

    function centered_safe() {
        return fstyle.rule(centered_safe, `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `);
    }

Stylers returned by the `centered_safe` factory produce a fragment like

    {
        class: "u123_centered_safe",
        rules: `
            .u123_centered_safe {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
        `
    }

which is guaranteed to be unique within a given `fstyle.context` instance.

### fstyle.rule(_name_, _declarations_template_, _substitutions_, _parameters_)

Each placeholder found in the _declarations_template_ is replaced with a corresponding value taken from the _substitutions_. A placeholder has the form `<placeholder_name>`, where `placeholder_name` is any non-empty string devoid of whitespace.

    function link(color) {
        return fstyle.rule(
            "link",
            `
                font-weight: bold;
                color: <color>;
            `,
            {color}
        );
    }

If _substitutions_ is a function, it is called with the placeholder name and returns the replacement. Otherwise, _substitutions_ is an object with placeholder names as keys. Each value on the object is either the replacement, or a function which returns the replacement. A replacement must be a string or a number.

The `link` factory above can take a color string, yet it can also take a function which returns a color string. If `color` is a reactive function, this makes the styler reactive. Reactive stylers are discussed further in the "Reactivity" section below.

The _name_ parameter serves as a basis for the fragment's class. Each replacement used by the _declarations_template_ is appended, yielding a class which uniquely identifies the fragment. Calling

    link("red")

returns a styler which produces the fragment

    {
        class: "link_red",
        rules: `
            .link_red {
                font-weight: bold;
                color: red;
            }
        `
    }

Characters not permitted within a class are encoded. For example, `link("#aabbcc")` yields a fragment of class `"link_\\000023aabbcc"`.

The optional _parameters_ parameter provides more control over the class. It is an array whose elements are resolved and encoded before being appended to the _name_. This approach can improve the readability of classes in some situations, but care must be taken to ensure that they uniquely identify their rules.

### fstyle.fragment(_name_, _rules_template_, _substitutions_, _parameters_)

The __fragment__ factory makes a styler which returns an array containing a single fragment. It processes the _rules_template_ with the _substitutions_ similarly to how `fstyle.rule` does, and then replaces each occurrence of the empty placeholder `<>` with the generated class. The _substitutions_ parameter is optional.

    function spinner(color, duration) {
        return fstyle.fragment(
            "spinner",
            `
                @keyframes <> {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
                .<> {
                    display: block;
                    width: 20px;
                    height: 20px;
                    border-radius: 10px;
                    border-top: 4px solid <color>;
                    animation: <> <duration> linear infinite;
                }
            `,
            {color, duration}
        );
    }

### fstyle.mix(_styler_array_)

The __mix__ factory makes a styler which returns an array containing every fragment from every styler in the _styler_array_.

    function centered_link(color) {
        return fstyle.mix([
            centered(),
            link(color)
        ]);
    }

Stylers containing conflicting declarations should not be mixed. Attempting to do so yields unpredictable behaviour, and is usually an indication that a factory needs parameterising.

    function broken() {
        return fstyle.mix([
            fstyle.rule("red", "color: red;"),
            fstyle.rule("green", "color: green;")
        ]);
    }

### fstyle.none()

The __none__ factory makes a styler which returns an empty array.

    function maybe_centered() {
        return (
            Math.random() < 0.5
            ? centered()
            : fstyle.none()
        );
    }

### fstyle.resolve(_value_)

The __resolve__ function takes a _value_. If that _value_ is a function, then it is called to produce the return value. Otherwise, the _value_ is the return value.

In the following example, `fstyle.resolve` is used in a factory which does not care whether its `highlighted` parameter is a boolean, or a function which returns a boolean. The returned styler will be reactive if `highlighted` is reactive.

    function snippet(highlighted) {
        function background_color() {
            return (
                fstyle.resolve(highlighted)
                ? "magenta"
                : "transparent"
            );
        }
        return fstyle.rule(
            "snippet",
            `
                background-color: <background_color>;
                font-family: monospace;
            `,
            {background_color}
        );
    }

### fstyle.context(_inserter_, _identifier_) → requirer(_styler_)

The __context__ function creates a new context, which manages the insertion and removal of fragments without duplication. Fragments are considered equal if their "class" properties are equal. Generally, there should be a single context per application.

A __requirer__ function is returned, which takes a _styler_. When called, the requirer guarantees that the _styler_'s fragments remain available to the context until they are explicitly released.

    const require = fstyle.context();
    const handle = require(styler);

The returned __handle__ is an object with the following properties:

- `classes`: An array of strings. These are the classes of the styler's fragments.
- `release`: The releaser function.

If there comes a time when the _styler_ is no longer required, it should be released:

    handle.release();

An _inserter_ function may be provided, which takes a fragment and inserts it into the context. The _inserter_ may return a __remover__ function, which takes no arguments and removes the fragment from the context. If the _inserter_ is undefined, `fstyle.domsert` is used.

The _identifier_ function is responsible for transforming the _name_ parameter of `fstyle.rule` and `fstyle.fragment` into a name string. It is passed to each styler invoked by the requirer. If it is undefined, `fstyle.identify()` is used.

### fstyle.domsert(_fragment_) → remover()

The __domsert__ function may be used in conjunction with `fstyle.context` when the DOM is available. Each time it is called, a new style element is populated with the _fragment_'s rules and inserted into the head of the current document. It returns a remover function which removes the style element.

### fstyle.identify() → identifier(_name_)

The __identify__ function returns an identifier function which facilitates the behaviour described in the `fstyle.rule` section. Identifier functions are used with `fstyle.context`.

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

    const width_observer = new ResizeObserver(
        function on_resize(entries) {
            width_cell(entries[0].contentRect.width);
        }
    );
    width_observer.observe(element);

We define a factory which makes a reactive styler. The `responsive_styler` function is reactive because it accesses the `width_cell` when it is invoked. 

    function responsive() {
        const narrow_styler = narrow();
        const wide_styler = wide();
        return function responsive_styler(...args) {
            return (
                width_cell() > 640
                ? wide_styler(...args)
                : narrow_styler(...args)
            );
        };
    }
    const responsive_styler = responsive();

We register a watcher which restyles the element whenever its width changes.

    let handle;
    watch(function watcher() {
        if (handle !== undefined) {
            handle.release();
        }
        handle = require(responsive_styler);
        element.className = handle.classes.join(" ");
    });

The `watch` function knows to run the watcher every time `width_cell` changes. This is because, within the watcher, the call to `require` invokes `responsive_styler` and hence accesses `width_cell`.
