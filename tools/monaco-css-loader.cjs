const path = require('node:path');
const cssLoader = require('css-loader');

module.exports = function (source, map, meta) {
  // Turbopack lacks the webpack utils API used by css-loader. Keep CSS parsing
  // and URL handling in css-loader; supply only the missing request utility.
  const utils = {
    contextify(context, request) {
      return request
        .split('!')
        .map(part => {
          if (!path.isAbsolute(part)) return part;
          const relative = path
            .relative(context, part)
            .split(path.sep)
            .join('/');
          return relative.startsWith('../') ? relative : `./${relative}`;
        })
        .join('!');
    },
  };

  const callback = this.async();
  const moduleId = utils.contextify(this.rootContext, this.resourcePath);
  // Even its ESM output uses webpack's module.id to identify stylesheet entries.
  // Provide a local identifier instead of relying on a CommonJS runtime global.
  const async =
    () =>
    (error, code, ...rest) => {
      if (error) return callback(error);
      callback(
        null,
        `const module = { id: ${JSON.stringify(moduleId)} };\n${code}`,
        ...rest
      );
    };

  // The loader context is not extensible, so pass a copy to css-loader.
  return cssLoader.call({ ...this, utils, async }, source, map, meta);
};
