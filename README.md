Flow control library focused on readability, convenience & analytics.

# Introduction

Tired of...
- Entering into a new code base with no information? unknown execution paths?
- Juggling asynchronous operations with flow control optimization?
- Building a mock server because your upstream is often unstable or offline?

What if there exists a way to...
- Allow you to create a simple structure that clearly describes your application and/or business logic lifecycle?
- Promote sharing by offering deferred execution for all constructed flows?
- Automatically instrument analytics for all execution paths?

This is [`Mercy`](https://github.com/bmille29/mercy); A hybrid API between [`Async`](https://github.com/caolan/async) and [`Joi`](https://github.com/hapijs/joi)

# API

See the detailed [API Reference](https://github.com/bmille29/mercy/blob/master/API.md).


# Usage

Usage is a two steps process. First, a flow must be constructed:

```javascript
const echo = function (value, next) { return next(null, value); };

const flow1 = Mercy.flow(echo)              // series   - Rest () notation   
const flow2 = Mercy.flow([echo]);           // series   - Array [] notation  
const flow3 = Mercy.flow({ task_0: echo }); // parallel - Object {} notation
const flow4 = Mercy.flow({                 // auto (dependencies get injected via `...spread` operator)
    echo: echo,
    echoAgain: ['foo', echo]
});
```

Note that **mercy** flow objects are immutable which means every additional rule added (e.g. `.timeout(1000)`) will return a
new flow object.

Then the flow is executed:

```javascript
Mercy.execute(flow, (err, meta, data, next) => {

    // Your bits here
});

// Mercy Flows can directly call `flow.execute(data, callback)`.

flow.execute((err, meta, data, next) => {

    // Your bits here
});
```

When passing a non-type flow object, the module converts it internally to a flow() type equivalent:

```javascript
// The following is equivalent
const foo = (data, next) => { return next(null, data) };
const callback = (err, meta, data, result) => {

    console.log(result);    // result is [data object]
};

const flow1 = { foo };
const flow2 = Mercy.flow({ foo });

Mercy.execute(flow1, callback);
Mercy.execute(flow2, callback);
```


# Examples

## Building basic flows
```javascript
const Mercy = require('mercy');

const noop = function (data, next) { return next(); };
const echo = function (value, next) { return next(null, value); };
```

**Empty**
```javascript
const empty = Mercy.flow();
```

**Series**
```javascript
// Series automatically propagates a flow's input/output to proceeding task
let series = Mercy.flow(echo);               // Rest () notation   
let series = Mercy.flow([echo]);             // Array [] notation  
let series = Mercy.flow({ echo }).series();  // Object {} notation

Mercy.execute('foobar', series, (err, meta, data, result) => {

    console.log(meta);      // returns [object] - Current flow meta data (timers / analytics)
    console.log(data);      // returns [object] - Flow data object. Contains all flow & subflow information
    console.log(result);    // returns 'foobar'
});
```

**Parallel**
```javascript
// Parallel does not propagate flow's input.
// Similar to `auto()`, you must specify a `final()` task to select results.
const parallel = Mercy.flow({
    input: Mercy.input(),       // Pre-built convenience flow to get flow input attached to some key.
    echo: echo                  // Since input is not propagated, echo is executed with (data, next)
}).final((data, next) => {

    const result = [data.input.result, data.echo.result];
    return next(null, result);
});

Mercy.execute('foobar', parallel, (err, meta, data, result) => {

    console.log(result);    // returns ['foobar', [object]] - [object] is the data object
});
```

**Auto**
```javascript
// Auto does not propagate input. However, it does make use of dependency injection.
// Similar to `parallel()`, you must specify a `final()` task to select results.
const auto = Mercy.flow({
    input: Mercy.input(),       // Pre-built convenience flow to get flow input attached to a key.
    echo: ['input', echo]       // Here we use dependency injection, echo is executed with (value, next) where (value === data.input.result)
}).final((data, next) => {

    const result = [data.input.result, data.echo.result];
    return next(null, result);
});

Mercy.execute('foobar', auto, (err, meta, data, result) => {

    console.log(result);    // returns ['foobar', 'foobar']
});
```

## Test case usage

```javascript
const Mercy = require('mercy');


```
