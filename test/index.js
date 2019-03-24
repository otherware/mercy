'use strict';

// Load modules

const Code = require('code');
const Crypto = require('crypto');
const Fs = require('fs-extra');
const Joi = require('joi');
const Lab = require('lab');
const Path = require('path');

const Mercy = require('../lib');


// Test shortcuts

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect = Code.expect;


// Declare internals

const internals = {
    /* eslint-disable brace-style, hapi/hapi-scope-start */
    noop: (data, next) => { return next(); },
    echo: (value, next) => { return next(null, value); },
    /* eslint-enable brace-style, hapi/hapi-scope-start */
    console: (value, next) => {

        console.log({ value });
        return next(null, value);
    },
    peak: (fixture) => {

        const peak = (last, next) => {

            return next(null, { mocks: require(fixture) });
        };

        return peak;
    },
    clean: (fixture) => {

        const clean = (last, next) => {

            Fs.remove(Path.resolve(fixture));
            return next(null, last);
        };

        return clean;
    },
    preRegister: (server, next) => {

        server.state('session', {
            ttl: 24 * 60 * 60 * 1000,
            path: '/',
            encoding: 'base64json'
        });

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

        const cookie = (request, reply) => {

            const cookie = request.headers.cookie;
            return reply({ cookie }).state('session', { foo: 'bar' });
        };

        server.route([
            { method: 'GET', path: '/rand', handler: rand },
            { method: 'GET', path: '/status', handler: status },
            { method: 'GET', path: '/cookie', handler: cookie }
        ]);

        return next();
    }
};


