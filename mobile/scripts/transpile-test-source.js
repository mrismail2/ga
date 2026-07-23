#!/usr/bin/env node
/*
 * Compile application JavaScript to a disposable CommonJS tree for Node
 * tests. The project already depends on Babel through Expo, so the test suite
 * does not need a separate esbuild executable or an npx download.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

// Some interrupted/offline npm installs leave caniuse-lite's large data tree
// in place but omit these two optional Browserslist unpackers. Babel loads
// Browserslist while building its config even though this test compiler does
// not set browser targets. Supply inert fallbacks only when the real files are
// genuinely absent; a complete npm install always uses the package versions.
function loadBabelTooling() {
  const originalLoad = Module._load;
  Module._load = function loadWithOfflineCaniuseFallback(request, parent, isMain) {
    if (request === 'caniuse-lite/dist/unpacker/feature'
        || request === 'caniuse-lite/dist/unpacker/region') {
      try { return originalLoad.call(this, request, parent, isMain); }
      catch (error) {
        if (!error || error.code !== 'MODULE_NOT_FOUND') throw error;
        return { default: () => ({}) };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    // Preload the lazy target resolver while the guarded fallback is active.
    require('@babel/helper-compilation-targets');
    return {
      babel: require('@babel/core'),
      transformModulesCommonJs: require('@babel/plugin-transform-modules-commonjs'),
      transformReactJsx: require('@babel/plugin-transform-react-jsx'),
    };
  } finally {
    Module._load = originalLoad;
  }
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function transpileSourceTree(projectRoot, outputRoot) {
  const { babel, transformModulesCommonJs, transformReactJsx } = loadBabelTooling();
  const project = path.resolve(projectRoot);
  const sourceRoot = path.join(project, 'src');
  const output = path.resolve(outputRoot);
  const tempRoot = path.resolve(os.tmpdir());

  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`source directory not found: ${sourceRoot}`);
  }
  // Every caller writes to os.tmpdir(). Keep recursive cleanup constrained
  // there so a typo can never remove project or user files.
  if (!isInside(tempRoot, output) || output === tempRoot) {
    throw new Error(`test transpile output must be a child of ${tempRoot}`);
  }

  fs.rmSync(output, { recursive: true, force: true });

  function visit(sourceDir, targetDir) {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath, targetPath);
      } else if (entry.isFile() && /\.jsx?$/.test(entry.name)) {
        const result = babel.transformSync(fs.readFileSync(sourcePath, 'utf8'), {
          babelrc: false,
          configFile: false,
          filename: sourcePath,
          sourceType: 'unambiguous',
          plugins: [
            [transformReactJsx, { runtime: 'classic' }],
            transformModulesCommonJs,
          ],
        });
        if (!result || typeof result.code !== 'string') {
          throw new Error(`Babel produced no output for ${sourcePath}`);
        }
        fs.writeFileSync(targetPath, result.code, 'utf8');
      } else if (entry.isFile()) {
        // Preserve JSON and other data assets used by relative requires.
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }

  const compiledSourceRoot = path.join(output, 'src');
  visit(sourceRoot, compiledSourceRoot);
  return compiledSourceRoot;
}

module.exports = { transpileSourceTree };
