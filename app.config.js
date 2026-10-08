module.exports = ({ config }) => {
  const development = process.env.APP_VARIANT === "development";
  return {
    ...config,
    name: development ? "YearBook Dev" : config.name,
    scheme: development ? "yearbookapp-dev" : config.scheme,
    android: {
      ...config.android,
      package: development ? "com.lieber.yearbookapp.dev" : config.android.package,
    },
  };
};
