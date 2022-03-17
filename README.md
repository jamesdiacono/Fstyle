# Fstyle

_Fstyle_ is a functional approach to styling web applications. _Fstyle_ lets you parameterise arbitrary CSS, improving modularity without sacrificing control. When _Fstyle_ is used in conjuction with a reactivity system, styles can <a href="https://james.diacono.com.au/using_fstyle.html">change dynamically</a>.

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
    const {
        rule,
        fragment,
        mix,
        none,
        context,
        domsert,
        identiref
    } = fstyle;

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

### fstyle.rule(_name_, _declarations_, _substitutions_, _parameters_)

Each placeholder found in the _declarations_ is replaced with a corresponding value taken from the _substitutions_. A placeholder has the form `<placeholder_name>`, where `placeholder_name` is any non-empty string devoid of whitespace.

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

If _substitutions_ is a function, it is called with the placeholder name and returns the replacement. Otherwise, _substitutions_ is an object with placeholder names as keys, whose values are resolved to yield replacements. A replacement must be a string or a number.

The _name_ parameter serves as the basis for the fragment's class. Each replacement used by the _declarations_ is appended, yielding a class which uniquely identifies the fragment. Calling

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

Characters not permitted within a class are encoded. For example, `link("#aabbcc")` yields the class `"link_\\000023aabbcc"`.

The optional _parameters_ parameter provides more control over the class. It is an array whose elements are resolved and encoded before being appended to the _name_. This approach can improve the readability of classes in some situations, but care must be taken to ensure that they uniquely identify their rules.

### fstyle.fragment(_name_, _rules_, _substitutions_, _parameters_)

The __fragment__ factory makes a styler which returns an array containing a single fragment. It processes the _rules_ with the _substitutions_ similarly to how `fstyle.rule` does, and then replaces each occurrence of the empty placeholder `<>` with the generated class. The _substitutions_ and _parameters_ parameters are optional.

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

Stylers containing conflicting declarations should not be mixed. Attempting to do so results in unpredictable behaviour.

    function sometimes_red_sometimes_green() {
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

### fstyle.context(_capabilities_) → requirer(_styler_)

The __context__ function creates a new context, which manages the insertion and removal of fragments without duplication. Fragments are considered equal if their "class" properties are equal. Generally, there should be a single context per application.

A _requirer_ function is returned, which takes a _styler_. When called, the _requirer_ guarantees that the _styler_'s fragments remain available to the context until they are explicitly released.

    const require = fstyle.context();
    const handle = require(styler);

The returned __handle__ is an object with the following properties:

- `classes`: An array of strings. These are the classes of the styler's fragments.
- `release`: The releaser function.

If there comes a time when the _styler_ is no longer required, it should be released:

    handle.release();

The _capabilities_ parameter, if defined, should be an object containing any of the following capability functions:

#### capabilities.insert(_fragment_) → remover()

The __insert__ capability takes a fragment and inserts it into the context. It may return a _remover_ function, which removes the fragment from the context. If this capability is omitted, `fstyle.domsert` is used.

#### capabilities.identify(_name_)

The __identify__ capability transforms the _name_ parameter of `fstyle.rule` and `fstyle.fragment` into a name string. If this capability is omitted, an identifier function made by `fstyle.identiref` is used.

#### capabilities.resolve(_value_)

The __resolve__ capability is applied to members of the _substitutions_ and _parameters_ parameters (of `fstyle.rule` and `fstyle.fragment`). It "unwraps" and returns the _value_ if it is reactive, otherwise the _value_ is returned directly. This capability is used in conjunction with the built-in resolver.

The built-in resolver expects reactive values to be represented as functions. A function is unwrapped by invoking it, with the top-level resolver function itself passed as the only argument. This makes it possible to compose reactive values whilst remaining indifferent to their representation.

    function snippet(highlighted) {
        function background_color(resolve) {
            return (
                resolve(highlighted)
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

The `snippet` factory does not care whether its `highlighted` parameter is a boolean, or represents a boolean. The returned styler will be reactive if `highlighted` is reactive. As another example, the `if_else` factory is a control structure for stylers. It can take a reactive `condition` parameter.

    function if_else(condition, if_styler, else_styler) {
        return function if_else_styler(resolve, ...rest) {
            return (
                resolve(condition)
                ? if_styler(resolve, ...rest)
                : else_styler(resolve, ...rest)
            );
        };
    }

Factories written in this way are portable across different reactivity systems.

### fstyle.domsert(_fragment_) → remover()

The __domsert__ function may be used in conjunction with `fstyle.context` when the DOM is available. Each time it is called, a new style element is populated with the _fragment_'s rules and inserted into the head of the current document. It returns a _remover_ function which removes the style element.

### fstyle.identiref() → identifier(_name_)

The __identiref__ function returns an _identifier_ function which takes a string or function as the _name_ parameter and returns a string. This _identifier_ provides the default behaviour when `capabilities.identify` is undefined.

It is important to ensure that the _name_ parameter passed to `fstyle.rule` and `fstyle.fragment` is unique, otherwise the classes of unrelated stylers might collide. It is tricky to ensure the uniqueness of _name_ strings across a large application, but the uniqueness of object references is guaranteed.

When a function is passed as the _name_ parameter, it is not invoked. Rather, it is examined and a name string is derived. This name string is both meaningful and unique because it incorporates the function's object reference as well as its "name" property. Whilst it is possible to pass any function (even an anonymous function), it is most convenient to pass the factory function itself:

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

which has a class guaranteed to be unique within a given _Fstyle_ context.

## Reactivity

_Fstyle_ is compatible with any reactivity system. This will be demonstrated using a fictional reactivity library, consisting of two functions, `cell` and `watch`.

    const {cell, watch} = make_reactiveness();

In this example, we observe changes to an element's dimensions and restyle it accordingly. Firstly, we create an element and insert it into the DOM.

    const element = document.createElement("div");
    element.innerText = "My responsively styled element.";
    document.body.appendChild(element);

We create a cell to hold the element's width in pixels. A "cell" is an object with reactive `read` and `write` methods.

    const width = cell();

We set up a `ResizeObserver`, which updates `width` whenever the element is resized.

    const width_observer = new ResizeObserver(
        function on_resize(entries) {
            width.write(entries[0].contentRect.width);
        }
    );
    width_observer.observe(element);

We define a factory which makes a reactive styler. The `responsive_styler` function is reactive because it accesses `width` when it is invoked.

    function responsive() {
        const narrow_styler = narrow();
        const wide_styler = wide();
        return function responsive_styler(...args) {
            return (
                width.read() > 640
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

The `watch` function knows to run the watcher every time `width` changes. This is because, within the watcher, the call to `require` invokes `responsive_styler` and hence accesses `width`.
