'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: Joi.number().integer().positive().allow(0).default(0)
};


module.exports = internals.Wait = class extends Flow {

    constructor(options) {

        const input = Joi.validate(options, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'wait';
        this._style = 'waterfall';
        this._duration = input.value;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const wait = (last, next) => {

            setTimeout(() => {

                return next(null, this._duration);
            }, this._duration);
        };

        return super.tasks(wait);
    }

    clone() {

        const flow = super.clone();

        flow._duration = this._duration;

        return flow;
    }

    duration(options) {

        const input = Joi.validate(options, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        const flow = this.clone();

        flow._duration = input.value;

        return flow._tasks();
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.wait() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.wait() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
