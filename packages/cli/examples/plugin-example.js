/**
 * Example Atlas plugin.
 *
 * Demonstrates the two extension points:
 *  - `extractors`: contribute new asset kinds / framework support
 *  - `enrich(result, ctx)`: post-process the final AnalysisResult
 *
 * Reference it from config:
 *   { "plugins": ["./examples/plugin-example.js"] }
 */
module.exports = function pluginFactory(/* config */) {
  return {
    name: 'tag-large-components',

    // A trivial enrich hook: flag components that render many children.
    enrich(result) {
      for (const c of result.components) {
        if (c.rendersComponents.length >= 5 && !c.tags.includes('composite')) {
          c.tags.push('composite');
        }
      }
    },

    // To add a custom extractor, implement the Extractor interface and push it:
    // extractors: [new MyGraphqlExtractor()],
  };
};
