'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: Joi.string().required()
};


module.exports = internals.Reach = class extends Flow {

    constructor(options) {

        const input = Joi.validate(options, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'reach';
        this._style = 'waterfall';
        this._path = input.value;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const reach = (...args) => {

            const next = args.pop();
            const result = Hoek.reach(args.pop(), this._path);

            return next(null, result);
        };

        return super.tasks(reach);
    }

    clone() {

        const flow = super.clone();

        flow._path = this._path;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.reach() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.reach() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.reach() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.reach() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.reach() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
