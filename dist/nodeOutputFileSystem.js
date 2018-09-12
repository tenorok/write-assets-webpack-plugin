'use strict';

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _mkdirp = _interopRequireDefault(require("mkdirp"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class NodeOutputFileSystem {
  constructor() {
    this.mkdirp = _mkdirp.default;
    this.mkdir = _fs.default.mkdir.bind(_fs.default);
    this.rmdir = _fs.default.rmdir.bind(_fs.default);
    this.unlink = _fs.default.unlink.bind(_fs.default);
    this.writeFile = _fs.default.writeFile.bind(_fs.default);
    this.join = _path.default.join.bind(_path.default);
    this.dirname = _path.default.dirname.bind(_path.default);
  }

}

module.exports = NodeOutputFileSystem;