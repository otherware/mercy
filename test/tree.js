'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');

const Mercy = require('../lib');
const Tree = require('../lib/tree');


// Test shortcuts

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect = Code.expect;


// Declare internals

const internals = {
    noop: (data, next) => { return next(); },
    echo: (value, next) => { return next(null, value); },
    console: (value, next) => {

        console.log({value, next})
        console.log({ console: value });
        return next(null, value);
    },
    preRegister: (server, next) => {

        server.route({
            method: 'GET',
            path: '/status',
            handler: (request, reply) => {

                // console.log({ server: request })

                return reply({ status: 'ok' });
            }
        });

        return next();
    }
};


// {
//     label: {
//         data: {
//             _meta: {}
//             _input: []
//             label: {
//                 data: {
//                     _meta: {}
//                     _input: []
//                     label: ...
//                 }
//             }
//         }
//     }
// }

describe('Mercy', () => {

    it('prints', (done) => {

        const foo = function (data, next) { return next(); };
        const series = Mercy.flow(Mercy.wait(32), Mercy.wait(32)).series();
        const flow = Mercy.flow({ flow_task_0: foo, series })
        const flow2 = Mercy.flow({ aFunction: foo, theflow: flow })

        Mercy.execute(flow2, (err, meta, data, result) => {

            const expected = {
                root: {
                    _style: 'parallel',
                    _depends: [],
                    flow_task_0: {
                        _style: 'waterfall',
                        _function: 'foo',
                        _depends: []
                    },
                    series: {
                        _style: 'series',
                        _depends: [],
                        task_0: {
                            _style: 'waterfall',
                            _function: 'wait',
                            _depends: []
                        },
                        task_1: {
                            _style: 'waterfall',
                            _function: 'wait',
                            _depends: []
                        }
                    }
                }
            };
            const flowTree = new Tree.Flow(flow);
            expect(flowTree.parse()).to.equal(expected);
            // flow2.tree(data);

            done();
        });
    });

    it('auto', (done) => {

        const one = (data, next) => { return next(null, 'test1') };
        const two = (data, next) => { return next(null, 'test2') };
        const three = (one, two, next) => { return next(null, [one, two]) };

        const auto = Mercy.flow({ one, two,  three: ['one', 'two', three] });

        auto.tree();

        done();
    });

    it('shouldnt crash for empty data', (done) => {

        const one = (data, next) => { return next(null, 'test1') };
        const two = (data, next) => { return next(null, 'test2') };
        const three = (one, two, next) => { return next(null, [one, two]) };

        const auto = Mercy.flow({ one, two,  three: ['one', 'two', three] });

        auto.tree({});

        done();
    });

    it('should print all dependencies', (done) => {

        const one = (data, next) => { return next(null, 'test1') };
        const two = (data, next) => { return next(null, 'test2') };
        const wait = (data, next) => { return next(null, 'test2') };
        const series = Mercy.flow().series().tasks(one, two);

        const flow = Mercy.flow().wait(200).tasks({
            input: [one],
            series: ['input', series],
            wait: ['series', Mercy.wait(200)]
        });

        const expected = {
            root: {
                _style: 'auto',
                _depends: [],
                input: {
                    _style: 'waterfall',
                    _function: 'one',
                    _depends: []
                },
                series: {
                    _style: 'series',
                    _depends: [
                        'input'
                    ],
                    task_0: {
                        _style: 'waterfall',
                        _function: 'one',
                        _depends: []
                    },
                    task_1: {
                        _style: 'waterfall',
                        _function: 'two',
                        _depends: []
                    }
                },
                wait: {
                    _style: 'waterfall',
                    _function: 'wait',
                    _depends: [
                        'series'
                    ]
                }
            }
        };

        const flowTree = new Tree.Flow(flow);
        expect(flowTree.parse()).to.equal(expected);
        done();
    });

    it('complicated', (done) => {

        const Crypto = require('crypto');

        const internals = {
            manifest: {
                server: { load: { sampleInterval: 1000 } },
                connections: [{
                    labels: ["api", "http"],
                    load: { maxHeapUsedBytes: 1073741824, maxRssBytes: 2147483648, maxEventLoopDelay: 5000 },
                    routes: { timeout: { server: 60000 } }
                }],
                registrations: []
            },
            preRegister: (server, next) => {

                const results = [];
                const rand = (request, reply) => {

                    const rand = Crypto.randomBytes(4).readUInt32LE(0);
                    results.push(rand);
                    return reply({ rand, results });
                };

                const status = (request, reply) => {

                    const status = 'ok';
                    results.push(status);
                    return reply({ status, results });
                };

                server.route([
                    { method: 'GET', path: '/rand', handler: rand },
                    { method: 'GET', path: '/status', handler: status }
                ]);

                return next();
            }
        };


        // Basic Functions
        // Note that `data` may be `last value` if injection occurs (series & auto)
        const one = (data, next) => { return next(null, 'test1') };
        const two = (data, next) => { return next(null, 'test2') };
        const three = (one, two, next) => { return next(null, [one, two]) };

        // A preapre() step to demonstrate additional complexity
        const prepare = Mercy.prepare(internals.manifest, { preRegister: internals.preRegister });

        // Series Flow
        const series = Mercy.flow().series().tasks(one, two);

        // Parallel Flow
        const parallel = Mercy.flow().parallel().tasks(one, two);


        // Main flow to execute
        const flow = Mercy.flow().wait(200).tasks({     // Wait affects the root flow
            input: Mercy.input(),                       // Ability to grab execute's input params and make easily accessible
            prepare: prepare,                           // Consists of Series - [Mercy.compose(), Mercy.start()]
            series: ['input', series],                  // Small series flow. `input` result is automatically injected
            wait: ['series', Mercy.wait(200)],          // This is a wait flow()
            parallel: ['wait', parallel]
        }).final((data, next) => {

            const result = {};
            return next(null, result);
        });

        Mercy.execute(flow, (err, data, result) => {

            flow.tree(data);
            done();
        });
    });

    it('will not crash if function is null', (done) => {

        const flow = Mercy.flow({
            test: (data, next) => { return next(); },
            test2: (data, next) => { return next(); },
            test3: ['test', (data, next) => { return next(); }]
        });

        flow.tree();

        done();
    });
});


// root
// ├── theFlow
// │   └── task_0: foo
// └── function: foo
