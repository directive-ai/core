import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { 
  hasGlobalConfig, 
  setGlobalConfig, 
  createDefaultGlobalConfig,
  initializeGlobalDatabase,
  getGlobalConfigPath,
  getGlobalDbPath 
} from '../utils/global-config.js';

// Legacy interface pour projet complet (utilisée par les fonctions extractes)
interface LegacyInitOptions {
  name: string;
  author?: string;
  description?: string;
  skipInstall?: boolean;
  database?: 'json' | 'mongodb' | 'postgresql';
  local?: boolean;
}

// Nouvelle interface pour setup global seulement
interface GlobalInitOptions {
  author?: string;
  database?: 'json' | 'mongodb' | 'postgresql';
  force?: boolean;
}

/**
 * Commande directive init pour setup global de Directive
 */
export const initCommand = new Command('init')
  .description('Initialize Directive global configuration (run once per system)')
  .option('--author <author>', 'Default author name for projects')
  .option('--database <type>', 'Global database type: json (default), mongodb, postgresql')
  .option('--force', 'Force reinitialize even if config exists')
  .action(async (options?: Partial<GlobalInitOptions>) => {
    try {
      console.log(chalk.blue('🚀 Initializing Directive global setup...\n'));

      // 1. Vérifier si config globale existe déjà
      const configExists = await hasGlobalConfig();
      if (configExists && !options?.force) {
        console.log(chalk.yellow('⚠️ Directive is already initialized.'));
        console.log(chalk.gray(`Config file: ${getGlobalConfigPath()}`));
        console.log(chalk.gray(`Database: ${getGlobalDbPath()}`));
        console.log(chalk.blue('\nTo create a new project: directive create app <project-name>'));
        console.log(chalk.gray('To force reinitialize: directive init --force'));
        return;
      }

      if (configExists && options?.force) {
        console.log(chalk.yellow('🔄 Force reinitializing Directive configuration...\n'));
      }

      // 2. Collecter les préférences globales
      const globalPrefs = await collectGlobalPreferences(options);
      
      // 3. Créer la configuration globale
      const globalConfig = createDefaultGlobalConfig(globalPrefs.author);
      globalConfig.database.type = globalPrefs.database;
      
      // Adapter la config BDD selon le type
      if (globalPrefs.database === 'mongodb') {
        globalConfig.database.config = {
          url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
          database: process.env.MONGODB_DATABASE || 'directive'
        };
      } else if (globalPrefs.database === 'postgresql') {
        globalConfig.database.config = {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: parseInt(process.env.POSTGRES_PORT || '5432'),
          database: process.env.POSTGRES_DATABASE || 'directive',
          username: process.env.POSTGRES_USERNAME || 'directive',
          password: process.env.POSTGRES_PASSWORD || 'directive'
        };
      }
      
      // 4. Sauvegarder la configuration globale
      await setGlobalConfig(globalConfig);
      
      // 5. Initialiser la base de données globale
      await initializeGlobalDatabase();
      
      // 6. Afficher le message de succès
      displayGlobalSetupSuccess(globalConfig);
      
    } catch (error) {
      console.error(chalk.red('❌ Error during global initialization:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Collecte les préférences globales pour setup Directive
 */
async function collectGlobalPreferences(options?: Partial<GlobalInitOptions>): Promise<Required<GlobalInitOptions>> {
  const questions = [];

  // Auteur par défaut
  if (!options?.author) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Default author name for new projects:',
      default: 'Directive Team'
    });
  }

  // Type de base de données globale
  if (!options?.database) {
    questions.push({
      type: 'list',
      name: 'database',
      message: 'Global database type:',
      choices: [
        {
          name: 'JSON (File-based) - Recommended for development',
          value: 'json',
          short: 'JSON'
        },
        {
          name: 'MongoDB (External database)',
          value: 'mongodb',
          short: 'MongoDB'
        },
        {
          name: 'PostgreSQL (External database)',
          value: 'postgresql', 
          short: 'PostgreSQL'
        }
      ],
      default: 'json'
    });
  }

  // Si toutes les options sont fournies, pas besoin de prompt
  let answers: any = {};
  if (questions.length > 0) {
    answers = await inquirer.prompt(questions);
  }

  return {
    author: options?.author || answers.author || 'Directive Team',
    database: options?.database || answers.database || 'json',
    force: options?.force || false
  };
}

/**
 * Affiche le message de succès du setup global
 */
function displayGlobalSetupSuccess(globalConfig: any): void {
  console.log(chalk.green('\n🎉 Directive global setup completed successfully!\n'));
  
  console.log(chalk.blue('📋 Configuration:'));
  console.log(chalk.gray(`   Config file: ${getGlobalConfigPath()}`));
  console.log(chalk.gray(`   Database: ${globalConfig.database.type} at ${getGlobalDbPath()}`));
  console.log(chalk.gray(`   Default author: ${globalConfig.preferences.defaultAuthor}`));
  
  if (globalConfig.database.type !== 'json') {
    console.log(chalk.blue('\n🗄️ Database Setup:'));
    if (globalConfig.database.type === 'mongodb') {
      console.log(chalk.gray('   Make sure MongoDB is running and accessible'));
      console.log(chalk.gray('   URL: ' + globalConfig.database.config.url));
    } else if (globalConfig.database.type === 'postgresql') {
      console.log(chalk.gray('   Make sure PostgreSQL is running and accessible'));
      console.log(chalk.gray('   Host: ' + globalConfig.database.config.host + ':' + globalConfig.database.config.port));
    }
  }
  
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray('   1. Create your first project: directive create app <project-name>'));
  console.log(chalk.gray('   2. Navigate to your project: cd <project-name>'));
  console.log(chalk.gray('   3. Create your first agent: directive create agent <agent-name>'));
  console.log(chalk.gray('   4. Start the server: directive start'));
  
  console.log(chalk.blue('\n🌟 Happy coding with Directive!'));
}

/**
 * Collecte les informations du projet via prompts interactifs (LEGACY - utilisée par project-setup.ts)
 */
async function collectProjectInfo(projectName?: string, options?: Partial<LegacyInitOptions>): Promise<LegacyInitOptions> {
  const questions = [];

  // Nom du projet
  if (!projectName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'directive-agents',
      validate: (input: string) => {
        if (!input.trim()) return 'Project name is required';
        if (!/^[a-z0-9-_]+$/.test(input)) return 'Name must contain only lowercase letters, numbers, hyphens and underscores';
        return true;
      }
    });
  }

  // Auteur
  if (!options?.author) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Project author:',
      default: 'Directive Team'
    });
  }

  // Description
  if (!options?.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Project description:',
      default: (answers: any) => `Directive agents project ${answers.name || projectName}`
    });
  }

  // Type de base de données
  if (!options?.database) {
    questions.push({
      type: 'list',
      name: 'database',
      message: 'Database type:',
      choices: [
        {
          name: 'JSON (Local files) - Recommended for development',
          value: 'json',
          short: 'JSON'
        },
        {
          name: 'MongoDB (External database) - Implementation coming soon',
          value: 'mongodb',
          disabled: 'Not yet implemented in Directive Core'
        },
        {
          name: 'PostgreSQL (External database) - Implementation coming soon',
          value: 'postgresql', 
          disabled: 'Not yet implemented in Directive Core'
        }
      ],
      default: 'json'
    });
  }

  // Si toutes les options sont fournies, pas besoin de prompt
  let answers: any = {};
  if (questions.length > 0) {
    answers = await inquirer.prompt(questions);
  }

  return {
    name: projectName || answers.name,
    author: options?.author || answers.author,
    description: options?.description || answers.description,
    database: options?.database || answers.database || 'json',
    skipInstall: options?.skipInstall || false,
    local: options?.local || false
  };
}

