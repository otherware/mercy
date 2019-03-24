'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');
const Uri = require('urijs');
const Wreck = require('wreck');

const Flow = require('./flow');


// Declare internals

const internals = {
    alternatives: Joi.alternatives().try([Joi.string().allow(null).default(null), Joi.object()]),
    schema: Joi.object().default().keys({
        uri: Joi.string().allow(null).default(null),
        options: Joi.object().default()
    })
};


module.exports = internals.Wreck = class extends Flow {

    constructor(uri, options) {

        const input = Joi.validate({ uri, options }, internals.schema);
        Hoek.assert(!input.error, input.error && input.error.annotate());

        super();

        this._type = 'wreck';
        this._style = 'waterfall';

        this._method = null;
        this._defaults = input.value;
        this._wreck = Wreck.defaults(input.value.options);

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const wreck = (...args) => {

            const next = args.pop();

            const input = Joi.validate(args.pop(), internals.schema);
            // Hoek.assert(!input.error, input.error && input.error.annotate());

            const opts = Hoek.reach(input ,'value.options', { default: {} });
            const uri = Hoek.reach(input ,'value.uri', { default: null });

            const method = this._method || 'GET';
            const options = Hoek.applyToDefaults(this._defaults.options, opts);

            const base = new Uri(this._defaults.options.baseUrl || '').toString();
            const post = new Uri(uri || this._defaults.uri || '').toString();

            const url = (new Uri(base, post)).toString();

            this._wreck[method.toLowerCase()](url, options, (err, response, payload) => {

                if (err) {
                    return next(err, { response, payload });
                }

                return next(null, { response, payload });
            });
        };

        return super.tasks(wreck);
    }

    clone() {

        const flow = super.clone();

        flow._method = this._method;
        flow._defaults = this._defaults;
        flow._wreck = this._wreck;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    defaults(...args) { return internals.defaults.call(this, this._method, ...args); }
    read(...args) { return internals.defaults.call(this, this._method, ...args); }
    get(...args) { return internals.defaults.call(this, 'GET', ...args); }
    put(...args) { return internals.defaults.call(this, 'PUT', ...args); }
    post(...args) { return internals.defaults.call(this, 'POST', ...args); }
    delete(...args) { return internals.defaults.call(this, 'DELETE', ...args); }
    patch(...args) { return internals.defaults.call(this, 'PATCH', ...args); }

    tasks() { Hoek.assert(false, 'Modification of Mercy.wreck() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.wreck() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.wreck() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.wreck() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.wreck() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};


internals.defaults = function (method, ...args) {

    const input = Joi.validate(args.pop(), internals.alternatives);
    Hoek.assert(!input.error, input.error && input.error.annotate());

    const uri = (typeof input.value === 'string') ? input.value : null;
    const options = (typeof input.value === 'object') ? input.value : {};

    const flow = this.clone();

    flow._method = flow._method;
    flow._defaults = Hoek.applyToDefaults(flow._defaults, { uri, options });
    flow._wreck = flow._wreck.defaults(flow._defaults.options);

    return flow._tasks();
};