describe('Mercy', () => {

    it('creates root', (done) => {

        expect(Mercy._isMercy).to.be.true();
        expect(Mercy.flow).to.be.a.function();

        done();
    });

    it('creates (empty) flow', (done) => {

        const flow = Mercy.flow();

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(0);

        done();
    });

    it('creates (empty) flow - `object {}` notaiton', (done) => {

        const flow = Mercy.flow({});

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(0);

        done();
    });

    it('creates (single function) flow', (done) => {

        const flow = Mercy.flow(internals.noop);

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);
        expect(flow._children[0].task).to.be.a.function();

        done();
    });

    it('prevents creation of (single mercy object) flow', (done) => {

        /* eslint-disable brace-style, hapi/hapi-scope-start */
        const throwable = () => { Mercy.flow(Mercy.flow()); };
        /* eslint-disable brace-style, hapi/hapi-scope-start */

        expect(throwable).to.throw();

        done();
    });

    it('creates (single function) flow - `array []` notaiton', (done) => {

        const flow = Mercy.flow([internals.noop]);

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);
        expect(flow._children[0].task).to.be.a.function();

        done();
    });

    it('creates (single function) flow - `object {}` notaiton', (done) => {

        const flow = Mercy.flow({ foo: internals.noop });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (multi function) flow - `rest ()` notaiton', (done) => {

        const flow = Mercy.flow(internals.noop, internals.noop).final((data, next) => {

            const task_0 = data.task_0;
            const task_1 = data.task_1;

            return next(null, { task_0, task_1 });
        });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(2);
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();
        expect(flow._children[1].task).to.be.a.object();
        expect(flow._children[1].task._children).to.have.length(1);
        expect(flow._children[1].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (multi function) flow - `array []` notaiton', (done) => {

        const flow = Mercy.flow([internals.noop, internals.noop]);

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(2);
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();
        expect(flow._children[1].task).to.be.a.object();
        expect(flow._children[1].task._children).to.have.length(1);
        expect(flow._children[1].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (multi function) flow - `object {}` notaiton', (done) => {

        const flow = Mercy.flow({ foo: internals.noop, bar: internals.noop });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(2);
        expect(flow._children[0].label).to.equal('foo');
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();
        expect(flow._children[1].label).to.equal('bar');
        expect(flow._children[1].task).to.be.a.object();
        expect(flow._children[1].task._children).to.have.length(1);
        expect(flow._children[1].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (multi function) flow - `object {}` notaiton w/ dependencies', (done) => {

        const flow = Mercy.flow({ foo: internals.noop, bar: ['foo', internals.noop] });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(2);
        expect(flow._children[0].label).to.equal('foo');
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();
        expect(flow._children[1].label).to.equal('bar');
        expect(flow._children[1].depends).to.equal(['foo']);
        expect(flow._children[1].task).to.be.a.object();
        expect(flow._children[1].task._children).to.have.length(1);
        expect(flow._children[1].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (nested) flow - `array []` notaiton', (done) => {

        const flow = Mercy.flow([[internals.noop]]);

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task).to.be.a.function();

        done();
    });

    it('creates (nested) flow - `object {}` notaiton', (done) => {

        const flow = Mercy.flow({ foo: { bar: internals.noop } });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);
        expect(flow._children[0].label).to.equal('foo');
        expect(flow._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].label).to.equal('bar');
        expect(flow._children[0].task._children[0].task).to.be.a.object();
        expect(flow._children[0].task._children[0].task._children).to.have.length(1);
        expect(flow._children[0].task._children[0].task._children[0].task).to.be.a.function();

        done();
    });

    it('flow.execute() (empty) ', (done) => {

        const flow = Mercy.flow();

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(0);

        flow.execute((err, { data, result }) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            expect(data._meta.bench).to.be.an.object();
            expect(data._meta.timer).to.be.an.object();
            expect(data._meta.bench).to.include(['start', 'end', 'duration']);
            expect(data._meta.timer).to.include(['start', 'end', 'duration']);

            done();
        });
    });

    it('flow.execute() (single function)', (done) => {

        const flow = Mercy.flow(internals.noop);

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);

        flow.execute((err, { data, result }) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            expect(data._meta.bench).to.be.an.object();
            expect(data._meta.timer).to.be.an.object();
            expect(data._meta.bench).to.include(['start', 'end', 'duration']);
            expect(data._meta.timer).to.include(['start', 'end', 'duration']);

            done();
        });
    });

    it('flow.execute() (single function) (single input)', (done) => {

        /* eslint-disable brace-style, hapi/hapi-scope-start */
        const flow = Mercy.flow((input, next) => { return next(null, input); });
        /* eslint-enable brace-style, hapi/hapi-scope-start */

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);

        flow.execute('foobar', (err, { data, result }) => {


            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.equal('foobar');

            done();
        });
    });

    it('flow.execute() (single input) (single function) w/ final', (done) => {

        const flow = Mercy.flow(internals.noop).final((data, next) => {

            return next(null, 'foobar');
        });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);

        flow.execute((err, { data, result }) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            expect(data._meta.bench).to.be.an.object();
            expect(data._meta.timer).to.be.an.object();
            expect(data._meta.bench).to.include(['start', 'end', 'duration']);
            expect(data._meta.timer).to.include(['start', 'end', 'duration']);

            done();
        });
    });

    it('_executes (single function) flow w/ final', (done) => {

        const flow = Mercy.flow(internals.noop).final((data, next) => {

            return next(null, 'foobar');
        });

        expect(flow.flow).to.not.exist();
        expect(flow._children).to.have.length(1);

        flow.execute((err, { data, result }) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            expect(data._meta.bench).to.be.an.object();
            expect(data._meta.timer).to.be.an.object();
            expect(data._meta.bench).to.include(['start', 'end', 'duration']);
            expect(data._meta.timer).to.include(['start', 'end', 'duration']);

            done();
        });
    });

    it('Mercy.execute() (empty) flow', (done) => {

        const flow = Mercy.flow();

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            done();
        });
    });

    it('Mercy.execute() (single function) flow - `rest () notation`', (done) => {

        const flow = Mercy.flow(internals.noop);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            done();
        });
    });

    it('Mercy.execute() (single function) flow w/ final', (done) => {

        const flow = Mercy.flow(internals.noop).final((data, next) => {

            return next(null, 'foobar');
        });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.equal('foobar');

            done();
        });
    });

    it('Mercy.execute() (multi function) flow - `object {} notation`', (done) => {

        const flow = Mercy.flow({ foo: internals.noop, bar: internals.noop });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.null();

            done();
        });
    });

    it('Mercy.execute() (multi function) flow w/ final', (done) => {

        const flow = Mercy.flow({
            foo: internals.noop,
            bar: internals.noop
        }).final((data, next) => {

            return next(null, data.foo.result);
        });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            done();
        });
    });

    it('Mercy.execute() (multi dependent) flow', (done) => {

        const flow = Mercy.flow({
            foo: internals.noop,
            bar: internals.noop,
            foobar: ['foo', 'bar', Mercy.input()]
        }).final((data, next) => {

            return next(null, data.foobar.result);
        });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.equal([undefined, undefined]);

            done();
        });
    });

    it('Mercy.execute() automatically converts to flow', (done) => {

        Mercy.execute(internals.noop, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.undefined();

            done();
        });
    });

    it('Mercy.execute() (nested) flow', (done) => {

        const flow = Mercy.flow({
            foo: internals.noop,
            bar: ['foo', Mercy.flow({ one: internals.noop })]
        });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.be.null();

            done();
        });
    });

    it('Mercy.execute() (nested) flow w/ final', (done) => {

        const flow = Mercy.flow({
            foo: internals.noop,
            bar: ['foo', Mercy.flow({
                one: (data, next) => { return next(null, 'foobar'); }
            }).final((data, next) => {

                return next(null, data.one.result);
            })]
        }).final((data, next) => {

            return next(null, data.bar.result);
        });

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('_input (single param) (single function)', (done) => {

        const flow = internals.echo;

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('_input (multi param) (single function)', (done) => {

        const flow = (foo, bar, next) => { return next(null, [foo, bar]); };

        Mercy.execute('foo', 'bar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();

            expect(result).to.equal(['foo', 'bar']);

            done();
        });
    });

    it('_input (single param) (nested function) - `object {} notation`', (done) => {

        const flow = Mercy.flow({
            foo: Mercy.input(),
            bar: ['foo', internals.echo]
        }).final((data, next) => {

            return next(null, data.bar.result);
        });

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('_input (single param) (nested function) - `array [] notation`', (done) => {

        const flow = Mercy.flow([
            Mercy.input(),
            (input, next) => { return next(null, input); }
        ]);

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input() (single param)', (done) => {

        const flow = Mercy.input();

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();

            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input().validate() (single param)', (done) => {

        const schema = Joi.string();
        const flow = Mercy.input().validate(schema);

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();

            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input().validate() (multi param)', (done) => {

        const schema = Joi.array().items(Joi.string());
        const flow = Mercy.input().validate(schema);

        Mercy.execute('foobar', 'foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();

            expect(result).to.equal(['foobar', 'foobar']);

            done();
        });
    });

    it('Mercy.input() - array flow', (done) => {

        const flow = Mercy.flow([Mercy.input()]);

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input() - object flow', (done) => {

        const flow = Mercy.flow({ in: Mercy.input() }).final((data, next) => {

            return next(null, data.in.result);
        });

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input() flows accept dependencies as input', (done) => {

        const flow = Mercy.flow({
            input: Mercy.input(),
            foo: ['input', Mercy.input()]
        }).final((data, next) => {

            return next(null, data.foo.result);
        });

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.input() nested flows accept dependencies as input', (done) => {

        const inner = Mercy.flow({
            bar: Mercy.input()
        }).final((data, next) => {

            return next(null, data.bar.result);
        });

        const flow = Mercy.flow({
            input: Mercy.input(),
            foo: ['input', inner]
        }).final((data, next) => {

            return next(null, data.foo.result);
        });

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(data).to.be.an.object();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('flow().final() can set _final', (done) => {

        const flow = Mercy.flow().final(internals.echo);

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.be.equal('foobar');

            done();
        });
    });

    it('flow().final() reach when passed a `string`', (done) => {

        const flow = Mercy.flow({ echo: Mercy.input() }).final('echo.result');

        Mercy.execute('foobar', flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('flow().final() transform when passed an `object`', (done) => {

        const flow = Mercy.flow({ echo: Mercy.input() }).final({ 'bar': 'echo.result.foo' });

        Mercy.execute({ foo: 'bar' }, flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal({ bar: 'bar' });

            done();
        });
    });

    it('flow().wait()', (done) => {

        const flow = Mercy.flow().wait(256);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.be.undefined();
            expect(data._meta.bench.duration).to.be.at.least(256);
            expect(data._meta.timer.duration).to.be.at.least(256);

            done();
        });
    });

    it('Mercy.wait()', (done) => {

        const flow = Mercy.wait(256);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.be.equal(256);
            expect(data._meta.bench.duration).to.be.at.least(256);
            expect(data._meta.timer.duration).to.be.at.least(256);

            done();
        });
    });

    it('flow().timeout()', (done) => {

        const flow = Mercy.flow(Mercy.wait(256), Mercy.wait(256)).timeout(1);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.exist();
            expect(result).to.be.an.error();
            expect(result).to.be.an.equal(err);

            done();
        });
    });

    it('flow().timeout() parent overrides children', (done) => {

        const flow = Mercy.flow().timeout(1000).tasks([
            Mercy.wait(500).timeout(600),
            Mercy.flow().series().tasks([
                Mercy.wait(2000),           // runs... on interruption, waits for completion of current task.
                Mercy.wait(2000)            // oops cant keep going (series)... exit out; parent timeout occurred;
            ])
        ]);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.exist();
            expect(result).to.be.an.error(Error, 'Flow timeout of 1000(ms) occurred');

            done();
        });
    });

    it('flow().optional()', (done) => {

        const flow = Mercy.flow(Mercy.wait(256), Mercy.wait(256)).timeout(1).optional();

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(256);

            done();
        });
    });

    it('flow().series()', (done) => {

        const flow = Mercy.flow(Mercy.wait(256), Mercy.wait(256)).series();

        expect(flow._style).to.equal('series');

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.be.null();
            expect(data.task_0.result).to.equal(256);
            expect(data.task_1.result).to.equal(256);
            expect(data._meta.bench.duration).to.be.at.least(512);
            expect(data._meta.timer.duration).to.be.at.least(512);

            done();
        });
    });

    it('flow().waterfall()', (done) => {

        const flow = Mercy.flow(Mercy.wait(256), Mercy.wait(256)).waterfall();

        expect(flow._style).to.equal('waterfall');

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(256);
            expect(data._meta.bench.duration).to.be.at.least(512);
            expect(data._meta.timer.duration).to.be.at.least(512);

            done();
        });
    });

    it('flow().parallel()', (done) => {

        const flow = Mercy.flow().parallel().tasks(Mercy.wait(256), Mercy.wait(256));

        expect(flow._style).to.equal('parallel');

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(null);
            expect(data._meta.bench.duration).to.be.within(256, 512);
            expect(data._meta.timer.duration).to.be.within(256, 512);

            done();
        });
    });

    it('flow().retry()', (done) => {

        let count = 0;
        const opts = { times: 3, interval: 64 };

        const flow = Mercy.flow((data, next) => {

            return next(new Error(`Count: ${++count}`));
        }).retry(opts);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.exist();
            expect(count).to.equal(opts.times);
            expect(result).to.be.an.equal(err);
            expect(result).to.be.an.error();

            done();
        });
    });

    it('flow().tasks()', (done) => {

        const flow = Mercy.flow().tasks(internals.noop);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(flow._children).to.have.length(1);
            expect(result).to.be.undefined();

            done();
        });
    });

    it('clone() tasks', (done) => {

        const foo = Mercy.flow({ noop: internals.noop });
        const bar = foo.tasks({ noop2: internals.noop });

        expect(foo._children.pop().label).to.equal('noop');
        expect(bar._children.pop().label).to.equal('noop2');

        done();
    });

    it('clone() series', (done) => {

        const foo = Mercy.flow({ noop: internals.noop });
        const bar = foo.series();

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._style).to.equal('parallel');
        expect(bar._style).to.equal('series');

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() parallel', (done) => {

        const foo = Mercy.flow(internals.noop);
        const bar = foo.parallel();

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._style).to.be.null();
        expect(bar._style).to.equal('parallel');

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() auto', (done) => {

        const foo = Mercy.flow(internals.noop);
        const bar = foo.auto();

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._style).to.be.null();
        expect(bar._style).to.equal('auto');

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() series - fails with dependencies', (done) => {

        const foo = Mercy.flow({ noop: internals.noop, noop2: ['noop', internals.noop] });
        expect(foo._style).to.equal('auto');
        expect(foo.series).to.throw();

        done();
    });

    it('clone() parallel - fails with dependencies', (done) => {

        const foo = Mercy.flow({ noop: internals.noop, noop2: ['noop', internals.noop] });
        expect(foo._style).to.equal('auto');
        expect(foo.parallel).to.throw();

        done();
    });

    it('clone() required', (done) => {

        const foo = Mercy.flow(internals.noop);
        const bar = foo.optional().required();

        Code.settings.comparePrototypes = true;

        expect(foo).to.equal(bar);
        expect(bar._settings.optional).to.be.false();

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() optional', (done) => {

        const foo = Mercy.flow(internals.noop);
        const bar = foo.optional();

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._settings.optional).to.be.false();
        expect(bar._settings.optional).to.be.true();

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() retry', (done) => {

        const opts = { times: 3, interval: 256 };
        const foo = Mercy.flow(internals.noop);
        const bar = foo.retry(opts);

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._settings.retry).to.be.null();
        expect(bar._settings.retry).to.equal(opts);

        Code.settings.comparePrototypes = false;

        done();
    });

    it('clone() final', (done) => {

        const final1 = (value, next) => { return next(null, 'foo'); };
        const final2 = (value, next) => { return next(null, 'bar'); };

        const foo = Mercy.flow(internals.noop).final(final1);
        const bar = foo.final(final2);

        Code.settings.comparePrototypes = true;

        expect(foo).to.not.equal(bar);
        expect(foo._final).to.equal(final1);
        expect(bar._final).to.equal(final2);

        Code.settings.comparePrototypes = false;

        done();
    });

    it('Mercy.compose()', (done) => {

        const manifest = require('./cfg/basic');
        const flow = Mercy.compose(manifest);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const server = result;

            server.connections.forEach((connection) => {

                expect(connection._started).to.be.false();
            });

            expect(server.info.created).to.be.above(0);
            expect(server.info.started).to.equal(0);

            done();
        });
    });

    it('Mercy.start()', (done) => {

        const manifest = require('./cfg/basic');
        const flow = Mercy.flow([
            Mercy.compose(manifest),
            Mercy.start()
        ]);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const server = result;
            server.connections.forEach((connection) => {

                expect(connection._started).to.be.true();
            });

            expect(server.info.created).to.be.above(0);
            expect(server.info.started).to.be.above(0);

            done();
        });
    });

    it('Mercy.stop()', (done) => {

        const manifest = require('./cfg/basic');
        const flow = Mercy.flow([
            Mercy.compose(manifest),
            Mercy.start(),
            Mercy.stop()
        ]);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const server = result;
            server.connections.forEach((connection) => {

                expect(connection._started).to.be.false();
            });

            expect(server.info.created).to.be.above(0);
            expect(server.info.started).to.equal(0);

            done();
        });
    });

    it('Mercy.prepare()', (done) => {

        const manifest = require('./cfg/basic');
        const flow = Mercy.prepare(manifest);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const server = result;
            server.connections.forEach((connection) => {

                expect(connection._started).to.be.true();
            });

            done();
        });
    });

    it('Mercy.validate()', (done) => {

        const schema = Joi.number();
        const flow = Mercy.validate(schema);

        Mercy.execute(32, flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(32);

            done();
        });
    });

    it('Mercy.input(schema)', (done) => {

        const schema = Joi.number();
        const flow = Mercy.input(schema);

        Mercy.execute(32, flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal(32);

            done();
        });
    });

    it('Mercy.transform()', (done) => {

        const source = {
            address: {
                one: '123 main street',
                two: 'PO Box 1234'
            },
            title: 'Warehouse',
            state: 'CA'
        };

        const template = {
            'person.address.lineOne': 'address.one',
            'person.address.lineTwo': 'address.two',
            'title': 'title',
            'person.address.region': 'state'
        };

        const flow = Mercy.transform(template);

        Mercy.execute(source, flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal({
                title: 'Warehouse',
                person: {
                    address: {
                        lineOne: '123 main street',
                        lineTwo: 'PO Box 1234',
                        region: 'CA'
                    }
                }
            });

            done();
        });
    });

    it('Mercy.reach()', (done) => {

        const flow = Mercy.reach('test.ing');
        const input = { test: { ing: 'foobar' } };

        Mercy.execute(input, flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.equal('foobar');

            done();
        });
    });

    it('Mercy.wreck()', (done) => {

        const manifest = require('./cfg/basic');
        const options = { preRegister: internals.preRegister };

        const prepare = Mercy.prepare(manifest, options);
        const transform = Mercy.transform({ 'options.baseUrl': 'info.uri' });
        const wreck = Mercy.wreck().get('/status').defaults({ json: true });

        const flow = Mercy.flow().tasks(prepare, transform, wreck);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();
            expect(result).to.be.an.object();
            expect(result.response).to.be.an.object();
            expect(result.payload).to.equal({ status: 'ok', results: ['ok'] });

            done();
        });
    });

    it('Mercy.inject()', (done) => {

        const manifest = require('./cfg/basic');
        const options = { preRegister: internals.preRegister };

        const prepare = Mercy.prepare(manifest, options);
        const inject = Mercy.inject('/status');

        const flow = Mercy.flow().tasks(prepare, inject);

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const keys = Object.keys(result);
            const values = ['statusCode', 'headers', 'payload', 'rawPayload', 'raw', 'req', 'res', 'result', 'request'];

            expect(keys).to.part.contain(values);
            expect(result.result).to.equal({ status: 'ok', results: ['ok'] });

            done();
        });
    });

    it('Mercy.inject() automatically extracts set-cookies from previous requests', (done) => {

        const manifest = require('./cfg/basic');
        const options = { preRegister: internals.preRegister };

        const flow = Mercy.flow().tasks({
            preapre: Mercy.prepare(manifest, options),
            inject1: ['preapre', Mercy.inject('/cookie')],
            inject2: ['preapre', 'inject1', Mercy.inject('/cookie')]
        }).final('inject2');

        Mercy.execute(flow, (err, data, result) => {

            expect(err).to.not.exist();

            const res = result;
            expect(res.result.cookie).to.be.a.string();

            done();
        });
    });

    it('Mercy.mock() - local:false (default) does not record fixtures', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/status`).defaults({ json: true });
            const record = wreck.mock({ mode: 'record', local: false, fixture });
            const peak = internals.peak(fixture);
            const clean = internals.clean(fixture);

            const flow = Mercy.flow().waterfall().tasks({ record, peak, clean });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.peak.result.mocks).to.have.length(0);
                expect(data.record.result.payload).to.equal({ status: 'ok', results: ['ok'] });

                done();
            });
        });
    });

    it('Mercy.mock() - local:true records fixtures', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/status`).defaults({ json: true });
            const record = wreck.mock({ mode: 'record', local: true, fixture });
            const peak = internals.peak(fixture);
            const clean = internals.clean(fixture);

            const flow = Mercy.flow().waterfall().tasks({ record, peak, clean });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.peak.result.mocks).to.have.length(1);
                expect(data.record.result.payload).to.equal({ status: 'ok', results: ['ok'] });

                done();
            });
        });
    });

    it('Mercy.mock() - local:[ports] records fixtures', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/status`).defaults({ json: true });
            const record = wreck.mock({ mode: 'record', local: [result.info.port], fixture });
            const peak = internals.peak(fixture);
            const clean = internals.clean(fixture);

            const flow = Mercy.flow().waterfall().tasks({ record, peak, clean });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.peak.result.mocks).to.have.length(1);
                expect(data.record.result.payload).to.equal({ status: 'ok', results: ['ok'] });

                done();
            });
        });
    });

    it('Mercy.mock() - local:false (default) does not lockdown', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/status`).defaults({ json: true });
            const lockdown = wreck.mock({ mode: 'lockdown', local: false, fixture });

            const flow = Mercy.flow().waterfall().tasks({ lockdown });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.lockdown.result.payload).to.equal({ status: 'ok', results: ['ok'] });

                done();
            });
        });
    });

    it('Mercy.mock() - local:[ports] (default) specified ports are on lockdown', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const info = result.info;
            const wreck = Mercy.wreck().get(`${info.uri}/status`).defaults({ json: true });
            const lockdown = wreck.mock({ mode: 'lockdown', local: [info.port], fixture });

            const flow = Mercy.flow().waterfall().tasks({ lockdown });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.exist();
                expect(err).to.be.an.error(`Client request error: Nock: Not allow net connect for "${info.host}:${info.port}/status"`);

                done();
            });
        });
    });

    it('Mercy.mock() - local:true (default) all localhost connections are on lockdown', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const info = result.info;
            const wreck = Mercy.wreck().get(`${info.uri}/status`).defaults({ json: true });
            const lockdown = wreck.mock({ mode: 'lockdown', local: true, fixture });

            const flow = Mercy.flow().waterfall().tasks({ lockdown });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.exist();
                expect(err).to.be.an.error(`Client request error: Nock: Not allow net connect for "${info.host}:${info.port}/status"`);

                done();
            });
        });
    });

    it('Mercy.mock() - record local:true & test wild', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/rand`).defaults({ json: true });
            const record = wreck.mock({ mode: 'record', local: true, fixture });
            const wild = wreck.mock({ mode: 'wild', fixture });
            const peak = internals.peak(fixture);
            const clean = internals.clean(fixture);

            const flow = Mercy.flow().waterfall().tasks({ record, wild, peak, clean });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.peak.result.mocks).to.have.length(1);

                const record = data.record.result.payload;
                const wild = data.wild.result.payload;

                expect(record.rand).to.be.a.number();
                expect(wild.rand).to.be.a.number();
                expect(wild.rand).to.not.equal(record.rand);
                expect(wild.results).to.equal([record.rand, wild.rand]);

                done();
            });
        });
    });

    it('Mercy.mock() - record local:true & test lockdown', (done) => {

        const fixture = `${__dirname}/fixtures/mock_${Crypto.randomBytes(4).readUInt32LE(0)}.json`;
        const manifest = require('./cfg/basic');

        const prepare = Mercy.prepare(manifest, { preRegister: internals.preRegister });

        Mercy.execute(prepare, (err, data, result) => {

            expect(err).to.not.exist();

            const wreck = Mercy.wreck().get(`${result.info.uri}/rand`).defaults({ json: true });
            const record = wreck.mock({ mode: 'record', local: true, fixture });
            const lockdown = wreck.mock({ mode: 'lockdown', fixture });
            const peak = internals.peak(fixture);
            const clean = internals.clean(fixture);

            const flow = Mercy.flow().waterfall().tasks({ record, lockdown, peak, clean });

            Mercy.execute(flow, (err, data, result) => {

                expect(err).to.not.exist();
                expect(data.peak.result.mocks).to.have.length(1);

                const record = data.record.result.payload;
                const lockdown = data.lockdown.result.payload;

                expect(record.rand).to.be.a.number();
                expect(lockdown.rand).to.be.a.number();
                expect(lockdown.rand).to.equal(record.rand);
                expect(lockdown.results).to.have.length(1);

                done();
            });
        });
    });
});
