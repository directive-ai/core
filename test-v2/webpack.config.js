const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAgent = env && env.agent;
  
  const config = {
    mode: isProduction ? 'production' : 'development',
    
    // Entry: si agent spécifique fourni, sinon tous les agents
    entry: isAgent 
      ? `./agents/${env.agent}/agent.ts`
      : './agents/**/agent.ts',
    
    externals: {
      // Externalize dependencies that will be provided by @directive/core
      'xstate': 'commonjs xstate',
      '@directive/core': 'commonjs @directive/core'
    },
    
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Ignore TypeScript errors
              compilerOptions: {
                strict: false,
                noImplicitAny: false,
                strictNullChecks: false
              }
            }
          },
          exclude: /node_modules/,
        },
      ],
    },
    
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'agents')
      }
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isAgent ? `${env.agent}.js` : '[name].js',
      library: 'Agent',
      libraryTarget: 'commonjs2',
      clean: true
    },
    
    target: 'node',
    
    optimization: {
      minimize: isProduction
    },
    
    devtool: isProduction ? false : 'source-map'
  };
  
  return config;
};
