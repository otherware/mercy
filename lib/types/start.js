'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: {
        server: Joi.object().required().unknown().keys({
            start: Joi.func().required(),
            info: Joi.object().required().unknown().keys({
                uri: Joi.string().required().uri({ scheme: [/https?/] })
            })
        })
    }
};


module.exports = internals.Start = class extends Flow {

    constructor() {

        super();

        this._type = 'start';
        this._style = 'waterfall';

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const start = (...args) => {

            const next = args.pop();
            const server = args.shift();
            // const schema = Joi.object().default();

            // Ensure we are dealing with a valid server
            const input = Joi.validate({ start: server.start, info: server.info }, internals.schema.server);
            Hoek.assert(!input.error, input.error && input.error.annotate());

            server.start((err) => {

                if (err) {
                    return next(err);
                }

                return next(null, server);
            });
        };

        return super.tasks(start);
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    clone() { return super.clone(); }

    tasks() { Hoek.assert(false, 'Modification of Mercy.start() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.start() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.start() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.start() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.start() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