/**
 * Crée la structure de répertoires du projet
 */
async function createProjectStructure(projectInfo: LegacyInitOptions): Promise<void> {
  console.log(chalk.yellow('📁 Creating project structure...'));

  const projectPath = path.resolve(projectInfo.name);
  
  // Vérifier que le répertoire n'existe pas déjà
  try {
    await fs.access(projectPath);
    throw new Error(`Directory ${projectInfo.name} already exists`);
  } catch (error) {
    // C'est normal qu'il n'existe pas
  }

  // Créer la structure de base
  const directories = [
    projectInfo.name,
    `${projectInfo.name}/agents`,
    `${projectInfo.name}/dist`
  ];

  // Ajouter data/ seulement pour JSON local
  if (projectInfo.database === 'json') {
    directories.push(`${projectInfo.name}/data`);
  }

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log(chalk.green(`✅ Structure created in ${projectPath}`));
}

/**
 * Génère tous les fichiers de configuration et templates
 */
async function generateProjectFiles(projectInfo: LegacyInitOptions): Promise<void> {
  console.log(chalk.yellow('📝 Generating configuration files...'));

  const projectPath = path.resolve(projectInfo.name);

  // 1. Package.json
  await generatePackageJson(projectPath, projectInfo);
  
  // 2. TypeScript configuration
  await generateTsConfig(projectPath);
  
  // 3. Webpack configuration
  await generateWebpackConfig(projectPath);
  
  // 4. Directive configuration
  await generateDirectiveConfig(projectPath, projectInfo);
  
  // 4. README du projet
  await generateProjectReadme(projectPath, projectInfo);
  
  // 5. .gitignore
  await generateGitignore(projectPath, projectInfo);

  // 6. Fichier .gitkeep pour agents (répertoire vide)
  await fs.writeFile(path.join(projectPath, 'agents/.gitkeep'), '');

  // 7. .env.example pour bases de données externes
  if (projectInfo.database !== 'json') {
    await generateEnvExample(projectPath, projectInfo);
  }

  console.log(chalk.green('✅ Configuration files generated'));
}

