'use strict';
const Chalk = require('chalk');
const Hoek = require('hoek');

class Flow {

    constructor(flow) {

        this.flow = {
            label: 'root',
            task: flow,
            depends: []
        };
    };

    parse() {

        const tmp = this.traverse(this.flow, {});
        return tmp;
    };

    traverse(flow, out, idx) {

        if (typeof (flow.task) === 'function') {
            return {
                _style: flow.task._style || 'waterfall',
                _function: flow.label,
                _depends: out._depends
            };
        }

        const label = flow.label || `task_${idx}`;

        out[label] = {
            _style: flow.task._style || 'waterfall',
            _depends: flow.depends
        };

        for (let i = 0; i < flow.task._children.length; ++i) {
            const child = flow.task._children[i];
            out[label] = this.traverse(child, out[label], i);
        }

        return out;
    };
}

class Data {

    constructor(data) {

        this.skip = ['_meta', '_input', '_final', '_wait', '_timeout'];
        this.data = {
            root: { data }
        };
    };

    parse() {

        return this.traverse(this.data, {});
    }

    traverse(obj, out) {

        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            if (this.skip.indexOf(key) !== -1) {
                continue;
            }
            const val = obj[key];
            if (!val) {
                continue;
            }
            if (!val.data) {
                continue;
            }
            const meta = val.data._meta;
            out[key] = {
                _duration: this.format(Hoek.reach(meta, 'bench.duration'), 2)
            };
            out[key] = this.traverse(val.data, out[key]);
        }

        return out;
    };

    format(number, precision) {

        const factor = Math.pow(10, precision);
        return Math.round(number * factor) / factor;
    }
}


class Print {

    constructor(flow, data) {

        this.skip = ['_duration', '_style', '_depends'];
        this.indentLevel = 0;
        this.out = '';
        const parsedData = new Data(data).parse();
        const parsedFlow = new Flow(flow).parse();
        this.structure = Hoek.merge(parsedData, parsedFlow);
    }

    show() {

        this.traverse(this.structure);
        console.log(this.out);
    }

    traverse(obj) {

        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            const val = obj[key];

            if (this.skip.indexOf(key) !== -1) {
                continue;
            }
            if (!val || typeof (val) !== 'object') {
                continue;
            }

            let depends = '';
            if (val._depends && val._depends.length > 0) {
                depends = ' (' + Chalk.red(val._depends.join(', ')) + ')';
            }

            let duration = '';
            if (val._duration) {
                duration = ' ' + Chalk.blue.bold(val._duration + 'ms');
            }

            this.out += this.indent() + `${Chalk.magenta(key)} [${Chalk.green(val._style)}]${depends}:${duration}\n`;

            if (val._function) {
                this.out += this.indent() + Chalk.cyan(`    [Function: ${val._function}]\n`);
            }

            this.indentLevel += 4;
            this.traverse(val);
            this.indentLevel -= 4;
        }
    }

    indent() {

        const level = this.indentLevel;
        let out = '';
        for (let i = 0; i < level; ++i) {
            out = out + ' ';
        }

        return out;
    };

    label(flow, out) {

        if (!flow.label) {
            return;
        }

        out.style = flow.task._style || 'waterfall';
        const style = Chalk.green(flow.task._style || 'waterfall');

        if (typeof (flow.task) === 'function') {
            this.out += this.indent() + `${flow.label}: \n`;
            return;
        }

        let depends = '';
        if (flow.depends.length > 0) {
            depends = ' (' + Chalk.red(flow.depends.join(', ')) + ')';
        }

        this.out += this.indent() + `${Chalk.yellow(flow.label)} [${style}]${depends}: \n`;
    };
}

module.exports = {
    Data,
    Flow,
    Print
};
