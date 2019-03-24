'use strict';

// Load modules

const Glue = require('glue');
const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: Joi.object().required().keys({
        manifest: Joi.object().required(),
        options: Joi.object().default()
    })
};


module.exports = internals.Compose = class extends Flow {

    constructor(manifest, options) {

        const input = Joi.validate({ manifest, options }, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'compose';
        this._style = 'waterfall';
        this._manifest = input.value.manifest;
        this._options = input.value.options;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const compose = (...args) => {

            const next = args.pop();
            const input = [this._manifest, this._options];

            Glue.compose(...input, (err, server) => {

                if (err) {
                    return next(err);
                }

                return next(null, server);
            });
        };

        return super.tasks(compose);
    }

    clone() {

        const flow = super.clone();

        flow._manifest = this._manifest;
        flow._options = this._options;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.compose() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.compose() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.compose() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.compose() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.compose() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
