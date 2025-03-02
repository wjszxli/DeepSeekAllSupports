module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            // Remove any babel options from here if they're already in babel.config.js
            // Don't repeat @babel/plugin-transform-runtime here
          }
        }
      },
      // Other rules...
    ]
  }
};