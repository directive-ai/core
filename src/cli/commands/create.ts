import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Application, CreateApplicationRequest } from '../../dto/index.js';

interface CreateAppOptions {
  name?: string;
  description?: string;
  author?: string;
}

/**
 * Application card simplifiée pour la CLI (correspond au fichier index.json)
 */
interface ApplicationCard {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  agents: string[];  // Liste des noms d'agents (sera remplie quand des agents seront ajoutés)
  metadata: {
    category: string;
    tags: string[];
    created_at: string;
  };
}

/**
 * Commande directive create pour créer de nouvelles applications et agents
 */
export const createCommand = new Command('create')
  .description('Create new applications or agents');

/**
 * Sous-commande pour créer une application
 */
const createAppCommand = new Command('app')
  .description('Create a new application')
  .argument('[app-name]', 'Name of the application to create')
  .option('--description <description>', 'Application description')
  .option('--author <author>', 'Application author')
  .action(async (appName?: string, options?: CreateAppOptions) => {
    try {
      console.log(chalk.blue('📱 Creating new Directive application...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Collecter les informations de l'application
      const appInfo = await collectAppInfo(appName, options);

      // 3. Valider le nom de l'application
      await validateAppName(appInfo.name);

      // 4. Créer la structure de l'application
      await createAppStructure(appInfo);

      // 5. Afficher le message de succès
      displayAppSuccessMessage(appInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating application:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Ajouter la sous-commande à la commande create
createCommand.addCommand(createAppCommand);

/**
 * Vérifie qu'on est dans un projet Directive valide
 */
async function validateDirectiveProject(): Promise<void> {
  const cwd = process.cwd();
  
  // Vérifier la présence du fichier de configuration Directive
  const configFile = path.join(cwd, 'directive-conf.ts');
  try {
    await fs.access(configFile);
  } catch {
    throw new Error('Not in a Directive project. Please run this command from a Directive project root directory.');
  }

  // Vérifier la présence du répertoire agents
  const agentsDir = path.join(cwd, 'agents');
  try {
    await fs.access(agentsDir);
  } catch {
    throw new Error('No "agents" directory found. Please run this command from a Directive project root directory.');
  }
}

/**
 * Collecte les informations de l'application via prompts interactifs
 */
async function collectAppInfo(appName?: string, options?: CreateAppOptions): Promise<Required<CreateAppOptions>> {
  const questions = [];

  // Nom de l'application
  if (!appName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Application name:',
      validate: (input: string) => {
        if (!input.trim()) return 'Application name is required';
        if (!/^[a-z0-9-_]+$/.test(input)) return 'Name must contain only lowercase letters, numbers, hyphens and underscores';
        if (input.length < 2) return 'Name must be at least 2 characters long';
        if (input.length > 50) return 'Name must be less than 50 characters';
        return true;
      }
    });
  }

  // Description
  if (!options?.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Application description:',
      default: (answers: any) => `AI agents application ${answers.name || appName}`
    });
  }

  // Récupérer l'auteur de la config en avance
  const defaultAuthor = await getProjectAuthor();

  // Auteur - seulement si pas fourni ET qu'on a d'autres questions (mode interactif)
  if (!options?.author && questions.length > 0) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Application author:',
      default: defaultAuthor
    });
  }

  const answers = await inquirer.prompt(questions);

  return {
    name: appName || answers.name,
    description: options?.description || answers.description,
    author: options?.author || answers.author || defaultAuthor
  };
}

/**
 * Récupère l'auteur du projet depuis la configuration
 */
async function getProjectAuthor(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'directive-conf.ts');
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    // Extraction simple de l'auteur depuis la config
    const authorMatch = configContent.match(/author:\s*['"`]([^'"`]+)['"`]/);
    return authorMatch ? authorMatch[1] : 'Directive Team';
  } catch {
    return 'Directive Team';
  }
}

/**
 * Valide le nom de l'application et vérifie l'unicité
 */
async function validateAppName(appName: string): Promise<void> {
  const agentsDir = path.join(process.cwd(), 'agents');
  const appPath = path.join(agentsDir, appName);

  // Vérifier que l'application n'existe pas déjà
  try {
    await fs.access(appPath);
    throw new Error(`Application "${appName}" already exists in agents/${appName}/`);
  } catch (error) {
    // C'est normal qu'elle n'existe pas, on peut continuer
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
  }

  // Validation du format du nom
  if (!/^[a-z0-9-_]+$/.test(appName)) {
    throw new Error('Application name must contain only lowercase letters, numbers, hyphens and underscores');
  }

  if (appName.length < 2 || appName.length > 50) {
    throw new Error('Application name must be between 2 and 50 characters');
  }

  // Vérifier les noms réservés
  const reservedNames = ['core', 'system', 'admin', 'api', 'config', 'lib', 'utils', 'test', 'src'];
  if (reservedNames.includes(appName)) {
    throw new Error(`"${appName}" is a reserved name. Please choose a different application name.`);
  }
}

/**
 * Crée la structure de l'application
 */
async function createAppStructure(appInfo: Required<CreateAppOptions>): Promise<void> {
  console.log(chalk.yellow('📁 Creating application structure...'));

  const agentsDir = path.join(process.cwd(), 'agents');
  const appPath = path.join(agentsDir, appInfo.name);

  // Créer le répertoire de l'application
  await fs.mkdir(appPath, { recursive: true });

  // Générer l'ID unique de l'application
  const appId = generateAppId(appInfo.name);

  // Créer l'application card
  const applicationCard: ApplicationCard = {
    id: appId,
    name: appInfo.name,
    description: appInfo.description,
    author: appInfo.author,
    version: '1.0.0',
    agents: [], // Vide au début, sera rempli quand des agents seront ajoutés
    metadata: {
      category: 'custom',
      tags: ['application'],
      created_at: new Date().toISOString()
    }
  };

  // Écrire le fichier index.json
  await fs.writeFile(
    path.join(appPath, 'index.json'),
    JSON.stringify(applicationCard, null, 2)
  );

  console.log(chalk.green(`✅ Application structure created in agents/${appInfo.name}/`));
}

/**
 * Génère un ID unique pour l'application
 */
function generateAppId(appName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `app_${appName}_${timestamp}_${random}`;
}

/**
 * Affiche le message de succès final
 */
function displayAppSuccessMessage(appInfo: Required<CreateAppOptions>): void {
  console.log(chalk.green('\n🎉 Application created successfully!'));
  
  console.log(chalk.blue('\n📋 Application details:'));
  console.log(chalk.gray(`   Name: ${appInfo.name}`));
  console.log(chalk.gray(`   Description: ${appInfo.description}`));
  console.log(chalk.gray(`   Author: ${appInfo.author}`));
  console.log(chalk.gray(`   Location: agents/${appInfo.name}/`));
  
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.gray(`   directive agent create ${appInfo.name} <agent-name>  # Create your first agent`));
  console.log(chalk.gray(`   ls agents/${appInfo.name}/                          # View application structure`));
  
  console.log(chalk.blue('\n📚 Files created:'));
  console.log(chalk.gray(`   agents/${appInfo.name}/index.json                   # Application metadata`));
  
  console.log(chalk.yellow('\n⚠️  Note: The application is empty. Create agents to make it functional!'));
} 