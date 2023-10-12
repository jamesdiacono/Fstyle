# Fstyle

_Fstyle_ is a JavaScript library that lets you parameterize fragments of
arbitrary CSS, compose them together, and use them to style web applications.
It is designed to be used in sizeable, highly dynamic web applications where
good modularity is crucial.

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

// Two primitive stylers are made by passing template functions to
// 'fstyle.rule'.

const button_styler = fstyle.rule(function button() {
    return `
        border: 0.1em solid black;
        color: gold;
        background: fuchsia;
        padding: 1em;
    `;
});

const centered_styler = fstyle.rule(function centered() {
    return `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    `;
});

// These stylers are mixed together to form a composite styler.

function centered_button_styler() {
    return [button_styler(), centered_styler()];
}

// A context is created. It is responsible for injecting CSS fragments into the
// page without duplication.

const context = fstyle.context();

// The composite styler is "required", producing a handle object.

const handle = context.require(centered_button_styler());

// The handle's classes are assigned to an element.

const button = document.createElement("button");
button.textContent = "Fabulous";
button.classList.add(...handle.classes);
document.body.append(button);
```

The page now looks something like this:

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

Note that `f0⎧button⎭` is a valid class. _Fstyle_ places Unicode characters in
classes to make them easier to read. (This becomes especially important when
stylers are parameterized.)

Notice how _Fstyle_ incorporates the names of the template functions, "button"
and "centered", into the classes. Even so, the context ensures that classes
produced by different stylers never collide. For example, suppose we create
another styler whose template function is also named "button":

```javascript
const other_button_styler = fstyle.rule(function button() {
    return "color: limegreen";
});
```

Rest assured that `other_button_styler` produces a distinct class, `f2⎧button⎭`.
That is because, within `context`, there is an exact correspondence of `f0` to
`button_styler`, and `f2` to `other_button_styler`. The name is only included
in the class to aid debugging.

For _Fstyle_ to generate CSS without duplication, stylers should not be
recreated needlessly. For best results, do not call `fstyle.rule` or
`fstyle.css` within functions or loops.

The following styler takes two parameters, `enabled` and `selected`. The
template function, `tabber`, transforms the parameters into CSS values that are
then used by the template.

```javascript
const tabber_styler = fstyle.rule(function tabber({disabled, selected}) {
    const background = "black";
    const color = (
        selected
        ? "yellow"
        : "white"
    );
    const opacity = (
        disabled
        ? 0.4
        : 1
    );
    return `
        color: ${color};
        border: 2px solid ${color};
        border-radius: 6px;
        padding: 0.5em;
        background: ${background};
        opacity: ${opacity};
    `;
});

const handle = context.require(
    tabber_styler({disabled: true, selected: true})
);

const tabber = document.createElement("div");
tabber.innerText = "Tab me";
tabber.classList.add(...handle.classes);
document.body.append(tabber);
```

The page might look something like this:

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

A __styler__ is any function that takes an optional _parameters_ object and
returns a requireable.

A __requireable__ is passed to `context.require` to inject zero or more
fragments of CSS onto the page. A requireable is either:

- an opaque value returned by a styler made by `fstyle.rule` or
  `fstyle.css`, or
- an array of requireables.

A styler can be wrapped in a function if its parameters need to be transformed
or predefined.

```javascript
function disabled_tabber_styler() {
    return tabber_styler({disabled: true});
}
```

Stylers can be mixed together by defining a function that returns an array of
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
const red_styler = fstyle.rule(function red() {
    return "color: red";
});
const green_styler = fstyle.rule(function green() {
    return "color: green";
});

function bad_styler() {
    return [red_styler(), green_styler()];
}
```

Instead of attempting to mix the unmixable, make a styler that takes a `color`
parameter.

```javascript
const good_styler = fstyle.rule(function good({color}) {
    return `color: ${color}`;
});
```

## The functions

An object containing four functions is exported by fstyle.js:

```javascript
import fstyle from "./fstyle.js";
const {rule, css, context, domsert} = fstyle;
```

The `fstyle.rule` and `fstyle.css` functions make stylers, and are the most
commonly used.
The `fstyle.context` function is generally called only once per application.
The `fstyle.domsert` function offers additional control when configuring a
context.

### fstyle.rule(_template_)

The __rule__ function makes a styler representing a single CSS ruleset.
The _template_ parameter is a function that takes a parameters object and
returns a string containing any number of CSS declarations.

```javascript
const link_styler = fstyle.rule(function link({color}) {
    return `
        font-weight: bold;
        color: ${color};
    `;
});
```

The ruleset's class incorporates the names and values of the parameters. For
example, `link_styler` might produce the following CSS if `color` was `"red"`:

```css
.f4⎧link⎭·color→red {
    font-weight: bold;
    color: red;
}
```

Characters not permitted within a class are safely escaped.

### fstyle.css(_template_)

The __css__ function makes a styler representing an arbitrary fragment of CSS.
The _template_ parameter is a function that takes a parameters object and
returns an arbitrary CSS string. Any instances of the placeholder `[]` in the
CSS string are replaced with the generated class.

In the following example, the generated class is used both to identify a set of
animation keyframes and a ruleset.

```javascript
const spinner_styler = fstyle.css(function spinner({color, duration}) {
    return `
        @keyframes [] {
            0% {
                transform: rotate(0deg);
            }
            100% {
                transform: rotate(360deg);
            }
        }
        .[] {
            display: block;
            width: 20px;
            height: 20px;
            border-radius: 10px;
            border-top: 4px solid ${color};
            animation: [] ${duration} linear infinite;
        }
    `;
});
```

Calling

```javascript
context.require(
    spinner_styler({color: "#a020f0", duration: "500ms"})
)
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

#### spec.insert(_fragment_) → remove()

A function that takes a fragment and inserts its CSS into the page. It may
return a _remove_ function, called to remove the fragment from the page.

The _fragment_ is an object like `{class, statements}`, where `class` is a CSS
class string and `statements` is a string containing CSS statements.

If `spec.insert` is undefined, `fstyle.domsert` is used.

#### spec.intern

A boolean indicating whether classes should be radically shortened.
Defaults to false.

Interning makes classes much shorter, but consumes additional memory for the
lifetime of the context. Use interning only in production scenarios where HTML
and CSS is being generated on the server and long classes would just waste
network bandwidth.

The context object returned by `fstyle.context` has two methods:

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

The __dispose__ function releases all of the context's handles and renders the
context inoperable.

```javascript
context.dispose();
```

### fstyle.domsert(_fragment_) → remove()

The __domsert__ function may be used in conjunction with `fstyle.context` when
the DOM is available. Each time it is called, a new style element is populated
with the _fragment_'s CSS and inserted into the head of the current document.
It returns a _remove_ function that removes the style element.
