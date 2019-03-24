'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');

const Flow = require('./flow');


// Declare internals

const internals = {
    schema: {
        server: Joi.object().required().unknown().keys({
            inject: Joi.func().required(),
            info: Joi.object().required().unknown().keys({
                uri: Joi.string().required().uri({ scheme: [/https?/] })
            })
        })
    }
};


module.exports = internals.Inject = class extends Flow {

    constructor(options) {

        super();

        this._type = 'inject';
        this._style = 'waterfall';

        this._method = null;
        this._options = (typeof options === 'string') ? { url: options } : options;

        this._final = (last, next) => {

            return next(null, last);
        };

        return this._tasks();
    }

    _tasks() {

        const inject = (...args) => {

            const next = args.pop();
            const schema = Joi.object().default();

            const input = Joi.validate(args.shift(), internals.schema.server);
            Hoek.assert(!input.error, input.error && input.error.annotate());

            const server = input.value;
            const headers = internals.extract(...args);
            const options = Hoek.applyToDefaults({ headers }, this._options);

            server.inject(options, (result) => {

                return next(null, { result });
            });
        };

        return super.tasks(inject);
    }

    clone() {

        const flow = super.clone();

        flow._method = this._method;
        flow._options = this._options;

        return flow;
    }

    /* eslint-disable brace-style, hapi/hapi-scope-start */
    tasks() { Hoek.assert(false, 'Modification of Mercy.inject() `tasks` is forbidden'); }
    auto() { Hoek.assert(false, 'Modification of Mercy.inject() `style` is forbidden'); }
    parallel() { Hoek.assert(false, 'Modification of Mercy.inject() `style` is forbidden'); }
    series() { Hoek.assert(false, 'Modification of Mercy.inject() `style` is forbidden'); }
    waterfall() { Hoek.assert(false, 'Modification of Mercy.inject() `style` is forbidden'); }
    /* eslint-enable brace-style, hapi/hapi-scope-start */
};


internals.extract = function (...args) {

    const jar = {};

    // Set-Cookie applied in order of input options
    for (let i = 0; i < args.length; ++i) {
        const setCookies = Hoek.reach(args[i], 'headers.set-cookie', { default: [] });

        for (let i = 0; i < setCookies.length; ++i) {
            const setCookie = setCookies[i].split(';')[0];
            const [key, value] = setCookie.split('=');
            jar[key] = value;
        };
    }

    const cookies = [];
    for (let key in jar) {
        if (jar.hasOwnProperty(key)) {
            cookies.push(`${key}=${jar[key]}`);
        }
    }

    return { cookie: cookies.join(';') };
};