/**
 * Génère le package.json du projet utilisateur
 */
async function generatePackageJson(projectPath: string, projectInfo: LegacyInitOptions): Promise<void> {
  let directiveCoreVersion = '^1.0.0';
  
  // Utiliser le tarball local si demandé
  if (projectInfo.local) {
    const tarballPath = path.resolve(process.cwd(), 'directive-core-1.0.0.tgz');
    try {
      await fs.access(tarballPath);
      directiveCoreVersion = tarballPath;
    } catch {
      throw new Error(`Local tarball not found: ${tarballPath}\nRun 'npm pack' in the @directive/core directory first.`);
    }
  }

  const baseDependencies = {
    "@directive/core": directiveCoreVersion,
    "typescript": "~5.8.0",
    "xstate": "^5.20.0",
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "@types/jest": "^30.0.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "ts-loader": "^9.5.1"
  };

  // Ajouter des dépendances spécifiques selon le type de base de données
  const databaseDependencies: Record<string, Record<string, string>> = {
    json: {
      // No additional dependencies needed for JSON files
    },
    mongodb: {
      "mongodb": "^6.0.0",
      "@types/mongodb": "^4.0.7"
    },
    postgresql: {
      "pg": "^8.11.0",
      "@types/pg": "^8.10.0"
    }
  };

  const packageJson = {
    name: projectInfo.name,
    version: "1.0.0",
    description: projectInfo.description,
    author: projectInfo.author,
    main: "index.js",
    scripts: {
      "build": "webpack --mode production",
      "build:agent": "webpack --mode production --env agent",
      "dev": "webpack --mode development --watch",
      "start": "directive start",
      "dev:server": "directive start --watch",
      "agent:list": "directive agent list",
      "agent:create": "directive agent create",
      "test": "jest"
    },
    devDependencies: {
      ...baseDependencies,
      ...(databaseDependencies[projectInfo.database!] || {})
    },
    keywords: ["directive", "agents", "ai", "workflow"],
    license: "MIT"
  };

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

/**
 * Génère la configuration TypeScript
 */
async function generateTsConfig(projectPath: string): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "node",
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
      noImplicitAny: false,
      strictNullChecks: false,
      outDir: "./dist",
      baseUrl: "./",
      paths: {
        "@/*": ["./agents/*"]
      }
    },
    include: ["agents/**/*"],
    exclude: ["node_modules", "dist"]
  };

  await fs.writeFile(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
}

