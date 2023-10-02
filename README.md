# Fstyle

_Fstyle_ is a JavaScript library that lets you parameterize fragments of
arbitrary CSS, compose them together, and use them to style web applications.
Unlike static CSS, _Fstyle_ promotes modularity and does not penalize dynamism.

Styles defined using _Fstyle_ are
[not tied](https://james.diacono.com.au/using_fstyle.html) to any particular
framework, so can be very portable. The rationale for _Fstyle_'s approach
is given in the blog post
[Styling Web Applications](https://james.diacono.com.au/styling_web_applications.html).

_Fstyle_ is in the Public Domain.

The following examples demonstrate how _Fstyle_ might be used to style a trivial
web application.

```javascript
import fstyle from "./fstyle.js";

// Two simple stylers are defined, each with a label and a template.

const button_styler = fstyle.rule("button", `
    border: 0.1em solid black;
    color: gold;
    background: fuchsia;
    padding: 1em;
`);

const centered_styler = fstyle.rule("centered", `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
`);

// These stylers a mixed together in a composite styler.

function centered_button_styler() {
    return [button_styler(), centered_styler()];
}

// A context is created. It is responsible for injecting CSS fragments into the
// page without duplication.

const context = fstyle.context();

// We "require" the composite styler, obtaining a handle object.

const handle = context.require(centered_button_styler());

// The handle's classes are assigned to an element.

const button = document.createElement("button");
button.textContent = "Fabulous";
button.classList.add(...handle.classes);
document.body.append(button);
```

The page now looks something like

```html
<head>
    <style>
        .f0⎧button⎭ {
            border: 0.1em solid black;
            color: black;
            background: fuchsia;
            padding: 1em;
        }
    </style>
    <style>
        .f1⎧centered⎭ {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    </style>
</head>
<body>
    <button class="f0⎧button⎭ f1⎧centered⎭">
        Fabulous
    </button>
</body>
```

_Fstyle_ ensures that classes produced by different stylers do not collide, even
in large applications. For example:

```javascript
const other_button_styler = fstyle.rule("button", "color: limegreen");
```

Even though `other_button_styler` was created with the same label as
`button_styler`, it produces the distinct class `f2⎧button⎭`. Within `context`,
there is an exact correspondence of `f0` to `button_styler`, and `f2` to
`other_button_styler`. The label is only included in the class to aid
debugging.

For _Fstyle_ to generate CSS without duplication, stylers should not be
recreated needlessly. For best results, do not call `fstyle.rule` or
`fstyle.fragment` within functions or loops.

Note that `f0⎧button⎭` is a valid class. _Fstyle_ places Unicode characters in
classes to make them easier to read. This becomes especially important when
stylers are parameterized.

The following styler takes two optional parameters, `enabled` and `selected`.
Its `data` function transforms the parameters into values for the template.

```javascript
const tabber_styler = fstyle.rule(
    "tabber",
    `
        color: <color>;
        border: 2px solid <color>;
        border-radius: 6px;
        padding: 0.5em;
        background: <background>;
        opacity: <opacity>;
    `,
    function data({
        disabled = false,
        selected = false
    }) {
        return {
            background: "black",
            color: (
                selected
                ? "yellow"
                : "white"
            ),
            opacity: (
                disabled
                ? 0.4
                : 1
            )
        };
    }
);

const handle = context.require(tabber_styler({
    disabled: true,
    selected: true
}));

const tabber = document.createElement("div");
tabber.innerText = "My tabber";
tabber.classList.add(...handle.classes);
document.body.append(tabber);
```

The page might look something like

```html
<head>
    <style>
        .f3⎧tabber⎭·selected→true·disabled→true {
            color: yellow;
            border: 2px solid yellow;
            border-radius: 6px;
            padding: 0.5em;
            background: black;
            opacity: 0.4;
        }
    </style>
</head>
<body>
    <div class="f3⎧tabber⎭·selected→true·disabled→true">
        Tab me
    </div>
</body>
```

Yes, that is a still a valid class.

## Stylers

### styler(_parameters_) → requireable

A __styler__ is any function that returns a requireable and optionally takes a
_parameters_ object.

A __requireable__ is passed to `context.require` to inject zero or more
fragments of CSS onto the page. A requireable is either:

- an opaque value returned by a styler created using `fstyle.rule` or
  `fstyle.fragment`, or
- an array of requireables.

A styler can be wrapped in a function if its parameters need to be transformed
or predefined.

```javascript
function disabled_tabber_styler() {
    return tabber_styler({disabled: true});
}
```

Stylers can be mixed together by defining a function returning an array of
requireables. Notice how `spinning_link_styler` distributes its parameters to
the stylers within, and how the empty array `[]` represents the absence of
style.

```javascript
function spinning_link_styler({animating, color}) {
    return [
        (
            animating
            ? spinner_styler({color, duration: "500ms"})
            : []
        ),
        link_styler({color})
    ];
}
```

Stylers containing conflicting declarations should not be mixed. Attempting to
do so results in unpredictable behaviour.

```javascript
const red_styler = fstyle.rule("red", "color: red;");
const green_styler = fstyle.rule("green", "color: green;");

function bad_styler() {
    return [red_styler(), green_styler()];
}
```

## The functions

An object containing Fstyle's six functions is exported by fstyle.js:

```javascript
import fstyle from "./fstyle.js";
```

The `fstyle.rule` and `fstyle.fragment` functions are the most commonly used,
being the styler factories. The `fstyle.context` function is generally only
called once per application.

The `fstyle.development`, `fstyle.production`, and `fstyle.domsert` functions
offer additional control when configuring a context.

### fstyle.rule(_label_, _template_, _data_)

The __rule__ function makes a styler representing a single CSS ruleset.
The _label_ string is incorporated into the generated class to aid debugging.

Each placeholder in the _template_ will be replaced by a value, either a string
or a number. A placeholder takes the form `<name>`, where `name` is any
non-empty string devoid of whitespace.

```javascript
const link_styler = fstyle.rule("link", `
    font-weight: bold;
    color: <color>;
`);
```

The _template_ need not contain any placeholders. If it does have placeholders,
how they are filled depends on the _data_ parameter.

 _data_        | Behavior
---------------|----------------------------------------------------------------
 function      | The _data_ function is called with the parameters object and returns an object holding the values.
 object        | The _data_ object holds the values, and any parameters are ignored.
 undefined     | The parameters object holds the values.

An exception is raised if a placeholder can not be filled. This could be because
no matching value was found, or because the matching value is not a string or a
number.

The ruleset's class incorporates the names and values of the parameters. For
example, `link_styler` (from the previous example) might produce the following
CSS if `color` was `"red"`:

```css
.f4⎧link⎭·color→red {
    font-weight: bold;
    color: red;
}
```

Characters not permitted within a class are safely escaped.

### fstyle.fragment(_label_, _template_, _data_)

The __fragment__ function makes a styler representing an arbitrary fragment of
CSS. It processes the _template_ using the _data_ and parameters how
`fstyle.rule` does, but then replaces each occurrence of the empty placeholder
`<>` with the generated class.

In the following example, the generated class is used both to identify a ruleset
and an animation.

```javascript
const spinner_styler = fstyle.fragment(
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
```

Calling

```javascript
context.require(spinner_styler({color: "#a020f0", duration: "500ms"}))
```

might produce the following CSS:

```css
@keyframes f5⎧spinner⎭·color→＃a020f0·duration→500ms {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
.f5⎧spinner⎭·color→＃a020f0·duration→500ms {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 10px;
    border-top: 4px solid #a020f0;
    animation: f5⎧spinner⎭·color→＃a020f0·duration→500ms 500ms linear infinite;
}
```

### fstyle.context(_spec_)

The __context__ function makes a context object, which manages the insertion and
removal of CSS fragments without duplication. Generally, there should only be a
single context per application.

```javascript
const context = fstyle.context();
```

The _spec_ parameter, if provided, configures the context. It is an object
containing any of the following properties:

#### spec.classify

A function that generates a CSS class identifying a fragment of CSS.

If `spec.classify` is omitted, `fstyle.development()` is used.

#### spec.insert(_css_fragment_, _class_) → remove()

A function that takes a fragment of CSS as a string and inserts it into the
page. It also receives the _class_ associated with the fragment. It may return
a _remove_ function, called to remove the fragment from the page.

If `spec.insert` is omitted, `fstyle.domsert` is used.

The context object returned by `fstyle.context` has two methods.

#### context.require(_requireable_)

Guarantees that a styler's CSS remains available on the page until explicitly
released.

```javascript
const handle = context.require(link_styler());
```

The returned __handle__ is an object with the following properties:

- `classes`: An array of class strings. Apply these immediately to any elements
  that want styling.
- `release`: The releaser function.

If there comes a time when the handle is no longer needed, it can be released to
conserve resources.

```javascript
handle.release();
```

#### context.dispose()

The __dispose__ function releases the context's handles and renders it
inoperable.

```javascript
context.dispose();
```

### fstyle.development() → classifier
### fstyle.production () → classifier

The __development__ and __production__ functions return a _classifier_ function,
suitable for use as `spec.classify`.

```javascript
const context = fstyle.context({
    classify: fstyle.production()
});
```

The development classifier produces highly readable classes but has a slight
performance overhead. The production classifier produces less readable classes
but aims to be safer and faster.

### fstyle.domsert(_css_fragment_, _class_) → remove()

The __domsert__ function may be used in conjunction with `fstyle.context` when
the DOM is available. Each time it is called, a new style element is populated
with the _fragment_'s rules and inserted into the head of the current document.
It returns a _remove_ function that removes the style element.
