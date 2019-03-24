'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: Joi.object().schema().required()
};


module.exports = internals.Validate = class extends Flow {

    constructor(options) {

        const input = Joi.validate(options, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'wait';
        this._style = 'waterfall';
        this._schema = input.value;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const validate = (...args) => {

            const next = args.pop();
            const value = (args.length > 1) ? args : args.slice().pop();

            Joi.validate(value, this._schema, (err, result) => {

                if (err) {
                    return next(err);
                }

                return next(null, result);
            });
        };

        return super.tasks(validate);
    }

    clone() {

        const flow = super.clone();

        flow._schema = this._schema;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.wait() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
