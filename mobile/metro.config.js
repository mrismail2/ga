// ============================================================
// Kobciye — Metro config (Phase 3)
//
// @supabase/supabase-js dynamically imports the OPTIONAL "@opentelemetry/api"
// package for tracing. It is not a real dependency of this app, so Metro's
// static resolver fails the web/native bundle trying to find it. Resolve that
// one optional specifier to an empty module (the runtime import() already
// swallows the failure with .catch(() => null)). This is the documented
// Expo + Supabase setup and changes nothing else about the default config.
// ============================================================
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const OPTIONAL_EMPTY = new Set(['@opentelemetry/api']);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (OPTIONAL_EMPTY.has(moduleName)) {
    return { type: 'empty' };
  }
  const resolver = defaultResolveRequest || context.resolveRequest;
  return resolver(context, moduleName, platform);
};

module.exports = config;
