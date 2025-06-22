import chalk from 'chalk';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { 
  hasGlobalConfig, 
  getGlobalConfig, 
  generateAppConfig,
  validateDirectiveProject 
} from '../utils/global-config.js';
import {
  ProjectOptions,
  createProjectStructure,
  generatePackageJson,
  generateTsConfig,
  generateWebpackConfig,
  generateGitignore,
  installDependencies
} from '../utils/project-setup.js';

interface CreateAppOptions {
  author?: string;
  description?: string;
  skipInstall?: boolean;
  local?: boolean;
}

/**
 * Commande directive create app pour créer une nouvelle application
 */
export const createAppCommand = new Command('app')
  .description('Create a new Directive application/project')
  .argument('[app-name]', 'Name of the application to create')
  .option('--author <author>', 'Application author (default from global config)')
  .option('--description <description>', 'Application description')
  .option('--skip-install', 'Skip automatic npm install')
  .option('--local', 'Use local development version of @directive/core (requires tarball)')
  .action(async (appName?: string, options?: Partial<CreateAppOptions>) => {
    try {
      console.log(chalk.blue('📱 Creating new Directive application...\n'));

      // 1. Vérifier que la configuration globale existe
      if (!(await hasGlobalConfig())) {
        console.error(chalk.red('❌ Directive is not initialized globally.'));
        console.log(chalk.gray('Run "directive init" first to setup global configuration.'));
        process.exit(1);
      }

      // 2. Lire la configuration globale pour les defaults
      const globalConfig = await getGlobalConfig();

      // 3. Collecter les informations de l'application
      const appInfo = await collectAppInfo(appName, options, globalConfig);
      
      // 4. Créer la structure du projet 
      await createProjectStructure(appInfo);
      
      // 5. Générer les fichiers de configuration
      await generateApplicationFiles(appInfo, globalConfig);
      
      // 6. Installer les dépendances
      if (!appInfo.skipInstall) {
        await installDependencies(appInfo.name);
      }
      
      // 7. Afficher le message de succès
      displayAppCreationSuccess(appInfo);
      
    } catch (error) {
      console.error(chalk.red('❌ Error creating application:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Collecte les informations de l'application
 */
async function collectAppInfo(
  appName?: string, 
  options?: Partial<CreateAppOptions>,
  globalConfig?: any
): Promise<ProjectOptions> {
  const questions = [];

  // Nom de l'application
  if (!appName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Application name:',
      default: 'my-directive-app',
      validate: (input: string) => {
        if (!input.trim()) return 'Application name is required';
        if (!/^[a-z0-9-_]+$/.test(input)) return 'Name must contain only lowercase letters, numbers, hyphens and underscores';
        return true;
      }
    });
  }

  // Auteur (utilise default global si non spécifié)
  if (!options?.author) {
    const defaultAuthor = globalConfig?.preferences?.defaultAuthor || 'Directive Team';
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: defaultAuthor
    });
  }

  // Description
  if (!options?.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: (answers: any) => `Directive agents application ${answers.name || appName}`
    });
  }

  // Si toutes les options sont fournies, pas besoin de prompt
  let answers: any = {};
  if (questions.length > 0) {
    answers = await inquirer.prompt(questions);
  }

  return {
    name: appName || answers.name,
    author: options?.author || answers.author || globalConfig?.preferences?.defaultAuthor || 'Directive Team',
    description: options?.description || answers.description,
    database: globalConfig?.database?.type || 'json', // Database depuis config globale
    skipInstall: options?.skipInstall || false,
    local: options?.local || false
  };
}

/**
 * Génère tous les fichiers de configuration de l'application
 */
async function generateApplicationFiles(appInfo: ProjectOptions, globalConfig: any): Promise<void> {
  console.log(chalk.yellow('📝 Generating application files...'));

  const projectPath = appInfo.name;

  // 1. Package.json (identique, réutilise fonction)
  await generatePackageJson(projectPath, appInfo);
  
  // 2. TypeScript configuration (identique)
  await generateTsConfig(projectPath);
  
  // 3. Webpack configuration (identique)
  await generateWebpackConfig(projectPath);
  
  // 4. Configuration Directive APP (NOUVELLE - métadonnées seulement)
  await generateAppConfig(projectPath, {
    name: appInfo.name,
    author: appInfo.author || 'Directive Team',
    description: appInfo.description || '',
    version: '1.0.0'
  }, globalConfig);
  
  // 5. README du projet (adapté)
  await generateAppReadme(projectPath, appInfo);
  
  // 6. .gitignore (v2.0 - plus de BDD locale)
  await generateGitignore(projectPath, appInfo);

  // 7. Fichier .gitkeep pour agents (répertoire vide)
  const fs = await import('fs/promises');
  await fs.writeFile(`${projectPath}/agents/.gitkeep`, '');

  console.log(chalk.green('✅ Application files generated'));
}

