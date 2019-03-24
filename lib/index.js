'use strict';

// Load modules

const Hoek = require('hoek');
const Any = require('./types/any');


// Declare internals

const internals = {
    compose: require('./types/compose'),
    flow: require('./types/flow'),
    inject: require('./types/inject'),
    input: require('./types/input'),
    prepare: require('./types/prepare'),
    reach: require('./types/reach'),
    start: require('./types/start'),
    stop: require('./types/stop'),
    transform: require('./types/transform'),
    validate: require('./types/validate'),
    wait: require('./types/wait'),
    wreck: require('./types/wreck')
};


internals.root = function () {

    const root = new Any();

    root.version = require('../package.json').version;

    root.flow = (...args) => {

        const tasks = (args.length > 1) ? args : args.slice().pop();
        Hoek.assert(!tasks || !tasks._isMercy, 'Will not create new flow consisting of Mercy.flow()');

        return tasks ? new internals.flow(...args) : new internals.flow();
    };

    root.execute = (...args) => {

        const callback = args.pop();
        const flow = (!args.slice(-1).pop()._isMercy) ? new internals.flow(args.pop()) : args.pop();

        Hoek.assert(typeof callback === 'function', 'Missing callback');
        Hoek.assert(flow._isMercy, 'Must be Mercy object');

        flow.execute(...args, (err, { data, result }) => {

            return callback(err, data, result);
        });
    };

    root.input = (...args) => {

        return new internals.input(...args);
    };

    root.wait = (...args) => {

        return new internals.wait(...args);
    };

    root.compose = (...args) => {

        Hoek.assert(args.length, 'Mercy.compose() missing arguments.');

        return new internals.compose(...args);
    };

    root.start = (...args) => {

        return new internals.start(...args);
    };

    root.stop = (...args) => {

        return new internals.stop(...args);
    };

    root.prepare = (...args) => {

        Hoek.assert(args.length, 'Mercy.prepare() missing arguments.');

        return new internals.prepare(...args);
    };

    root.validate = (...args) => {

        Hoek.assert(args.length, 'Mercy.validate() missing arguments.');

        return new internals.validate(...args);
    };

    root.transform = (...args) => {

        Hoek.assert(args.length, 'Mercy.transform() missing arguments.');

        return new internals.transform(...args);
    };

    root.reach = (...args) => {

        Hoek.assert(args.length, 'Mercy.reach() missing arguments.');

        return new internals.reach(...args);
    };

    root.wreck = (...args) => {

        return new internals.wreck(...args);
    };

    root.inject = (...args) => {

        return new internals.inject(...args);
    };

    return root;
};


module.exports = internals.root();
