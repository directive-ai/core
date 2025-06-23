import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

export interface ProjectOptions {
  name: string;
  author?: string;
  description?: string;
  skipInstall?: boolean;
  database?: 'json' | 'mongodb' | 'postgresql';
  local?: boolean;
}

/**
 * Collecte les informations du projet via prompts interactifs
 */
export async function collectProjectInfo(projectName?: string, options?: Partial<ProjectOptions>): Promise<ProjectOptions> {
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
export async function createProjectStructure(projectInfo: ProjectOptions): Promise<void> {
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

  // NOTE: Plus de répertoire data/ local dans v2.0 - la base de données est globale ~/.directive/data/

  for (const dir of directories) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log(chalk.green(`✅ Structure created in ${projectPath}`));
}

/**
 * Génère le package.json du projet utilisateur (v2.0 - SDK seulement)
 */
export async function generatePackageJson(projectPath: string, projectInfo: ProjectOptions): Promise<void> {
  let directiveSdkVersion = '^1.0.0';
  
  // Utiliser le tarball local si demandé (pour développement)
  if (projectInfo.local) {
    const tarballPath = path.resolve(process.cwd(), '../sdk/directive-sdk-1.0.0.tgz');
    try {
      await fs.access(tarballPath);
      directiveSdkVersion = tarballPath;
    } catch {
      console.warn(`Local SDK tarball not found: ${tarballPath}. Using npm version.`);
    }
  }

  // Architecture v2.0 : Projets utilisent SEULEMENT le SDK
  // Le Core est installé globalement et fournit le CLI + serveur
  const baseDependencies = {
    "@directive/sdk": directiveSdkVersion,   // Types + Webpack + Outils dev
    "typescript": "~5.8.0",
    "xstate": "^5.20.0",                     // Runtime pour les machines
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "@types/jest": "^30.0.0"
    // Note: @directive/core est installé globalement
    // Note: webpack fourni par @directive/sdk
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
      "start": "directive start",              // CLI global @directive/core
      "dev:server": "directive start --watch", // CLI global @directive/core
      "list": "directive list agents",         // CLI global @directive/core
      "create": "directive create agent",      // CLI global @directive/core
      "deploy": "directive deploy agent",      // CLI global @directive/core
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
export async function generateTsConfig(projectPath: string): Promise<void> {
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
 * Génère la configuration Webpack utilisant @directive/sdk
 */
export async function generateWebpackConfig(projectPath: string): Promise<void> {
  const webpackConfig = `const { createWebpackConfig } = require('@directive/sdk/webpack');

// Configuration Webpack optimisée par @directive/sdk (Architecture v2.0)
module.exports = (env, argv) => {
  return createWebpackConfig({
    mode: argv.mode || 'development',
    
    // Entry: si agent spécifique fourni, sinon tous les agents
    entry: env && env.agent 
      ? \`./agents/\${env.agent}/agent.ts\`
      : './agents/**/agent.ts',
    
    // Le SDK gère automatiquement :
    // - Externalisation de XState (fourni par le runtime)
    // - Types TypeScript depuis @directive/types
    // - Configuration optimale pour les agents
    
    // Personnalisation possible si nécessaire
    // customize: {
    //   externals: { /* externals additionnels */ },
    //   alias: { /* alias additionnels */ }
    // }
  });
};

// Configuration simple alternative (sans SDK)
// Décommentez si vous voulez une configuration webpack basique
/*
const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAgent = env && env.agent;
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: isAgent ? \`./agents/\${env.agent}/agent.ts\` : './agents/*//**/agent.ts',
    externals: {
      'xstate': 'commonjs xstate'
      // Note: Plus besoin d'externaliser @directive/core en v2.0
      // Les agents utilisent seulement @directive/sdk pour les types
    },
    module: {
      rules: [{
        test: /\\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isAgent ? \`\${env.agent}.js\` : '[name].js',
      library: 'Agent',
      libraryTarget: 'commonjs2',
      clean: true
    },
    target: 'node'
  };
};
*/
`;

  await fs.writeFile(
    path.join(projectPath, 'webpack.config.js'),
    webpackConfig
  );
}

/**
 * Génère le fichier .gitignore
 */
export async function generateGitignore(projectPath: string, projectInfo: ProjectOptions): Promise<void> {
  const gitignoreContent = `# Dependencies
node_modules/
package-lock.json

# Build outputs
dist/
*.tgz

# Environment files
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Database files  
# Note: Database is now global in ~/.directive/data/ (v2.0)

# Coverage directory used by tools like istanbul
coverage/

# Test outputs
test-results/
`;

  await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
}

/**
 * Installe les dépendances NPM
 */
export async function installDependencies(projectName: string): Promise<void> {
  console.log(chalk.yellow('📦 Installing dependencies...'));
  
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    const projectPath = path.resolve(projectName);
    const npmInstall = spawn('npm', ['install'], {
      cwd: projectPath,
      stdio: 'pipe'
    });

    npmInstall.stdout?.on('data', (data) => {
      process.stdout.write(chalk.gray(data.toString()));
    });

    npmInstall.stderr?.on('data', (data) => {
      process.stderr.write(chalk.yellow(data.toString()));
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Dependencies installed successfully'));
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    npmInstall.on('error', (error) => {
      reject(new Error(`Failed to start npm install: ${error.message}`));
    });
  });
}

/**
 * Génère le fichier .env.example pour les bases de données externes
 */
export async function generateEnvExample(projectPath: string, projectInfo: ProjectOptions): Promise<void> {
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