/** Plugin loader: resolves user plugin modules into Plugin objects. */
import { resolve, isAbsolute } from 'path';
import { pathToFileURL } from 'url';
import type { Plugin, ResolvedConfig } from '../core/types';
import { logger } from '../utils/logger';

/**
 * A plugin module may default-export a `Plugin` or a factory `(config) => Plugin`.
 * Plugins can contribute extractors and post-process the result.
 */
export async function loadPlugins(config: ResolvedConfig): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
  for (const spec of config.plugins) {
    try {
      const modPath = isAbsolute(spec) || spec.startsWith('.') ? resolve(config.root, spec) : spec;
      // Support both CJS and ESM plugin modules.
      let mod: any;
      try {
        mod = require(modPath);
      } catch {
        mod = await import(pathToFileURL(require.resolve(modPath, { paths: [config.root] })).href);
      }
      const exported = mod.default ?? mod;
      const plugin: Plugin = typeof exported === 'function' ? exported(config) : exported;
      if (plugin && plugin.name) {
        plugins.push(plugin);
        logger.step(`Loaded plugin: ${plugin.name}`);
      }
    } catch (err) {
      logger.warn(`Failed to load plugin "${spec}": ${(err as Error).message}`);
    }
  }
  return plugins;
}