/**
 * Génère la configuration Webpack avec externalization
 */
async function generateWebpackConfig(projectPath: string): Promise<void> {
  const webpackConfig = `const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAgent = env && env.agent;
  
  const config = {
    mode: isProduction ? 'production' : 'development',
    
    // Entry: si agent spécifique fourni, sinon tous les agents
    entry: isAgent 
      ? \`./agents/\${env.agent}/agent.ts\`
      : './agents/**/agent.ts',
    
    externals: {
      // Externalize dependencies that will be provided by @directive/core
      'xstate': 'commonjs xstate',
      '@directive/core': 'commonjs @directive/core'
    },
    
    module: {
      rules: [
        {
          test: /\\.ts$/,
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
      filename: isAgent ? \`\${env.agent}.js\` : '[name].js',
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
`;

  await fs.writeFile(
    path.join(projectPath, 'webpack.config.js'),
    webpackConfig
  );
}

/**
 * Génère la configuration Directive
 */
async function generateDirectiveConfig(projectPath: string, projectInfo: LegacyInitOptions): Promise<void> {
  const databaseConfigs = {
    json: {
      type: 'json' as const,
      config: {
        dataDir: './data'
      }
    },
    mongodb: {
      type: 'mongodb' as const,
      config: {
        url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
        database: process.env.MONGODB_DATABASE || projectInfo.name
      }
    },
    postgresql: {
      type: 'postgresql' as const,
      config: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || projectInfo.name,
        username: process.env.POSTGRES_USERNAME || 'directive',
        password: process.env.POSTGRES_PASSWORD || 'directive'
      }
    }
  };

  const databaseConfig = databaseConfigs[projectInfo.database!];

  const config = `// Directive configuration for ${projectInfo.name}
export const directiveConfig = {
  // Server configuration
  server: {
    port: 3000,
    host: 'localhost'
  },

  // Agents configuration
  agents: {
    autoScan: true,
    scanPath: './agents',
    hotReload: true
  },

  // Database configuration
  database: ${JSON.stringify(databaseConfig, null, 4).replace(/"/g, "'")},

  // IAM configuration
  iam: {
    type: 'mock' as const
  },

  // Project metadata
  project: {
    name: '${projectInfo.name}',
    author: '${projectInfo.author}',
    description: '${projectInfo.description}',
    version: '1.0.0'
  }
};

export default directiveConfig;
`;

  await fs.writeFile(
    path.join(projectPath, 'directive-conf.ts'),
    config
  );
}

/**
 * Génère le README.md du projet
 */
