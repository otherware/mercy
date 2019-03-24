'use strict';

// Load modules

const Hoek = require('hoek');

const Flow = require('./flow');
const Validate = require('./validate');


// Declare internals

const internals = {};


module.exports = internals.Input = class extends Flow {

    constructor(schema) {

        super();

        this._type = 'input';
        this._style = 'waterfall';
        this._schema = schema;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const input = (...args) => {

            const next = args.pop();
            const value = Hoek.reach(args, '0._input', { default: args });

            if (value.length === 0) {
                return next(null, undefined);
            }

            if (value.length === 1) {
                return next(null, value.slice().pop());
            }

            return next(null, value);
        };

        const validate = this._schema ? new Validate(this._schema) : null;

        return super.tasks(validate ? [input, validate] : input);
    }

    clone() {

        const flow = super.clone();
        flow._schema = this._schema;

        return flow;
    }

    validate(schema) {

        const flow = this.clone();

        flow._schema = schema;

        return flow._tasks();
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.input() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.input() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.input() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.input() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.input() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
