import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

interface InitOptions {
  name: string;
  author?: string;
  description?: string;
  skipInstall?: boolean;
  database?: 'json' | 'mongodb' | 'postgresql';
}

/**
 * Commande directive init pour créer un nouveau projet d'agents directeurs
 */
export const initCommand = new Command('init')
  .description('Initialize a new Directive project')
  .argument('[project-name]', 'Name of the project to create')
  .option('--author <author>', 'Project author')
  .option('--description <description>', 'Project description')
  .option('--database <type>', 'Database type: json (default), mongodb, postgresql')
  .option('--skip-install', 'Skip automatic npm install')
  .action(async (projectName?: string, options?: Partial<InitOptions>) => {
    try {
      console.log(chalk.blue('🚀 Initializing new Directive project...\n'));

      // 1. Collecter les informations du projet
      const projectInfo = await collectProjectInfo(projectName, options);
      
      // 2. Créer la structure du projet
      await createProjectStructure(projectInfo);
      
      // 3. Générer les fichiers de configuration
      await generateProjectFiles(projectInfo);
      
      // 4. Installer les dépendances
      if (!projectInfo.skipInstall) {
        await installDependencies(projectInfo.name);
      }
      
      // 5. Afficher les instructions finales
      displaySuccessMessage(projectInfo);
      
    } catch (error) {
      console.error(chalk.red('❌ Error during initialization:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Collecte les informations du projet via prompts interactifs
 */
async function collectProjectInfo(projectName?: string, options?: Partial<InitOptions>): Promise<InitOptions> {
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
          name: 'JSON (Local files with LowDB) - Recommended for development',
          value: 'json',
          short: 'JSON/LowDB'
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

  const answers = await inquirer.prompt(questions);

  return {
    name: projectName || answers.name,
    author: options?.author || answers.author,
    description: options?.description || answers.description,
    database: options?.database || answers.database || 'json',
    skipInstall: options?.skipInstall || false
  };
}

/**
 * Crée la structure de répertoires du projet
 */
async function createProjectStructure(projectInfo: InitOptions): Promise<void> {
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
    `${projectInfo.name}/agents`
  ];

  // Ajouter data/ seulement pour JSON/LowDB
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
async function generateProjectFiles(projectInfo: InitOptions): Promise<void> {
  console.log(chalk.yellow('📝 Generating configuration files...'));

  const projectPath = path.resolve(projectInfo.name);

  // 1. Package.json
  await generatePackageJson(projectPath, projectInfo);
  
  // 2. TypeScript configuration
  await generateTsConfig(projectPath);
  
  // 3. Directive configuration
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
async function generatePackageJson(projectPath: string, projectInfo: InitOptions): Promise<void> {
  const baseDependencies = {
    "@directive/core": "^1.0.0",
    "typescript": "~5.8.0",
    "xstate": "^5.20.0",
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "@types/jest": "^30.0.0"
  };

  // Ajouter des dépendances spécifiques selon le type de base de données
  const databaseDependencies: Record<string, Record<string, string>> = {
    json: {
      "lowdb": "^7.0.1"
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
      "build": "tsc",
      "start": "directive start",
      "dev": "directive start --watch",
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
      strict: true,
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
 * Génère la configuration Directive
 */
async function generateDirectiveConfig(projectPath: string, projectInfo: InitOptions): Promise<void> {
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
 * Génère le README du projet
 */
async function generateProjectReadme(projectPath: string, projectInfo: InitOptions): Promise<void> {
  const databaseDescriptions = {
    json: '- `data/` : Local JSON database (sessions, agent states)',
    mongodb: '- Database: MongoDB (configured via environment variables)',
    postgresql: '- Database: PostgreSQL (configured via environment variables)'
  };

  const databaseInstructions = {
    json: `## Database

This project uses **LowDB** for local JSON storage. Data files are stored in the \`data/\` directory.

No additional setup required - the database files are created automatically.`,
    mongodb: `## Database

This project uses **MongoDB** for data storage. Configure your connection via environment variables:

\`\`\`bash
export MONGODB_URL="mongodb://localhost:27017"
export MONGODB_DATABASE="${projectInfo.name}"
\`\`\`

Make sure MongoDB is running before starting the server.`,
    postgresql: `## Database

This project uses **PostgreSQL** for data storage. Configure your connection via environment variables:

\`\`\`bash
export POSTGRES_HOST="localhost"
export POSTGRES_PORT="5432"
export POSTGRES_DATABASE="${projectInfo.name}"
export POSTGRES_USERNAME="directive"
export POSTGRES_PASSWORD="directive"
\`\`\`

Make sure PostgreSQL is running and the database exists before starting the server.`
  };

  const readme = `# ${projectInfo.name}

${projectInfo.description}

## Installation

\`\`\`bash
npm install
\`\`\`

${databaseInstructions[projectInfo.database!]}

## Getting Started

Your Directive project is ready! To get started:

### 1. Create your first application
\`\`\`bash
npm run agent:create <app-name> <agent-name>
\`\`\`

### 2. Start the Directive server
\`\`\`bash
npm run dev
\`\`\`

The server will start on http://localhost:3000 and automatically scan for agents in the \`agents/\` directory.

### 3. List available agents
\`\`\`bash
npm run agent:list
\`\`\`

## Project Structure

- \`agents/\` : AI agents organized by application
${databaseDescriptions[projectInfo.database!]}
- \`directive-conf.ts\` : Server configuration

## API Usage

Once you have created agents, you can interact with them via the REST API:

\`\`\`bash
# List available agents
curl http://localhost:3000/agents

# Create a session
curl -X POST http://localhost:3000/sessions \\
  -H "Content-Type: application/json" \\
  -d '{"agent_type": "your-app/your-agent"}'

# Send events to session
curl -X POST http://localhost:3000/sessions/SESSION_ID/events \\
  -H "Content-Type: application/json" \\
  -d '{"event": "EVENT_NAME", "data": {...}}'
\`\`\`

## Development

This project uses [Directive](https://github.com/directive-ai/core) for AI agents orchestration.

Created by: ${projectInfo.author}
`;

  await fs.writeFile(
    path.join(projectPath, 'README.md'),
    readme
  );
}

/**
 * Génère le .gitignore
 */
async function generateGitignore(projectPath: string, projectInfo: InitOptions): Promise<void> {
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

  // Ajouter exclusions spécifiques pour JSON/LowDB
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
function displaySuccessMessage(projectInfo: InitOptions): void {
  const databaseMessages = {
    json: chalk.green('✅ Local JSON database configured (LowDB)'),
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
  
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.gray(`   cd ${projectInfo.name}`));
  
  if (projectInfo.skipInstall) {
    console.log(chalk.gray('   npm install'));
  }
  
  if (databaseSetup[projectInfo.database!]) {
    console.log(databaseSetup[projectInfo.database!]);
  }
  
  console.log(chalk.gray('   npm run agent:create <app-name> <agent-name>  # Create your first agent'));
  console.log(chalk.gray('   npm run dev                                   # Start the server'));
  
  console.log(chalk.blue('\n🌐 Server:'));
  console.log(chalk.gray('   The server will start on http://localhost:3000'));
  
  console.log(chalk.blue('\n📚 Documentation:'));
  console.log(chalk.gray(`   cat ${projectInfo.name}/README.md`));
  
  console.log(chalk.yellow('\n⚠️  Note: Your project starts empty. Create your first agent to get started!'));
}

/**
 * Génère le fichier .env.example pour les bases de données externes
 */
async function generateEnvExample(projectPath: string, projectInfo: InitOptions): Promise<void> {
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