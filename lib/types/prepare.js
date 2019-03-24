'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Compose = require('./compose');
const Flow = require('./flow');
const Start = require('./start');


// Declare internals

const internals = {
    schema: Joi.object().required().keys({
        manifest: Joi.object().required(),
        options: Joi.object().default()
    })
};


module.exports = internals.Prepare = class extends Flow {

    constructor(manifest, options) {

        const input = Joi.validate({ manifest, options }, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'prepare';
        this._style = 'waterfall';
        this._manifest = input.value.manifest;
        this._options = input.value.options;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const compose = new Compose(this._manifest, this._options);
        const start = new Start();

        return super.tasks({ compose, start });
    }

    clone() {

        const flow = super.clone();

        flow._manifest = this._manifest;
        flow._options = this._options;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.prepare() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.prepare() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.prepare() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.prepare() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.prepare() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};
