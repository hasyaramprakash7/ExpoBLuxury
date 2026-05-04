// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Use the modern, recommended plugin name only.
      // Remove any 'react-native-reanimated/plugin' lines.
      'react-native-worklets/plugin',
    ],
  };
};