/**
 * Génère le README.md de l'application (version simplifiée)
 */
async function generateAppReadme(projectPath: string, appInfo: ProjectOptions): Promise<void> {
  const readmeContent = `# ${appInfo.name}

${appInfo.description}

## Overview

This is a **Directive application** that orchestrates AI agents using state machines (XState).

**Author**: ${appInfo.author}  
**Version**: 1.0.0

## Project Structure

\`\`\`
${appInfo.name}/
├── agents/                    # AI agents directory (currently empty)
│   └── .gitkeep              # Placeholder file
├── directive-conf.ts         # Application configuration (metadata only)
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
\`\`\`

## Quick Start

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Create Your First Agent
\`\`\`bash
# Create an agent directly (no more sub-applications)
directive create agent my-agent
\`\`\`

### 3. Start the Server
\`\`\`bash
npm run dev
# or directly:
directive start
\`\`\`

### 4. Test Your Agent
Once the server is running, you can interact with your agents via REST API:

\`\`\`bash
# Create a session with your agent
curl -X POST http://localhost:3000/sessions \\
  -H "Content-Type: application/json" \\
  -d '{"agent_type": "${appInfo.name}/my-agent"}'

# List all available agents
curl http://localhost:3000/agents
\`\`\`

## New Architecture (v2.0)

This application uses the new **simplified Directive architecture**:

- ✅ **Global configuration**: \`~/.directive/config.json\`
- ✅ **Global database**: \`~/.directive/data/\`  
- ✅ **Project = Application**: No more sub-applications
- ✅ **Direct agents**: \`agents/my-agent/\` instead of \`agents/app/agent/\`

## Available Commands

### Agent Management
\`\`\`bash
directive create agent <name>           # Create a new agent directly  
directive deploy agent <name>           # Deploy agent (with versioning)
directive list agents                   # List all agents
\`\`\`

### Server Management  
\`\`\`bash
directive start                         # Start the Directive server
directive start --port 3001            # Start on custom port
\`\`\`

### Development
\`\`\`bash
npm run dev                             # Start server in development mode
npm run build                          # Build the project
npm test                               # Run tests
\`\`\`

## Next Steps

1. **Create your first agent**: \`directive create agent my-agent\`
2. **Deploy your agent**: \`directive deploy agent my-agent\`
3. **Test via API**: Use the REST endpoints to create sessions
4. **Monitor deployments**: \`directive deploy history\`

---

Your Directive application is ready! 🚀

Create your first agent to get started:
\`\`\`bash
directive create agent my-first-agent
\`\`\`
`;

  const fs = await import('fs/promises');
  await fs.writeFile(`${projectPath}/README.md`, readmeContent);
}

/**
 * Affiche le message de succès de création d'application
 */
function displayAppCreationSuccess(appInfo: ProjectOptions): void {
  console.log(chalk.green('\n🎉 Directive application created successfully!\n'));
  
  console.log(chalk.blue('📋 Application Details:'));
  console.log(chalk.gray(`   Name: ${appInfo.name}`));
  console.log(chalk.gray(`   Author: ${appInfo.author}`));
  console.log(chalk.gray(`   Description: ${appInfo.description}`));
  
  console.log(chalk.blue('\n🏗️ Architecture:'));
  console.log(chalk.gray('   ✅ Global config: ~/.directive/config.json'));
  console.log(chalk.gray('   ✅ Global database: ~/.directive/data/'));
  console.log(chalk.gray('   ✅ App metadata: ./directive-conf.ts'));
  
  console.log(chalk.blue('\n📚 Next steps:'));
  console.log(chalk.gray(`   1. cd ${appInfo.name}`));
  
  if (appInfo.skipInstall) {
    console.log(chalk.gray('   2. npm install'));
    console.log(chalk.gray('   3. directive create agent <agent-name>'));
    console.log(chalk.gray('   4. directive start'));
  } else {
    console.log(chalk.gray('   2. directive create agent <agent-name>'));
    console.log(chalk.gray('   3. directive start'));
  }
  
  console.log(chalk.blue('\n🌟 Happy coding with Directive v2.0!'));
} 