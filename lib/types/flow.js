'use strict';

// Load modules

const Async = require('async');
const Hoek = require('hoek');
const Joi = require('joi');
const Nock = require('nock');
const Os = require('os');
const Path = require('path');
const Purdy = require('purdy');

const Any = require('./any');
const Timer = require('../timer');
const Tree = require('../tree');

let Reach = null;       // Delay-load to prevent circular dependencies
let Transform = null;   // Delay-load to prevent circular dependencies


// Declare internals

const internals = {
    final: {
        /* eslint-disable brace-style, hapi/hapi-scope-start */
        null: (last, next) => { return next(null, last); },
        auto: (data, next) => { return next(null, null); },
        parallel: (data, next) => { return next(null, null); },
        series: (data, next) => { return next(null, null); },
        waterfall: (last, next) => { return next(null, last); }
        /* eslint-enable brace-style, hapi/hapi-scope-start */
    },
    schema: Joi.array().single().items([
        Joi.func(),
        Joi.object(),
        Joi.array().items(Joi.lazy(() => internals.schema))
    ])
};


module.exports = internals.Flow = class extends Any {

    constructor(...args) {

        super();

        this._type = 'flow';
        this._style = null;     // [series, waterfall, parallel, auto]
        this._children = [];    // [{ label, depends, task }] where task is (Mercy Obj) OR (function IFF length(1))
        this._final = null;     // Final function in flow lifecycle. Defaults based on `style`.
        this._settings = {
            mock: null,         // { mode, local, label, dir }
            optional: false,    // Errors are ignored and returned as flow result
            retry: null,        // Same as Async.retry()
            skip: false,
            timeout: 0,         // Flow timeout setting. Timers Propagate to children.
            wait: 0             // Wait period before continuing flow. Occurs prior to setting flow timeout.
        };

        return args.length ? this.tasks(...args) : this;
    }

    clone() {

        const flow = Object.create(Object.getPrototypeOf(this));

        flow._isMercy = true;
        flow._type = this._type;
        flow._style = this._style;
        flow._settings = Hoek.clone(this._settings);
        flow._children = this._children.slice();
        flow._final = this._final;

        return flow;
    }

    clear() {

        const flow = this.clone();
        flow._children = [];

        return flow;
    }

    tasks(...args) {

        const input = (args.length === 1) ? args.pop() : args;

        const result = Joi.validate(input, internals.schema);
        Hoek.assert(!result.error, result.error && result.error.annotate());

        const tasks = (result.value.length === 1) ? result.value.pop() : result.value;

        // Base Case [Mercy Object]
        if (tasks._isMercy) {
            return tasks;
        }

        // Copy existing flow as our new base
        // Clear any previously existing children
        const flow = this.clear();

        // Base Case [Empty]
        if (!tasks) {
            return flow;
        }

        // Base Case [Function]
        if (typeof tasks === 'function') {
            const label = tasks.name || null;
            const depends = [];
            const task = tasks;

            flow._children.push({ label, depends, task });

            return flow;
        }

        // Iterate Array; Recurse when necessary.
        if (Array.isArray(tasks)) {
            for (let i = 0; i < tasks.length; ++i) {
                const label = null;
                const depends = [];
                const task = new internals.Flow(tasks[i]);

                flow._children.push({ label, depends, task });
            }

            return flow;
        }

        // Iterate Object; Recurse when necessary.
        if (typeof tasks === 'object') {
            flow._style = flow._style || 'parallel';

            for (const key in tasks) {
                if (tasks.hasOwnProperty(key)) {
                    const item = tasks[key];
                    const value = Array.isArray(item) ? item : [item];

                    const label = key;
                    const depends = (value.length > 1) ? value.slice(0, -1) : [];
                    const task = new internals.Flow(value.slice(-1).pop());

                    flow._children.push({ label, depends, task });
                }
            }

            for (let i = 0; i < flow._children.length; ++i) {
                const child = flow._children[i];

                if (child.depends.length) {
                    flow._style = 'auto';
                }
            }

            return flow;
        }
    }

    execute(...args) {

        const tasks = [];
        const callback = Hoek.once(args.pop());

        // if (this.settings._skip) {
        //     return callback(null, { data, result });
        // }

        // _meta - default always
        const pre = ['_meta'];
        const _meta = (next) => {

            const meta = {
                bench: { start: new Hoek.Bench(), end: null, duration: null },
                timer: { start: new Hoek.Timer(), end: null, duration: null },
                settings: this._settings
            };

            return next(null, meta);
        };

        tasks.push({ _meta });

        // _wait - Mercy.flow().wait()
        if (this._settings.wait) {
            const _wait = (data, next) => {

                setTimeout(() => {

                    return next(null, this._settings.wait);
                }, this._settings.wait);
            };

            tasks.push({ _wait: [...pre, _wait] });
            pre.push('_wait');
        }

        // _timeout - Mercy.flow().timeout()
        if (this._settings.timeout) {

            const _timeout = (data, next) => {

                const timeout = this._settings.timeout;
                const obj = (typeof timeout === 'object');
                const duration = obj ? timeout.remaining() : timeout;

                const timer = obj ? timeout : new Timer(() => {

                    // Mercy.optional()
                    const optional = this._settings.optional;

                    if (!optional) {
                        const err = new Error(`Flow timeout of ${duration}(ms) occurred`);
                        return callback(err, { meta: data._meta, data, result: err });
                    }
                }, duration);

                return next(null, { duration, timer });
            };

            tasks.push({ _timeout: [...pre, _timeout] });
            pre.push('_timeout');
        }

        // _mock - Mercy.flow().mock()
        if (this._settings.mock) {
            const _mock = (data, next) => {

                const nockback = Nock.back;
                const { mode, local, fixture, loader, recorder } = this._settings.mock;
                const path = Path.parse(fixture);

                nockback.setMode(mode);
                nockback.fixtures = path.dir;

                const localhosts = internals.localhosts();
                const ports = Array.isArray(local) ? local : [];

                const rxp = ports.length ? `:(${ports.join('|')})` : '';
                const nrxp = ports.length ? `:(?!${ports.join('|')})` : '';
                const rxlh = `(${localhosts.join('|')})`;
                const rxnet = new RegExp(`${rxlh}${rxp}`);
                const nrxnet = new RegExp(`${rxlh}${nrxp}`);
                // console.log({ rxnet });
                // console.log({ nrxnet });

                const options = {
                    before: (scope) => {

                        // Scope is each individual, raw fixture value
                        // console.log(Object.keys(scope))
                        // [ 'scope', 'method', 'path', 'body', 'status', 'response', 'rawHeaders' ]

                        // Automatically wildcard (ignore) common path params
                        const regex = [
                            [/(\d{1,3}\.){3}\d{1,3}/g, '{{_wildcard}}'],
                            [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '{{_wildcard}}'],
                        ];

                        const result = [scope.path, ...regex].reduce((a, c) => { return c ? a.replace(...c) : a; });
                        const rx = Hoek.escapeRegex(result);
                        const wildcard = Hoek.escapeRegex('{{_wildcard}}')
                        scope.path = new RegExp(rx.replace(wildcard, '.*'));
                    },
                    after: (scope) => {

                        // console.log({scope})
                        // Scope contains the following
                        // [ 'domain', '_events', '_eventsCount', '_maxListeners', 'keyedInterceptors', 'interceptors', 'transformPathFunction', 'transformRequestBodyFunction', 'matchHeaders', 'logger', 'scopeOptions', 'urlParts', '_persist', 'contentLen', 'date', 'basePath', 'basePathname', 'port' ]

                        // Automatically ignore (do not match) request body
                        scope.transformRequestBodyFunction = (body, reqBody) => {

                            // console.log('transformRequestBodyFunction');
                            // console.log({ body, reqBody });
                            // console.log();

                            return reqBody;
                        };

                        // console.log(scope)
                        // Execute any provided after function (For post load modification of fixture)
                        const mod = loader.after && loader.after(scope);
                        scope = mod || scope;
                    },
                    afterRecord: (scopes) => {

                        // console.log('afterRecord');
                        // console.log(nockback);
                        // console.log({ mode, local, fixture });
                        // console.log();

                        return scopes.filter((s) => {

                            return local ? rxnet.test(s.scope) : !rxnet.test(s.scope);
                        });
                    }
                };

                nockback(path.base, options, function (done) {

                    // console.log('nockback');
                    // console.log(nockback);
                    // console.log({ mode, local, fixture });

                    if (!local) {
                        Nock.enableNetConnect(rxnet);
                    }

                    if (Array.isArray(local)) {
                        Nock.enableNetConnect(nrxnet);
                    }

                    return next(null, { mode, local, fixture, done });
                });
            };

            tasks.push({ _mock: [...pre, _mock] });
            pre.push('_mock');
        }

        // _input - Mercy.input()
        /* eslint-disable brace-style, hapi/hapi-scope-start */
        tasks.push({ _input: [...pre, (data, next) => { return next(null, [...args]); }] });
        pre.push('_input');
        /* eslint-enable brace-style, hapi/hapi-scope-start */

        // Add flow tasks
        const series = Hoek.contain([null, 'series', 'waterfall'], this._style, { part: true });
        const autoinject = (this._style === null || this._style === 'waterfall');

        for (let i = 0; i < this._children.length; ++i) {
            const child = this._children[i];

            // Mercy.input() - Autoinject `_input`
            // Mercy.waterfall() - Waterfall flow's automatically cascade input/output
            // Here, for dev convenience, we automatically set dependencies and injection
            const input = (child.task._type === 'input' && !child.depends.length) ? ['_input'] : [];

            const last = series ? [Object.keys(tasks.slice(-1).pop()).pop()] : [];

            const label = child.label || `task_${i}`;
            const depends = series ? Hoek.unique([...pre, ...last]) : Hoek.unique([...pre, ...input, ...child.depends]);
            const inject = autoinject ? Hoek.unique([...last, ...input]) : [...input, ...child.depends];

            const task = {};

            task[`${label}`] = [...depends, internals.wrap(inject, child.task)];

            tasks.push(task);
        }

        // Transform to async tasks
        /* eslint-disable brace-style, hapi/hapi-scope-start */
        const build = [{}, ...tasks].reduce((acc, cur) => { return Hoek.merge(acc, cur); });
        /* eslint-enable brace-style, hapi/hapi-scope-start */

        // Add _final async task
        const last = Object.keys(tasks.slice(-1).pop()).pop();
        const depends = series ? Hoek.unique([...pre, last]) : Object.keys(build);
        const inject = autoinject ? [last] : [];

        // _final - Mercy.flow().final()
        /* eslint-disable brace-style, hapi/hapi-scope-start */
        build._final = [...depends, internals.wrap(inject, this._final || internals.final[this._style])];
        /* eslint-enable brace-style, hapi/hapi-scope-start */

        // console.log({type: this._type});
        // console.log({style: this._style});
        // console.log({inject});
        // console.log({build});
        // console.log();

        // Execute build
        const retry = this._settings.retry;
        const run = retry ? Async.retryable(retry, internals.execute) : internals.execute;

        /* eslint-disable brace-style, hapi/hapi-scope-start */
        const rpath = (this._final && this._final._isMercy) ? '_final.result' : '_final';
        run(build, rpath, (err, result) => { return callback(err, result); });
        /* eslint-enable brace-style, hapi/hapi-scope-start */
    }

    // Flow style

    series() {

        for (let i = 0; i < this._children.length; ++i) {
            const child = this._children[i];
            Hoek.assert(!child.depends.length, `Cannot convert style to Series. Child task ${child.label} has dependency ${child.depends}`);
        }

        const flow = this.clone();
        flow._style = 'series';

        return flow;
    }

    waterfall() {

        for (let i = 0; i < this._children.length; ++i) {
            const child = this._children[i];
            Hoek.assert(!child.depends.length, `Cannot convert style to Waterfall. Child task ${child.label} has dependency ${child.depends}`);
        }

        const flow = this.clone();
        flow._style = 'waterfall';

        return flow;
    }

    parallel() {

        for (let i = 0; i < this._children.length; ++i) {
            const child = this._children[i];
            Hoek.assert(!child.depends.length, `Cannot convert style to Parallel. Child task ${child.label} has dependency ${child.depends}`);
        }

        const flow = this.clone();
        flow._style = 'parallel';

        return flow;
    }

    auto() {

        const flow = this.clone();
        flow._style = 'auto';

        return flow;
    }

    cargo(workers) {}

    // Flow Options

    skip() {

        const flow = this.clone();
        flow._settings.skip = true;

        return flow;
    }

    retry(...args) {

        const flow = this.clone();
        flow._settings.retry = args.pop();

        return flow;
    }

    required() {

        const flow = this.clone();
        flow._settings.optional = false;

        return flow;
    }

    optional() {

        const flow = this.clone();
        flow._settings.optional = true;

        return flow;
    }

    timeout(...args) {

        const schema = Joi.alternatives().try([
            Joi.number().integer().positive().allow(0),
            Joi.object()
        ]);

        const input = Joi.validate(args.pop(), schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        const flow = this.clone();
        flow._settings.timeout = input.value;

        return flow;
    }

    wait(...args) {

        const schema = Joi.number().integer().positive().allow(0);
        const input = Joi.validate(args.pop(), schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        const flow = this.clone();
        flow._settings.wait = input.value;

        return flow;
    }

    final(...args) {

        const schema = Joi.alternatives().try(Joi.string(), Joi.object(), Joi.func());
        const input = Joi.validate(args.pop(), schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        const flow = this.clone();

        Reach = Reach || require('./reach');
        Transform = Transform || require('./transform');

        flow._final = (typeof input.value === 'string') ? new Reach(input.value) : flow._final;
        flow._final = (typeof input.value === 'object') ? new Transform(input.value) : flow._final;
        flow._final = (typeof input.value === 'function') ? input.value : flow._final;

        return flow;
    }

    mock(options) {

        // `flow().mock(options)`:
        // - `fixture`: _string().requried()_: Fully resolved path _(directory & filename)_ for fixture record/use contextualization.
        // - `local`: _boolean()_ or _array[ports]_; Depends on `mode`. Determines which localhost connections honor [`dryrun`, `record`, `lockdown`] settings. Useful when you have multiple servers running locally and want to _"pretend"_ some are remote/upstream. _`default: false`_
        // - `mode`: _string()_; _`default: 'dryrun'`_
        //   - `wild`: _Allow All_ http[s] calls; _Does not_ use recorded mocks; _Does not_ record new mocks.
        //   - `dryrun`: _Allow Some_ http[s] calls; Use recorded mocks; _Does not_ record new mocks. _(Useful for writing new tests)_
        //   - `record`: _Allow Some_ http[s] calls; Use recorded mocks; Record new mocks.
        //   - `lockdown`: _Disable All_ http[s] calls; Use recorded mocks; _Does not_ record new mocks.
        // - `loader`:
        //     - `after`: A _post-processing_ function called after mock definitions are loaded. See details for `before`.
        //         - Has signature `(scope) => {}` where `scope` allows further manipulation.
        //     - `before`: A _pre-processing_ function called before mock definitions are loaded. Has signature `(scope) => { return scope }`
        // - `recorder`:
        //     - `after`: A _post-processing_ function called after recording completes.
        //         - Has signature `(scopes) => { return scopes }` where `scopes` is an _array_ of recorded objects.
        //         - Function hould return an array `scopes` to save to the `fixture`.
        //     - `options`: Custom options to pass to the recorder

        // loader.after:
        // [0] 'add',
        // [1] 'remove',
        // [2] 'intercept',
        // [3] 'get',
        // [4] 'post',
        // [5] 'put',
        // [6] 'head',
        // [7] 'patch',
        // [8] 'merge',
        // [9] 'delete',
        // [10] 'options',
        // [11] 'pendingMocks',
        // [12] 'activeMocks',
        // [13] 'isDone',
        // [14] 'done',
        // [15] 'buildFilter',
        // [16] 'filteringPath',
        // [17] 'filteringRequestBody',
        // [18] 'matchHeader',
        // [19] 'defaultReplyHeaders',
        // [20] 'log',
        // [21] 'persist',
        // [22] 'shouldPersist',
        // [23] 'replyContentLength',
        // [24] 'replyDate'

        const schema = Joi.object().required().keys({
            fixture: Joi.string().required(),
            mode: Joi.string().default('dryrun').valid('dryrun', 'lockdown', 'record', 'wild'),
            loader: Joi.object().default().keys({ after: Joi.func().arity(1), before: Joi.func().arity(1) }),
            recorder: Joi.object().default().keys({ after: Joi.func().arity(1) }),
            local: Joi.alternatives().default(false).try([
                Joi.array().single().unique().items(Joi.number().integer().positive().max(65535)),
                Joi.boolean().default(false)
            ])
        });

        const input = Joi.validate(options, schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        const flow = this.clone();
        flow._settings.mock = input.value;

        return flow;
    }

    tree(data) {

        const tree = new Tree.Print(this, data);
        tree.show();
    }
};


internals.wrap = function (inject, task) {

    const isMercy = task._isMercy;

    return (data, next) => {

        let input = inject.length ? [] : [data];

        // Mercy.timeout() - Parent timeout can override child
        if (isMercy) {
            const curr = Hoek.reach(data, '_timeout.timer');

            if (curr) {
                const child = task._settings.timeout;
                const remaining = curr.remaining();
                const timeout = (!child || (child > remaining)) ? curr : child;
                task = task.timeout(timeout);
            }
        }

        // Inject is adaptive. Uses either (raw function or Mercy) result.
        for (let i = 0; i < inject.length; ++i) {
            const item = inject[i];

            // `_input` - injection demands spreading (ex: waterfall && Merct.Input())
            if (item === '_input') {
                input = data._input.length ? [...input, ...data[item]] : [...input, undefined];
            }
            else {
                input.push(Hoek.reach(data[item], 'result', { default: data[item] }));
            }
        }

        /* eslint-disable brace-style, hapi/hapi-scope-start */
        const params = [...input, (err, result) => { return next(err, result); }];
        /* eslint-enable brace-style, hapi/hapi-scope-start */

        // console.log({ inject });
        // console.log({ params });

        return isMercy ? task.execute(...params) : task(...params);
    };
};


internals.execute = function (build, rpath, callback) {

    Async.auto(build, (err, data) => {

        // _timeout - Mercy.timeout()
        clearTimeout(Hoek.reach(data._timeout, 'timer'));

        // _mock - Mercy.flow().mock() - Deactivate nock scope
        data._mock && data._mock.done();

        // Metrics
        const meta = data._meta;
        meta.bench.end = new Hoek.Bench();
        meta.timer.end = new Hoek.Timer();
        meta.bench.duration = meta.bench.start.elapsed();
        meta.timer.duration = meta.timer.start.elapsed();

        const result = Hoek.reach(data, rpath, { default: null });

        if (err) {
            const optional = data._meta.settings.optional;
            const values = !optional ? [err, { data, result: err }] : [null, { data, result }];

            return callback(...values);
        }

        return callback(null, { data, result });
    });
};


internals.localhosts = function () {

    const localhosts = [Os.hostname()];
    const ifaces = Os.networkInterfaces();
    const keys = Object.keys(ifaces);

    for (let i = 0; i < keys.length; ++i) {
        if (ifaces.hasOwnProperty(keys[i])) {
            const iface = ifaces[keys[i]];

            for (let j = 0; j < iface.length; ++j) {
                const scope = iface[j];

                if (scope.internal) {
                    localhosts.push(scope.address);
                }
            }
        }
    }

    return localhosts;
};
