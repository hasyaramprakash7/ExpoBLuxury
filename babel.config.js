module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // This should be the last plugin in the list.
      'react-native-worklets/plugin',
    ],
  };
};