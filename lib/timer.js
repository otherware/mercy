'use strict';

// Load modules

const Hoek = require('hoek');


// Declare internals

const internals = {};


module.exports = internals.Timer = class {

    constructor(callback, duration) {

        this.id = null;
        this.started = null;
        this.running = false;
        this.duration = duration;
        this.callback = callback;

        this.start();

        return this;
    }

    start() {

        this.running = true;
        this.started = new Hoek.Timer();
        this.id = setTimeout(this.callback, this.duration);
    }

    pause() {

        this.running = false;
        clearTimeout(this.id);
        this.duration -= this.started.elapsed();
    }

    isRunning() {

        return this.running;
    }

    remaining() {

        if (this.running) {
            this.pause();
            this.start();
        }

        return this.duration;
    }
};
