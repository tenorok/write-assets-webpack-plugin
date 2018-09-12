'use strict';

var _path = _interopRequireDefault(require("path"));

var _lodash = _interopRequireDefault(require("lodash"));

var _camelcase = _interopRequireDefault(require("camelcase"));

var _neoAsync = _interopRequireDefault(require("neo-async"));

var _tapable = require("tapable");

var _nodeOutputFileSystem = _interopRequireDefault(require("./nodeOutputFileSystem"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const pluginName = 'WriteAssetsWebpackPlugin';
const pluginNameHooks = `${pluginName}Hooks`;

class WriteAssetsWebpackPlugin {
  constructor(options) {
    // Default options
    this.options = _lodash.default.extend({
      force: true,
      extension: [],
      debug: false
    }, options);
    this.outputFileSystem = new _nodeOutputFileSystem.default();
  }

  debug(ms) {
    if (this.options.debug) {
      console.log(ms);
    }
  }

  apply(compiler) {
    let compilationPromise; // Setup hooks for webpack 4

    if (compiler.hooks) {
      compiler.hooks.compilation.tap(pluginNameHooks, compilation => {
        this.debug(`${pluginName}: Setup hooks`);
        compilation.hooks.webpackDevWriteToDiskBefore = new _tapable.SyncWaterfallHook(['pluginArgs']);
        compilation.hooks.webpackDevWriteToDiskProcessing = new _tapable.AsyncSeriesWaterfallHook(['pluginArgs']);
        compilation.hooks.webpackDevWriteToDiskAfter = new _tapable.AsyncSeriesWaterfallHook(['pluginArgs']);
      }); // The Compiler begins with emitting the generated assets.

      compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
        compilationPromise = new Promise((resolve, reject) => {
          let assets = compilation.assets; // List only files of a particular extension

          if (this.options.extension.length) {
            assets = _lodash.default.pickBy(compilation.assets, (v, k) => ~this.options.extension.indexOf(_path.default.extname(k).substring(1)));
          }

          let fileInfo = {
            outputPath: compilation.outputOptions.path,
            assets: assets
          };
          this.debug(`${pluginName}: Get all assets information.`);
          callback();
          resolve(fileInfo);
        });
      }); // The Compiler has emitted all assets.

      compiler.hooks.afterEmit.tapAsync(pluginName, (compilation, callback) => {
        const applyPluginsAsyncWaterfall = this.applyPluginsAsyncWaterfall(compilation);
        Promise.resolve().then(() => {
          this.debug(`${pluginName}: Dispatch Before Event.`);
          compilation.hooks.webpackDevWriteToDiskBefore.call();
        }).then(() => compilationPromise).then(fileInfo => {
          let pluginArgs = {};
          this.debug(`${pluginName}: Dispatch Processing Event.`);
          applyPluginsAsyncWaterfall('webpack-dev-write-to-disk-processing', pluginArgs);
          let assets = fileInfo.assets,
              outputPath = fileInfo.outputPath;

          const emitFiles = done => {
            return err => {
              if (err) throw err;
              const iterator = this.iteratorAssets(outputPath);

              _neoAsync.default.each(assets, iterator, err => {
                if (err) throw err;
                return done();
              });
            };
          };

          return new Promise((res, rej) => {
            // Make destination directory and create all asset files.
            if (this.options.force) {
              // Make callback done emit files
              let done = () => {
                res('done');
              };

              this.outputFileSystem.mkdirp(outputPath, emitFiles(done));
            }
          });
        }).then(() => {
          let pluginArgs = {};
          this.debug(`${pluginName}: Dispatch After Event.`);
          return applyPluginsAsyncWaterfall('webpack-dev-write-to-disk-after', pluginArgs);
        }).catch(err => {
          console.error(err);
          return err;
        }).then(() => null) // Let webpack continue with it
        .then(() => {
          callback();
        });
      });
    }
  }
  /**
   * Loop through all assets and write file to disk
   */


  iteratorAssets(outputPath) {
    return (source, file, done) => {
      let targetFile = file;
      const queryStringIdx = targetFile.indexOf('?');

      if (queryStringIdx >= 0) {
        targetFile = targetFile.substr(0, queryStringIdx);
      } // Write file content to target path and return callback done() after completed


      const writeOut = err => {
        if (err) return done(err);
        const targetPath = this.outputFileSystem.join(outputPath, targetFile);
        let content = source.source();

        if (!Buffer.isBuffer(content)) {
          content = Buffer.from(content, 'utf8');
        }

        this.outputFileSystem.writeFile(targetPath, content, done);
      };

      if (targetFile.match(/\/|\\/)) {
        const dir = this.outputFileSystem.dirname(targetFile);
        this.outputFileSystem.mkdirp(this.outputFileSystem.join(outputPath, dir), writeOut);
      } else writeOut();
    };
  }
  /**
   * Helper to promisify compilation.applyPluginsAsyncWaterfall that returns
   * a function that helps to merge given plugin arguments with processed ones
   */


  applyPluginsAsyncWaterfall(compilation) {
    if (compilation.hooks) {
      return (eventName, pluginArgs) => {
        const ccEventName = (0, _camelcase.default)(eventName);

        if (!compilation.hooks[ccEventName]) {
          compilation.errors.push(new Error(`${pluginName}: No hook found for + ${eventName}`));
        }

        return compilation.hooks[ccEventName].promise(pluginArgs);
      };
    }

    compilation.errors.push(new Error(`${pluginName} does not support webpack versions below 4.0`));
  }

}

module.exports = WriteAssetsWebpackPlugin;