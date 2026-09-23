/** Extractor registry: the built-in set. */
import type { Extractor } from '../core/types';
import { ComponentExtractor } from './componentExtractor';
import { HookExtractor } from './hookExtractor';
import { UtilExtractor } from './utilExtractor';
import { ContextExtractor } from './contextExtractor';
import { RouteExtractor } from './routeExtractor';

export function builtinExtractors(): Extractor[] {
  return [
    new ComponentExtractor(),
    new HookExtractor(),
    new ContextExtractor(),
    new RouteExtractor(),
    // Utility runs LAST so it can defer to the more specific extractors above
    // (it already self-excludes components/hooks, but ordering keeps intent clear).
    new UtilExtractor(),
  ];
}
