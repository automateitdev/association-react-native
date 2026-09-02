// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

/**
 * HeroUI Native styles through Uniwind, and Uniwind needs Metro to compile the
 * CSS entry file into the style objects its components expect. Without this the
 * components render unstyled - which looks like a broken layout rather than a
 * missing build step, so it is worth stating plainly.
 *
 * The Reanimated wrapper must be applied first: HeroUI depends on Reanimated 4,
 * which needs its own Metro transform.
 */
const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind.d.ts',
});
