<img align="right" width="220px" src="https://rawgithub.com/funkia/hareactive/master/logo.svg">

[![Build Status](https://travis-ci.org/funkia/hareactive.svg?branch=master)](https://travis-ci.org/funkia/hareactive)
[![codecov](https://img.shields.io/codecov/c/github/funkia/hareactive.svg)](https://codecov.io/gh/funkia/hareactive)
[![Gitter](https://img.shields.io/gitter/room/funkia/General.svg)](https://gitter.im/funkia/General)

# Hareactive

Hareactive is a purely functional reactive programming (FRP) library
for JavaScript and TypeScript. It is simple to use, powerful, and
performant.

## Key features

* Simple and precise semantics. This means that everything in the
  library can be understood based on a very simple mental model. This
  makes the library easy to use and free from surprises.
* Purely functional API.
* Based on classic FRP. This means that the library makes a
  distinction between behaviors and streams.
* Supports continuous time for expressive and efficient creation of
  time-dependent behavior.
* Integrates with declarative side-effects in a way that is pure,
  testable and uses FRP for powerful handling of asynchronous
  operations.
* Declarative testing. Hareactive programs are easy to test
  synchronously and declaratively.
* Great performance.

## Introduction

Hareactive is simple. It aims to have an API that is understandable
and easy to use. It does that by making a clear distinction between
semantics and implementation details. This means that the library
implements a very simple mental model. By understanding this
conceptual model the entire API can be understood.

This means that to you use Hareactive you do not have to worry about
things such as "lazy observables", "hot vs cold observables" and
"unicast vs multicast observables". These are all unfortunate concepts
that confuse people and make reactive libraries harder to use. In
Hareactive we consider such things implementation detail that users
should never have to think about.

Hareactive implements what is called classic FRP. This means that it
makes a distinction between two types of time dependent concepts. This
makes code written in Hareactive more precise and easier to
understand.

Hareactive is powerful. It features all the typical methods found in
other FRP libraries. But on top of that it comes with many unique
features that are rarely found elsewhere. For instance, continuous
time.

## Table of contents

* [Installation](#installation)
* [Conceptual overview](#conceptual-overview)
* [Tutorial/cookbook](#tutorial-cookbook)
* [API documentation](#api)
* [Contributing](#contributing)
* [Benchmark](#benchmark)

# Installation

Hareactive can be installed from npm. The package ships with both
CommonJS modules and ES6 modules

```
npm install @funkia/hareactive
```

## Conceptual overview

Hareactive contains four key concepts: Behavior, stream, future and
now. This section will describe each of these at conceptual level.

For a practical introduction into using Hareactive see the
[tutorial](#tutorial). Unless you're already familiar with classic FRP
you should at least read the sections on behavior, stream and now
before you dive into the tutorial.

### Behavior

A behavior is a value that changes over time. For instance, the
current position of the mouse or the value of an input field is a
behavior. Conceptually a behavior is a function from a point in time
to a value. A behavior always has a value at any given time.

Since a behavior is a function of time we can visualize it by plotting
it as a graph. The figure below shows two examples of behaviors. The
left behavior is what we call a _continuous_ behavior since it changes
infinitely often. The right behavior only changes at specific moments,
but it's still a function of time. Hareactive is implemented so that
both types of behavior can be represented efficiently.

![behavior figure](https://rawgit.com/funkia/hareactive/master/figures/behavior.svg)

It is important to understand that behaviors are not implemented as
functions. Although, in theory, they could be. All operations that
Hareactive offers on behaviors can be explained and defined based on
the understanding that a behavior is a function of time. It is a
mental model that can be used to understand the library.

### Stream

A `Stream` is a series of values that arrive over time. Conceptually
it is a list of values where each value is associated with a moment in
time.

An example could be a stream of keypresses that a user makes. Each
keypress happens at a specific moment in time and with a value
indicating which key was pressed.

Similarily to behaviors a stream can be visualized. But, in this case
we wont get a graph. Instead we will get some points in time. Each
point is called an _occurrence_. The value of an occurrence can be
anything. For instance, the figure to the left may represent a stream
of booleans where all the "low" stars represents an occurrence with
the value `false` and the "high" stars represents `true`.

![stream figure](https://rawgit.com/funkia/hareactive/master/figures/stream.svg)

The difference between a stream and a behavior is pretty clear when we
see them visually. A behavior has a value at all points in time where
a stream is a series of events that happens at specific moments in
time.

To understand why Hareactive features both behavior and stream you may
want to read the blog post [Behaviors and streams, why
both?](http://vindum.io/blog/behaviors-and-streams-why-both/).

### Future

A future is a _value_ associated with a certain point in _time_. For
instance, the result of an HTTP-request is a future since it occurs at
a specific time (when the response is received) and contains a value
(the response itself).

Future has much in common with JavaScript's Promises. However, it is
simpler. A future has no notion of resolution or rejection. That
is, a specific future can be understood simply as a time and a value.
Conceptually one can think of it as being implemented simply like
this.

```js
{time: 22, value: "Foo"}
```

The relationship between `Future` and `Stream` is the same as the
relationship between having a variable of a type and a variable that
is a list of that type. You wouldn't store a username as
`["username"]` because there is always exactly one username.

Similarly in Hareactive we don't use `Stream` to express the result of
a HTTP-request since a HTTP-request only delivers a response exactly
once. It is more precise to use a `Future` for things where there is
exactly one occurrence and `Stream` where there may be zero or more.

### Future, stream or behavior?

At first, the difference between the three things may be tricky to
understand. Especially if you're used to other libraries where all
three are represented as a single structure (maybe called "stream" or
"observable"). The key is to understand that the three types represent
things that are fundamentally different. And that expressing different
things with different structures is beneficial.

You could forget about future and use a stream where you'd otherwise
use a future. Because stream is more powerful than future. In the same
way you could always use arrays of values instead of just single
values. But you don't do that because `username = "foo"` expresses
that only one username exists whereas `username = ["foo"]` gives the
impression that a user can have more than one username. Similarly one
could forget about numbers and just use strings instead. But saying
`amount = 22` is obviously better than `amount = "22"` because it's
more precise.

This is how to figure out if a certain thing is a future, a stream or
a behavior:

1. Ask the question: "does the thing always have a current value?". If
   yes, you're done, the thing should be represented as a behavior.
2. Ask the question: "does the thing happen exactly once?". If yes,
   the thing should be represented as a future. If no, you should use
   a stream.

Below are some examples:

* The time remaining before an alarm goes off: The remaining time
  always have a current value, therefore it is a behavior.
* The moment where the alarm goes off: This has no current value. And
  since the alarm only goes off a single time this is a future.
* User clicking on a specific button: This has no notion of a current
  value. And the user may press the button more than once. Thus a
  stream is the proper representation.
* Whether or not a button is currently pressed: This always has a
  current value. The button is always either pressed or not pressed.
  This should be represented as a behavior.
* The tenth time a button is pressed: This happens once at a specific
  moment in time. Use a future.

### Now

`Now` represents a computation that should be run in the present
moment. Hence the name "now". `Now` is perhaps the most difficult
concept in Hareactive.

A value of type `Now` is a _description_ of something that we'd like
to do. Such a description can declare that it wants to do one of two
things.

* Get the current value of behavior. This is done with the `sample`
  function. Since a `Now`-computation will always be run in the
  present it is impossible to sample a behavior in the past.
* Describe side-effects. This is done with functions such as `perform`
  and `performStream`. With these functions we can describe things
  that should happen when a stream occurs.

Most Hareactive programs are bootstrapped by a `Now`-computation. That
is, they take the form.

```js
const main = ...

runNow(main);
```

`Now` is closely tied to the concept of stateful behaviors which is
the topic of the next section.

### How stateful behaviors work

A notorious problem in FRP is how to implement functions that return
behaviors or streams that depend on the past. Such behaviors or
streams are called "stateful"

For instance `scan` creates a behavior that accumulates values over
time. Clearly such a behavior depends on the past. Thus we say that
`scan` returns a stateful behavior.

Implementing stateful methods such as `scan` in a way that is both
intuitive to use, pure and memory safe is very tricky.

When implementing functions such as `scan` most reactive libraries in
JavaScript does one of these two things:

* Calling `scan` doesn't begin accumulating state at all. Only when
  someone starts observing the result of `scan` is state accumulated.
  This is very counter intuitive behavior.
* Calling `scan` starts accumulating state from when `scan` is called.
  This is pretty easy to understand. But it makes `scan` impure as it
  will not return the same behavior when called at different time.

To solve this problem Hareactive uses a solution invented by Atze van
der Ploeg and presented in his paper "Principled Practical FRP". His
brilliant idea gives Hareactive the best of both worlds. Intuitive
behavior and purity.

The solution means that some functions return a value that, compared
to what one might expect, is wrapped in an "extra" behavior. This
"behavior wrapping" is applied to all functions that return a result
that depends on the past. The before mentioned `scan`, for instance,
returns a value of type `Behavior<Behavior<A>>`.

Remember that a behavior is a value that depends on time. It is a
function from time. Therefore a behavior of a behavior is like a value
that depends on _two_ moments in time. This makes sense for `scan`
because the result of accumulating depends both on when we _start_
accumulating and where we are now.

To get rid of the extra layer of nesting we often use `sample`. The
`sample` function returns a `Now`-computation that asks for the
current value of a behavior. It has the type `(b: Behavior<A>) => Now<A>`. Using `sample` with `scan` looks like this.

```js
const count = sample(scan((acc, inc) => acc + inc, 0, incrementStream));
```

Here `count` has type `Now<Behavior<A>>` and it represents a
`Now`-computation that will start accumulating from the present
moment.

## Tutorial/cookbook

This cookbook will demonstrate how to use Hareactive. The examples
gradually increase in complexity. Reading from the top serves as an
tutorial about the library.

Please open an issue if anything is unclear from the explanations
given.

### General

#### How do I apply a function to the value inside a behavior?

You can use the `map` method. For instance, if you have a behavior of
a number you can square the number as follows. `map` returns a new
behavior with all values of the original behavior passed through the function:

```js
behaviorOfNumber.map((n) => n * n);
```

`map` is also available as a function instead of a method.

```js
map((n) => n * n, behaviorOfNumber);
```

#### Can I also apply a function to the occurrences in a stream?

Yes. Streams also have a `map` method.

```js
streamOfNumbers.map((n) => n * n);
```

The `map` function also works with streams.

```js
map((n) => n * n, streamOfNumbers);
```

#### If I have two streams how can I merge them into one with the occurrences from both?

This is done with the `combine` method or the `combine` function.

```js
combine(firstStream, secondStream);
```

You can similarly combine any number of streams:

```js
combine(firstStream, secondStream, thirdStream, etcStream);
```

#### How do I combine two behaviors?

Behaviors always have a current value. So to combine them you will
have to specify how to turn the two values from the two behaviors into
a single value. You do that with the `lift` function.

For instance, if you have two behaviors of numbers you can combine
them by adding their values together.

```js
lift((n, m) => n + m, behaviorN, behaviorM);
```

You can also combine in this fashion any number of behaviors,
which has to match the number of the function arguments:

```js
lift((n, m, q) => (n + m) / q, behaviorN, behaviorM, behaviorQ);
```

#### How do I turn a stream into a behavior?

You probably want `stepper`:

```js
const b = stepper(initial, stream);
```

### Creating behaviors and streams

#### Can I create a stream from events on a DOM element?

We've though of that. Hareactive comes with a function for doing just
that:

```js
streamFromEvent(domElement, "click");
```

#### Can I turn an item in `localStorage` into a behavior?

Definitely. Yes. `fromFunction` takes an impure function and turns it
into a behavior whose value at any time is equal to what the impure
function would return at that time:

```js
const localStorageBehavior = fromFunction(() => localStorage.getItem("foobar"));
```

### Debugging

#### My program isn't working. Is there an easy way to check what is going on in my behaviors or streams?

Both streams and behaviors have a `log` method that logs to the
console when something happens.

```js
misbehavingStream.log();
```

## API

### Future

#### `Future#listen(o: Consumer<A>): void`

Adds a consumer as listener to a future. If the future has already
occurred the consumer is immediately pushed to.

#### `fromPromise<A>(p: Promise<A>): Future<A>`

Converts a promise to a future.

### Stream

#### `apply<A, B>(behavior: Behavior<(a: A) => B>, stream: Stream<A>): Stream<B>`

Applies a function-valued behavior to a stream. Whenever the stream
has an occurrence the value is passed through the current function of
the behavior.

#### `filter<A>(predicate: (a: A) => boolean, s: Stream<A>): Stream<A>`

Returns a stream with all the occurrences from `s` for which
`predicate` returns `true`.

```js
const stream = testStreamFromArray([1, 3, 2, 4, 1]);
const filtered = stream.filter((n) => n > 2);
filtered.semantic(); //=> [{ time: 1, value: 3 }, { time: 3, value: 4 }]
```

#### `split<A>(predicate: (a: A) => boolean, stream: Stream<A>): [Stream<A>, Stream<A>]`

Returns a pair of streams. The first contains all occurrences from
`stream` for which `predicate` returns `true` and the other the
occurrences for which `predicate` returns `false`.

```js
const whereTrue = stream.filter(predicate);
const whereFalse = stream.filter((v) => !predicate(v));
// is equivalent to
const [whereTrue, whereFalse] = split(predicate, stream);
```

#### `filterApply<A>(predicate: Behavior<(a: A) => boolean>, stream: Stream<A>): Stream<A>`

Filters a stream by applying the predicate-valued behavior to all
occurrences.

#### `keepWhen<A>(stream: Stream<A>, behavior: Behavior<boolean>): Stream<A>`

Whenever `stream` has an occurrence the current value of `behavior` is
considered. If it is `true` then the returned stream also has the
occurrence—otherwise it doesn't. The behavior works as a filter that
decides whether or not values are let through.

#### `scanS<A, B>(fn: (a: A, b: B) => B, startingValue: B, stream: Stream<A>): Behavior<Stream<B>>`

A stateful scan.

#### `snapshot<B>(b: Behavior<B>, s: Stream<any>): Stream<B>`

Creates a streams that occurs exactly when `s` occurs. Every time the
stream `s` has an occurrence the current value of `b` is sampled. The
value in the occurrence is then replaced with the sampled value.

```js
const stream = testStreamFromObject({
  1: 0,
  4: 0,
  8: 0,
  12: 0
});
const shot = snapshot(time, stream);
const result = testStreamFromObject({
  1: 1,
  4: 4,
  8: 8,
  12: 12
});
// short == result
```

#### `snapshotWith<A, B, C>(f: (a: A, b: B) => C, b: Behavior<B>, s: Stream<A>): Stream<C>`

Returns a stream that occurs whenever `s` occurs. At each occurrence
the value from `s` and the value from `b` is passed to `f` and the
return value is the value of the returned streams occurrence.

#### `switchStream<A>(b: Behavior<Stream<A>>): Stream<A>`

Takes a stream valued behavior and returns a stream that emits values
from the current stream at the behavior. I.e. the returned stream
always "switches" to the current stream at the behavior.

#### `changes<A>(b: Behavior<A>): Stream<A>`

Takes a behavior and returns a stream that has an occurrence whenever
the behavior changes.

#### `combine<A, B>(a: Stream<A>, b: Stream<B>): Stream<(A|B)>`

Combines two streams into a single stream that contains the
occurrences of both `a` and `b` sorted by the time of their
occurrences. If two occurrences happens at the exactly same time then
the occurrence from `a` comes first.

```js
const s1 = testStreamFromObject({ 0: "#1", 2: "#3" });
const s2 = testStreamFromObject({ 1: "#2", 2: "#4", 3: "#5" });
const combined = combine(s1, s2);
assert.deepEqual(combined.semantic(), [
  { time: 0, value: "#1" },
  { time: 1, value: "#2" },
  { time: 2, value: "#3" },
  { time: 2, value: "#4" },
  { time: 3, value: "#5" }
]);
```

#### `isStream(obj: any): boolean`

Returns `true` if `obj` is a stream and `false` otherwise.

```js
isStream(empty); //=> true
isStream(12); //=> false
```

#### `delay<A>(ms: number, s: Stream<A>): Stream<A>`

Returns a stream that occurs `ms` milliseconds after `s` occurs.

#### `throttle<A>(ms: number, s: Stream<A>): Stream<A>`

Returns a stream that after occurring, ignores the next occurrences in
`ms` milliseconds.

### Behavior

#### `when(b: Behavior<boolean>): Behavior<Future<{}>>`

Takes a boolean valued behavior an returns a behavior that at any
point in time contains a future that occurs in the next moment where
`b` is `true`.

#### `snapshot<A>(b: Behavior<A>, f: Future<any>): Behavior<Future<A>>`

Creates a future than on occurence samples the current value of the
behavior and occurs with that value. That is, the original value of
the future is overwritten with the behavior value at the time when the
future occurs.

#### `switchTo<A>(init: Behavior<A>, next: Future<Behavior<A>>): Behavior<A>`

Creates a new behavior that acts exactly like `initial` until `next`
occurs after which it acts like the behavior it contains.

#### `switcher<A>(init: Behavior<A>, s: Stream<Behavior<A>>): Behavior<Behavior<A>>`

A behavior of a behavior that switches to the latest behavior from `s`.

#### `stepper<B>(initial: B, steps: Stream<B>): Behavior<B>`

Creates a behavior whose value is the last occurrence in the stream.

#### `scan<A, B>(fn: (a: A, b: B) => B, init: B, source: Stream<A>): Behavior<Behavior<B>>`

The returned behavior initially has the initial value, on each
occurrence in `source` the function is applied to the current value of
the behaviour and the value of the occurrence, the returned value
becomes the next value of the behavior.

#### `fromFunction<B>(fn: () => B): Behavior<B>`

This takes an impure function that varies over time and returns a
pull-driven behavior. This is particularly useful if the function is
contionusly changing, like `Date.now`.

#### `isBehavior(b: any): b is Behavior<any>`

Returns `true` if `b` is a behavior and `false` otherwise.

#### `time: Behavior<Time>`

A behavior whose value is the number of milliseconds elapsed win UNIX
epoch. I.e. its current value is equal to the value got by calling
`Date.now`.

#### `timeFrom: Behavior<Behavior<Time>>`

A behavior giving access to continous time. When sampled the outer
behavior gives a behavior with values that contain the difference
between the current sample time and the time at which the outer
behavior was sampled.

#### `integrate(behavior: Behavior<number>): Behavior<Behavior<number>>`

Integrate behavior with respect to time.

### Now

The Now monad represents a computation that takes place in a given
moment and where the moment will always be now when the computation is
run.

#### `async<A>(comp: IO<A>): Now<Future<A>>`

Run an asynchronous IO action and return a future in the Now monad
that resolves with the eventual result of the IO action once it
completes. This function is what allows the Now monad to execute
imperative actions in a way that is pure and integrated with FRP.

#### `sample<A>(b: Behavior<A>): Now<A>`

Returns the current value of a behavior in the Now monad. This is
possible because computations in the Now monad have an associated
point in time.

#### `performStream<A>(s: Stream<IO<A>>): Now<Stream<A>>`

Takes a stream of `IO` actions and return a stream in a now
computation. When run the now computation executes each `IO` action
and delivers their result into the created stream.

#### `performStreamLatest<A>(s: Stream<IO<A>>): Now<Stream<A>>`

A variant of `performStream` where outdated `IO` results are ignored.

#### `performStreamOrdered<A>(s: Stream<IO<A>>): Now<Stream<A>>`

A variant of `performStream` where `IO` results occur in the same order.

#### `plan<A>(future: Future<Now<A>>): Now<Future<A>>`

Convert a future now computation into a now computation of a future.
This function is what allows a Now-computation to reach beyond the
current moment that it is running in.

#### `runNow<A>(now: Now<Future<A>>): Promise<A>`

Run the given Now-computation. The returned promise resolves once the
future that is the result of running the now computation occurs. This
is an impure function and should not be used in normal application
code.

## Contributing

Contributions are very welcome. Development happens as follows:

Install dependencies.

```
npm install
```

Run tests.

```
npm test
```

Running the tests will generate an HTML coverage report in `./coverage/`.

Continuously run the tests with

```
npm run test-watch
```

We also use `tslint` for ensuring a coherent code-style.

## Benchmark

Get set up to running the benchmarks:

```
npm run build
./benchmark/prepare-benchmarks.sh
```

Run all benchmarks with:

```
npm run bench
```

Run a single benchmark with:

```
node benchmark/<name-of-benchmark>
```

For example

```
node benchmark/scan.suite
```
