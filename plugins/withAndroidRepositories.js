const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidRepositories(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = config.modResults.contents.replace(
        /jcenter\(\)/g,
        'mavenCentral()'
      );
    }
    return config;
  });
};