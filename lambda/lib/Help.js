const parseArgs = require("minimist");

const chalk = require("chalk");

const E_UNKNOWN_FLAG = 1;
const E_NO_FLAGS = 2;

module.exports = class Help {

  static parse(args, config) {

    try {
      if (args.length <= 0) {
        let err = new Error("No command line flags given");
        err.code = E_NO_FLAGS;
        throw err;
      }
      return parseArgs(args, Help.configureMinimist(config));
    } catch (e) {

      let err = e;
      err.message = `Help: Error parsing command line flags: ${e.message}`;

      switch (e.code) {
        case E_UNKNOWN_FLAG:
        case E_NO_FLAGS:
          Help.show(config);
      }

      throw err;
    }
  }

  static show(config, options) {

    options = options || {};

    const examples = config.examples.join("\n\t");

    const flags = Object.keys(config.options).map((name) => {

      const option = config.options[name];

      const flags = [
        ...(option.longFlags || []).map((flag) => {return `--${flag}`;}),
        ...(option.shortFlags || []).map((flag) => {return `-${flag}`;})
      ].join(" | ");

      return `${name}\t\t: ${flags}\t\t: ${option.description}`;
    }).join("\n\t");

    let helpText = chalk`
  {bold.blue ${config.title}}

  \t${config.description}

  \t{bold.blue Examples}
  \t${examples}

  \t{bold.blue Flags}
  \t${flags}
  `;

    console.log(helpText);

    if (options.exit) {
      process.exit(options.exitCode);
    }

  }

  static configureMinimist(config) {
    let opts = {};

    opts.string = Object.keys(config.options).filter((key) => {
      return config.options[key].type === "String";
    });

    opts.boolean = Object.keys(config.options).filter((key) => {
      return config.options[key].type === "Boolean";
    });

    opts.alias = Object.keys(config.options).reduce((aliases, key) => {
      const option = config.options[key];
      aliases[key] = [
        ...(option.longFlags || []).map((flag) => {return `--${flag}`;}),
        ...(option.shortFlags || []).map((flag) => {return `-${flag}`;})
      ];
      return aliases;
    }, {});

    opts.default = Object.keys(config.options).map((key) => {
      return {
        key: config.options[key].default
      };
    });

    opts.unknown = (opt) => {

      let e = new Error(`Unknown command line flag: ${opt}`);
      e.code = E_UNKNOWN_FLAG;

      throw e;
    };

    return opts;
  }

  static get E_UNKNOWN_FLAG() {
    return E_UNKNOWN_FLAG;
  }

};