async function generateProjectReadme(projectPath: string, projectInfo: LegacyInitOptions): Promise<void> {
  const readmeContent = `# ${projectInfo.name}

${projectInfo.description}

## Overview

This is a **Directive** project that orchestrates AI agents using state machines (XState).

**Author**: ${projectInfo.author}  
**Version**: 1.0.0

## Project Structure

\`\`\`
${projectInfo.name}/
├── agents/                    # AI agents directory (currently empty)
│   └── .gitkeep              # Placeholder file
├── data/                     # Local JSON database${projectInfo.database !== 'json' ? ' [Not used with current DB]' : ''}
├── directive-conf.ts         # Directive configuration
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
\`\`\`

## Quick Start

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Create Your First Application
\`\`\`bash
# Create an application to group your agents
directive create app my-app
\`\`\`

### 3. Create Your First Agent
\`\`\`bash
# Create an agent within your application
directive create agent --app my-app --name my-agent
\`\`\`

### 4. Start the Server
\`\`\`bash
npm run dev
# or directly:
directive start
\`\`\`

### 5. Test Your Agent
Once the server is running, you can interact with your agents via REST API:

\`\`\`bash
# Create a session with your agent
curl -X POST http://localhost:3000/sessions \\
  -H "Content-Type: application/json" \\
  -d '{"agent_type": "my-app/my-agent"}'

# List all available agents
curl http://localhost:3000/agents
\`\`\`

## Database Configuration

**Current database**: ${getDatabaseDescription(projectInfo.database!)}

${getDatabaseSetupInstructions(projectInfo.database!)}

## Available Commands

### Application Management
\`\`\`bash
directive create app <app-name>          # Create a new application
\`\`\`

### Agent Management
\`\`\`bash
directive create agent                   # Create a new agent (interactive)
directive create agent --app <app> --name <agent>  # Create agent with options
directive agent list                     # List all agents
directive agent list --app <app>        # List agents in specific application
\`\`\`

### Server Management
\`\`\`bash
directive start                          # Start the Directive server
directive start --port 3001             # Start on custom port
\`\`\`

### Development
\`\`\`bash
npm run dev                              # Start server in development mode
npm run build                           # Build the project
npm test                                # Run tests
\`\`\`

## Next Steps

1. **Explore the generated agent**: Check \`agents/<app>/<agent>/agent.ts\` to see the XState machine
2. **Read agent documentation**: Each agent has a \`desc.mdx\` file with detailed documentation
3. **Customize your agents**: Modify the state machines to implement your business logic
4. **Test via API**: Use the REST endpoints to interact with your agents

## Learn More

- **Directive Documentation**: [Link to docs]
- **XState Documentation**: https://xstate.js.org/
- **Agent Development Guide**: [Link to guide]

---

Your Directive project is ready! 🚀

Create your first application and agent to get started:
\`\`\`bash
directive create app my-app
directive create agent --app my-app --name my-first-agent
\`\`\`
`;

  await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);
}

/**
 * Génère le .gitignore
 */
async function generateGitignore(projectPath: string, projectInfo: LegacyInitOptions): Promise<void> {
  let gitignore = `# Dependencies
node_modules/
npm-debug.log*

# Build
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
`;

  // Ajouter exclusions spécifiques pour JSON local
  if (projectInfo.database === 'json') {
    gitignore += `
# Local JSON Database
data/*.json
!data/.gitkeep
`;
  }

  await fs.writeFile(
    path.join(projectPath, '.gitignore'),
    gitignore
  );
}

/**
 * Installe les dépendances NPM
 */
async function installDependencies(projectName: string): Promise<void> {
  console.log(chalk.yellow('📦 Installing dependencies...'));
  
  const projectPath = path.resolve(projectName);
  
  try {
    execSync('npm install', { 
      cwd: projectPath, 
      stdio: 'inherit' 
    });
    console.log(chalk.green('✅ Dependencies installed'));
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Error installing dependencies'));
    console.log(chalk.gray('You can install them manually with: cd ' + projectName + ' && npm install'));
  }
}

/**
 * Affiche le message de succès final
 */
