import path from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';

import { JsonDatabaseService } from '../../implementations/database/json-database.impl.js';
import type { CreateApplicationRequest } from '../../dto/index.js';
import type { BaseAgentContext, BaseAgentEvent } from '@directive/types';

interface CreateAppOptions {
  name?: string;
  description?: string;
  author?: string;
}

interface CreateAgentOptions {
  name?: string;
  description?: string;
  author?: string;
}

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

interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  description: string;
  author: string;
  version: string;
  application: string;
  created_at: string;
  xstate_version: string;
  states: string[];
}

/**
 * Commande create pour créer des éléments du projet
 */
const createCommand = new Command('create')
  .description('Create new directive applications or agents');

/**
 * Nouvelle sous-commande pour créer une application complète (v2.0)
 */
const newCreateAppCommand = new Command('app')
  .description('Create a new directive application (project) with v2.0 architecture')
  .argument('[app-name]', 'Name of the application to create')
  .option('--description <description>', 'Application description')
  .option('--author <author>', 'Application author')
  .option('--local', 'Use local tarball instead of npm')
  .option('--skip-install', 'Skip npm package installation')
  .action(async (appName?: string, options?: CreateAppOptions & { local?: boolean; skipInstall?: boolean }) => {
    try {
      console.log(chalk.blue('🚀 Creating new Directive application...\n'));

      // 1. Importer les fonctions depuis project-setup
      const { 
        collectProjectInfo, 
        createProjectStructure, 
        generatePackageJson, 
        generateTsConfig, 
        generateWebpackConfig, 
        generateGitignore, 
        generateEnvExample, 
        installDependencies 
      } = await import('../utils/project-setup.js');
      
      // 2. Collecter les informations de l'application
      const projectInfo = await collectProjectInfo(appName, {
        author: options?.author,
        description: options?.description,
        skipInstall: options?.skipInstall,
        local: options?.local,
        database: 'json'  // v2.0 utilise toujours la base globale JSON
      });

      // 3. Valider le nom de l'application (simple validation)
      if (!/^[a-z0-9-_]+$/.test(projectInfo.name)) {
        throw new Error('Application name must contain only lowercase letters, numbers, hyphens and underscores');
      }

      // 4. Créer la structure de l'application (projet complet v2.0)
      await createCompleteProjectStructureV2(projectInfo, {
        createProjectStructure,
        generatePackageJson,
        generateTsConfig, 
        generateWebpackConfig,
        generateGitignore,
        generateEnvExample,
        installDependencies
      });

      // 5. Afficher le message de succès
      await displayProjectSuccessMessage(projectInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating application:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Sous-commande pour créer un agent directeur (v2.0 - simplifiée)
 */
const createAgentCommand = new Command('agent')
  .description('Create a new directive agent directly in agents/ folder')
  .argument('[agent-name]', 'Name of the agent to create')
  .option('--description <description>', 'Agent description')
  .option('--author <author>', 'Agent author')
  .action(async (agentName?: string, options?: CreateAgentOptions) => {
    try {
      console.log(chalk.blue('🤖 Creating new Directive agent...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Obtenir le nom du projet (= application)
      const projectName = await getProjectName();

      // 3. Collecter les informations de l'agent (nom seulement)
      const agentInfo = await collectAgentInfoV2(agentName, options, projectName);

      // 4. Valider le nom de l'agent (structure simplifiée)
      await validateAgentNameV2(agentInfo.name);

      // 5. Créer la structure de l'agent (agents/{agent}/ direct)
      await createAgentStructureV2(agentInfo);

      // 6. Enregistrer dans la base de données globale
      await registerAgentInGlobalDatabase(agentInfo);

      // 7. Afficher le message de succès
      await displayAgentSuccessMessageV2(agentInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating agent:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Ajouter les sous-commandes à la commande create
createCommand.addCommand(newCreateAppCommand);  // Nouvelle commande create app (crée projets complets)
createCommand.addCommand(createAgentCommand);

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

// === FONCTIONS POUR LA CRÉATION D'AGENTS V2.0 ===

/**
 * Obtient le nom du projet depuis directive-conf.ts (= nom de l'application)
 */
async function getProjectName(): Promise<string> {
  try {
    const configPath = path.join(process.cwd(), 'directive-conf.ts');
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    // Extraction du nom de l'application depuis la config
    const nameMatch = configContent.match(/name:\s*['"`]([^'"`]+)['"`]/);
    if (!nameMatch) {
      throw new Error('Cannot find application name in directive-conf.ts');
    }
    
    return nameMatch[1];
  } catch (error) {
    throw new Error(`Cannot read project configuration: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Interface pour les informations d'agent v2.0 (avec nom du projet)
 */
interface AgentInfoV2 {
  name: string;
  description: string;
  author: string;
  projectName: string;  // Nom du projet = nom de l'application
  agentType: string;    // Format: "project/agent"
}

/**
 * Collecte les informations de l'agent v2.0 (sans sélection d'app)
 */
async function collectAgentInfoV2(
  agentName?: string, 
  options?: CreateAgentOptions,
  projectName?: string
): Promise<AgentInfoV2> {
  const questions = [];

  // Nom de l'agent
  if (!agentName) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input: string) => {
        if (!input.trim()) return 'Agent name is required';
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
      message: 'Agent description:',
      default: (answers: any) => `AI directive agent ${answers.name || agentName}`
    });
  }

  // Récupérer l'auteur de la config en avance
  const defaultAuthor = await getProjectAuthor();

  // Auteur - seulement si pas fourni ET qu'on a d'autres questions (mode interactif)
  if (!options?.author && questions.length > 0) {
    questions.push({
      type: 'input',
      name: 'author',
      message: 'Agent author:',
      default: defaultAuthor
    });
  }

  const answers = await inquirer.prompt(questions);
  const finalAgentName = agentName || answers.name;
  const finalProjectName = projectName || 'unknown-project';

  return {
    name: finalAgentName,
    description: options?.description || answers.description,
    author: options?.author || answers.author || defaultAuthor,
    projectName: finalProjectName,
    agentType: `${finalProjectName}/${finalAgentName}`  // Format v2.0: project/agent
  };
}

/**
 * Valide le nom de l'agent v2.0 (structure simplifiée agents/{agent}/)
 */
async function validateAgentNameV2(agentName: string): Promise<void> {
  const agentPath = path.join(process.cwd(), 'agents', agentName);

  // Vérifier que l'agent n'existe pas déjà
  try {
    await fs.access(agentPath);
    throw new Error(`Agent "${agentName}" already exists in agents/${agentName}/`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
  }

  // Validation du format du nom
  if (!/^[a-z0-9-_]+$/.test(agentName)) {
    throw new Error('Agent name must contain only lowercase letters, numbers, hyphens and underscores');
  }

  if (agentName.length < 2 || agentName.length > 50) {
    throw new Error('Agent name must be between 2 and 50 characters');
  }

  // Vérifier les noms réservés
  const reservedNames = ['core', 'system', 'admin', 'api', 'config', 'lib', 'utils', 'test', 'src', 'index'];
  if (reservedNames.includes(agentName)) {
    throw new Error(`"${agentName}" is a reserved name. Please choose a different agent name.`);
  }
}

/**
 * Crée la structure de l'agent v2.0 (agents/{agent}/ direct)
 */
async function createAgentStructureV2(agentInfo: AgentInfoV2): Promise<void> {
  console.log(chalk.yellow('📁 Creating agent structure...'));

  const agentPath = path.join(process.cwd(), 'agents', agentInfo.name);

  // Créer le répertoire de l'agent directement dans agents/
  await fs.mkdir(agentPath, { recursive: true });

  // 1. Générer agent.ts avec machine XState
  await generateAgentTypeScriptV2(agentPath, agentInfo);

  // 2. Générer agent.json avec métadonnées
  await generateAgentMetadataV2(agentPath, agentInfo);

  // 3. Générer desc.mdx avec documentation
  await generateAgentDocumentationV2(agentPath, agentInfo);

  console.log(chalk.green(`✅ Agent structure created in agents/${agentInfo.name}/`));
}

/**
 * Charge un template et remplace les placeholders
 */
async function loadAndRenderTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
  const templatePath = path.join(__dirname, '../templates', templateName);
  let template = await fs.readFile(templatePath, 'utf-8');
  
  // Remplacer tous les placeholders {{variable}} par leurs valeurs
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    template = template.replace(placeholder, value);
  }
  
  return template;
}

/**
 * Génère le fichier agent.ts avec machine XState v2.0
 */
async function generateAgentTypeScriptV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const variables = {
    agentName: agentInfo.name,
    description: agentInfo.description,
    agentType: agentInfo.agentType,
    author: agentInfo.author,
    PascalCaseName: toPascalCase(agentInfo.name),
    camelCaseName: toCamelCase(agentInfo.name)
  };
  
  const agentContent = await loadAndRenderTemplate('agent.ts.template', variables);
  await fs.writeFile(path.join(agentPath, 'agent.ts'), agentContent);
}

/**
 * Génère le fichier agent.json avec métadonnées v2.0
 */
async function generateAgentMetadataV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const agentId = generateAgentIdV2(agentInfo.projectName, agentInfo.name);
  
  const variables = {
    agentId: agentId,
    agentName: agentInfo.name,
    agentType: agentInfo.agentType,
    description: agentInfo.description,
    author: agentInfo.author,
    projectName: agentInfo.projectName,
    createdAt: new Date().toISOString()
  };

  const metadataContent = await loadAndRenderTemplate('agent.json.template', variables);
  await fs.writeFile(path.join(agentPath, 'agent.json'), metadataContent);
}

/**
 * Génère le fichier desc.mdx avec documentation v2.0
 */
async function generateAgentDocumentationV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const variables = {
    agentName: agentInfo.name,
    description: agentInfo.description,
    agentType: agentInfo.agentType,
    author: agentInfo.author,
    projectName: agentInfo.projectName,
    camelCaseName: toCamelCase(agentInfo.name),
    createdDateFr: new Date().toLocaleDateString('fr-FR')
  };

  const documentationContent = await loadAndRenderTemplate('desc.mdx.template', variables);
  await fs.writeFile(path.join(agentPath, 'desc.mdx'), documentationContent);
}

/**
 * Génère un ID unique pour l'agent v2.0
 */
function generateAgentIdV2(projectName: string, agentName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `agent_${projectName}_${agentName}_${timestamp}_${random}`;
}

/**
 * Enregistre l'agent dans la base de données globale
 */
async function registerAgentInGlobalDatabase(agentInfo: AgentInfoV2): Promise<void> {
  console.log(chalk.yellow('📝 Registering agent in global database...'));
  
  try {
    // Utiliser la configuration globale pour la base de données
    const { getGlobalConfig, getGlobalDbPath } = await import('../utils/global-config.js');
    const globalConfig = await getGlobalConfig();
    
    if (globalConfig.database.type === 'json') {
      const database = new JsonDatabaseService(getGlobalDbPath());
      await database.initialize();

      // Créer d'abord l'application si elle n'existe pas
      const applications = await database.getApplications();
      let app = applications.find(a => a.name === agentInfo.projectName);
      
      if (!app) {
        // Auto-créer l'application pour ce projet
        const createAppRequest: CreateApplicationRequest = {
          name: agentInfo.projectName,
          description: `Application for project ${agentInfo.projectName}`,
          author: agentInfo.author,
          version: '1.0.0',
          metadata: {
            category: 'project',
            tags: ['auto-created', 'v2.0']
          }
        };
        
        app = await database.createApplication(createAppRequest);
        console.log(chalk.blue(`ℹ️ Auto-created application "${agentInfo.projectName}" in global database`));
      }

      // Maintenant créer l'agent
      const createAgentRequest = {
        name: agentInfo.name,
        type: agentInfo.agentType,  // Format: "project/agent"
        description: agentInfo.description,
        author: agentInfo.author,
        application_id: app.id,
        version: '1.0.0',
        metadata: {
          project_name: agentInfo.projectName,
          created_via: 'directive-v2.0',
          structure: 'simplified'
        }
      };

      await database.createAgent(createAgentRequest);
      await database.close();
      
      console.log(chalk.green(`✅ Agent registered in global database with type "${agentInfo.agentType}"`));
    } else {
      console.warn(chalk.yellow(`⚠️ Warning: Global database type "${globalConfig.database.type}" not yet implemented`));
    }
    
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Warning: Could not register agent in global database'));
    console.warn(chalk.gray(`   ${error instanceof Error ? error.message : error}`));
    console.warn(chalk.gray('   The agent files were created successfully.'));
  }
}

/**
 * Affiche le message de succès v2.0
 */
async function displayAgentSuccessMessageV2(agentInfo: AgentInfoV2): Promise<void> {
  console.log(chalk.green('\n🎉 Agent created successfully!\n'));
  
  console.log(chalk.blue('📋 Agent Details:'));
  console.log(chalk.gray(`   Name: ${agentInfo.name}`));
  console.log(chalk.gray(`   Type: ${agentInfo.agentType}`));  // project/agent
  console.log(chalk.gray(`   Description: ${agentInfo.description}`));
  console.log(chalk.gray(`   Author: ${agentInfo.author}`));
  console.log(chalk.gray(`   Location: agents/${agentInfo.name}/`));
  
  console.log(chalk.blue('\n🏗️ Architecture v2.0:'));
  console.log(chalk.gray('   ✅ Direct structure: agents/{agent}/'));
  console.log(chalk.gray('   ✅ Global database: ~/.directive/data/'));
  console.log(chalk.gray(`   ✅ Agent type: ${agentInfo.agentType}`));
  
  console.log(chalk.blue('\n📚 Files Created:'));
  console.log(chalk.gray(`   agents/${agentInfo.name}/agent.ts          # XState machine`));
  console.log(chalk.gray(`   agents/${agentInfo.name}/agent.json        # Metadata`));
  console.log(chalk.gray(`   agents/${agentInfo.name}/desc.mdx          # Documentation`));
  
  console.log(chalk.blue('\n📋 Next Steps:'));
  console.log(chalk.gray(`   directive deploy agent ${agentInfo.name}   # Deploy the agent`));
  console.log(chalk.gray(`   directive start                           # Start the server`));
  console.log(chalk.gray(`   # Test: curl -X POST http://localhost:3000/sessions -d '{"agent_type":"${agentInfo.agentType}"}'`));
  
  console.log(chalk.yellow('\n⚡ Ready to code! Edit the XState machine in:'));
  console.log(chalk.white(`   agents/${agentInfo.name}/agent.ts`));
}

// === FONCTIONS POUR LA CRÉATION D'APPLICATIONS COMPLÈTES V2.0 ===

/**
 * Crée la structure complète d'un projet v2.0 avec directive-conf.ts
 */
async function createCompleteProjectStructureV2(
  projectInfo: any,
  utils: any
): Promise<void> {
  const projectPath = path.resolve(projectInfo.name);
  
  // 1. Créer la structure de base
  await utils.createProjectStructure(projectInfo);
  
  // 2. Générer le directive-conf.ts (métadonnées application v2.0)
  await generateDirectiveConfig(projectPath, projectInfo);
  
  // 3. Générer les fichiers de configuration
  await utils.generatePackageJson(projectPath, projectInfo);
  await utils.generateTsConfig(projectPath);
  await utils.generateWebpackConfig(projectPath);
  await utils.generateGitignore(projectPath, projectInfo);
  await utils.generateEnvExample(projectPath, projectInfo);
  
  // 4. Installer les dépendances (si demandé)
  if (!projectInfo.skipInstall) {
    await utils.installDependencies(projectInfo.name);
  }
}

/**
 * Génère le fichier directive-conf.ts (métadonnées application v2.0)
 */
async function generateDirectiveConfig(projectPath: string, projectInfo: any): Promise<void> {
  const variables = {
    projectName: projectInfo.name,
    projectDescription: projectInfo.description,
    projectAuthor: projectInfo.author,
    createdAt: new Date().toISOString()
  };

  const directiveConfigContent = await loadAndRenderTemplate('directive-conf.ts.template', variables);
  await fs.writeFile(path.join(projectPath, 'directive-conf.ts'), directiveConfigContent);
  console.log(chalk.green(`✅ directive-conf.ts created with v2.0 configuration`));
}

/**
 * Affiche le message de succès pour un projet v2.0
 */
async function displayProjectSuccessMessage(projectInfo: any): Promise<void> {
  console.log(chalk.green('\n🎉 Directive application created successfully!\n'));
  
  console.log(chalk.blue('📋 Application Details:'));
  console.log(chalk.gray(`   Name: ${projectInfo.name}`));
  console.log(chalk.gray(`   Description: ${projectInfo.description}`));
  console.log(chalk.gray(`   Author: ${projectInfo.author}`));
  console.log(chalk.gray(`   Architecture: v2.0 (simplified)`));
  console.log(chalk.gray(`   Database: Global JSON (~/.directive/data/)`));
  
  console.log(chalk.blue('\n🏗️ Architecture v2.0:'));
  console.log(chalk.gray('   ✅ Projet = Application (plus de sous-applications)'));
  console.log(chalk.gray('   ✅ Structure: agents/{agent}/ (simplifiée)'));
  console.log(chalk.gray('   ✅ Configuration globale: ~/.directive/config.json'));
  console.log(chalk.gray('   ✅ Base de données globale: ~/.directive/data/'));
  
  console.log(chalk.blue('\n📚 Files Created:'));
  console.log(chalk.gray(`   ${projectInfo.name}/directive-conf.ts         # Configuration application`));
  console.log(chalk.gray(`   ${projectInfo.name}/package.json              # Dépendances`));
  console.log(chalk.gray(`   ${projectInfo.name}/tsconfig.json             # Configuration TypeScript`));
  console.log(chalk.gray(`   ${projectInfo.name}/webpack.config.js         # Configuration Webpack`));
  console.log(chalk.gray(`   ${projectInfo.name}/.gitignore                # Git ignore`));
  console.log(chalk.gray(`   ${projectInfo.name}/agents/                   # Répertoire des agents`));
  
  console.log(chalk.blue('\n📋 Next Steps:'));
  console.log(chalk.gray(`   cd ${projectInfo.name}                        # Entrer dans le projet`));
  console.log(chalk.gray(`   directive create agent workflow               # Créer votre premier agent`));
  console.log(chalk.gray(`   directive deploy agent workflow               # Déployer l'agent`));
  console.log(chalk.gray(`   directive start                               # Démarrer le serveur`));
  
  console.log(chalk.blue('\n🚀 Architecture v2.0 Ready:'));
  console.log(chalk.gray('   • Plus d\'option --app (projet = application)'));
  console.log(chalk.gray('   • Structure simplifiée agents/{agent}/'));
  console.log(chalk.gray('   • Configuration et base de données globales'));
  console.log(chalk.gray('   • Mapping automatique projet → application'));
  
  if (projectInfo.skipInstall) {
    console.log(chalk.yellow('\n⚠️  Don\'t forget to install dependencies:'));
    console.log(chalk.white(`   cd ${projectInfo.name} && npm install`));
  }
  
  console.log(chalk.green('\n✨ Happy coding with Directive v2.0!'));
}

// === UTILITAIRES PARTAGÉS ===

/**
 * Utilitaires de conversion de noms
 */
function toPascalCase(str: string): string {
  return str.replace(/(^|[-_])(.)/g, (_, __, char) => char.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export { createCommand }; 