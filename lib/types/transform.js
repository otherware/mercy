'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: Joi.object().required()
};


module.exports = internals.Transform = class extends Flow {

    constructor(options) {

        const input = Joi.validate(options, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'transform';
        this._style = 'waterfall';
        this._map = input.value;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const transform = (...args) => {

            const next = args.pop();
            const result = Hoek.transform(args.pop(), this._map);

            return next(null, result);
        };

        return super.tasks(transform);
    }

    clone() {

        const flow = super.clone();

        flow._map = this._map;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.transform() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.transform() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.transform() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.transform() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.transform() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