function displaySuccessMessage(projectInfo: LegacyInitOptions): void {
  const databaseMessages = {
    json: chalk.green('✅ Local JSON database configured'),
    mongodb: chalk.yellow('⚠️  MongoDB connection configured - make sure MongoDB is running'),
    postgresql: chalk.yellow('⚠️  PostgreSQL connection configured - make sure PostgreSQL is running')
  };

  const databaseSetup = {
    json: '',
    mongodb: `${chalk.blue('\n🗄️  MongoDB Setup:')}
   ${chalk.gray('export MONGODB_URL="mongodb://localhost:27017"')}
   ${chalk.gray('export MONGODB_DATABASE="' + projectInfo.name + '"')}`,
    postgresql: `${chalk.blue('\n🗄️  PostgreSQL Setup:')}
   ${chalk.gray('export POSTGRES_HOST="localhost"')}
   ${chalk.gray('export POSTGRES_PORT="5432"')}  
   ${chalk.gray('export POSTGRES_DATABASE="' + projectInfo.name + '"')}
   ${chalk.gray('export POSTGRES_USERNAME="directive"')}
   ${chalk.gray('export POSTGRES_PASSWORD="directive"')}`
  };

  console.log(chalk.green('\n🎉 Directive project created successfully!'));
  console.log(databaseMessages[projectInfo.database!]);
  
  if (projectInfo.local) {
    console.log(chalk.yellow('🔧 Using local development version of @directive/core'));
  }
  
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.gray('   cd ' + projectInfo.name));
  console.log(chalk.gray('   npm install'));
  console.log(chalk.gray('   directive create app <app-name>              # Create your first app'));
  console.log(chalk.gray('   directive create agent                       # Create your first agent'));
  console.log(chalk.gray('   directive start                              # Start the server'));
  
  console.log(chalk.blue('\n🌐 Server:'));
  console.log(chalk.gray('   The server will start on http://localhost:3000'));
  
  console.log(chalk.blue('\n📚 Documentation:'));
  console.log(chalk.gray('   cat ' + projectInfo.name + '/README.md'));
  
  console.log(chalk.yellow('\n⚠️  Note: Your project starts empty. Create your first application and agent to get started!'));
}

/**
 * Génère le fichier .env.example pour les bases de données externes
 */
async function generateEnvExample(projectPath: string, projectInfo: LegacyInitOptions): Promise<void> {
  const envTemplates = {
    mongodb: `# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=${projectInfo.name}

# Optional MongoDB authentication
# MONGODB_USERNAME=your_username
# MONGODB_PASSWORD=your_password
`,
    postgresql: `# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=${projectInfo.name}
POSTGRES_USERNAME=directive
POSTGRES_PASSWORD=directive

# Optional SSL configuration
# POSTGRES_SSL=true
# POSTGRES_SSL_REJECT_UNAUTHORIZED=false
`
  };

  const envContent = envTemplates[projectInfo.database as keyof typeof envTemplates];
  
  if (envContent) {
    await fs.writeFile(
      path.join(projectPath, '.env.example'),
      envContent
    );
  }
}

/**
 * Retourne la description de la base de données
 */
function getDatabaseDescription(dbType: string): string {
  const descriptions: Record<string, string> = {
    json: 'JSON files (local file-based)',
    mongodb: 'MongoDB (disabled: not yet implemented)',
    postgresql: 'PostgreSQL (disabled: not yet implemented)'
  };
  return descriptions[dbType] || descriptions.json;
}

/**
 * Retourne les instructions de setup pour la base de données
 */
function getDatabaseSetupInstructions(dbType: string): string {
  const instructions: Record<string, string> = {
    json: `Your project uses **JSON files** for local development.
- Database files are stored in the \`data/\` directory
- No additional setup required - just run \`npm install\``,
    
    mongodb: `⚠️  **MongoDB support is planned but not yet implemented.**
- Copy \`.env.example\` to \`.env\`
- Configure your MongoDB connection string
- Install MongoDB locally or use MongoDB Atlas`,
    
    postgresql: `⚠️  **PostgreSQL support is planned but not yet implemented.**
- Copy \`.env.example\` to \`.env\`
- Configure your PostgreSQL connection settings
- Install PostgreSQL locally or use a cloud provider`
  };
  return instructions[dbType] || instructions.json;
} 