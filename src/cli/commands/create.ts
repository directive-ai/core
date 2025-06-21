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

interface CreateAgentOptions {
  app?: string;
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

/**
 * Sous-commande pour créer un agent directeur
 */
const createAgentCommand = new Command('agent')
  .description('Create a new directive agent')
  .option('--app <app-name>', 'Name of the application')
  .option('--name <agent-name>', 'Name of the agent to create')
  .option('--description <description>', 'Agent description')
  .option('--author <author>', 'Agent author')
  .action(async (options?: CreateAgentOptions) => {
    try {
      console.log(chalk.blue('🤖 Creating new Directive agent...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Collecter les informations de l'agent (app + nom)
      const agentInfo = await collectAgentInfo(options);

      // 3. Vérifier que l'application existe
      await validateApplicationExists(agentInfo.app);

      // 4. Valider le nom de l'agent
      await validateAgentName(agentInfo.app, agentInfo.name);

      // 5. Créer la structure de l'agent
      await createAgentStructure(agentInfo);

      // 6. Mettre à jour l'application card
      await updateApplicationCard(agentInfo.app, agentInfo.name);

      // 7. Afficher le message de succès
      displayAgentSuccessMessage(agentInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating agent:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Ajouter les sous-commandes à la commande create
createCommand.addCommand(createAppCommand);
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
  console.log(chalk.gray(`   directive create agent --app ${appInfo.name} --name <agent-name>  # Create your first agent`));
  console.log(chalk.gray(`   ls agents/${appInfo.name}/                                        # View application structure`));
  
  console.log(chalk.blue('\n📚 Files created:'));
  console.log(chalk.gray(`   agents/${appInfo.name}/index.json                   # Application metadata`));
  
  console.log(chalk.yellow('\n⚠️  Note: The application is empty. Create agents to make it functional!'));
}

// === FONCTIONS POUR LA CRÉATION D'AGENTS ===

/**
 * Collecte les informations de l'agent via prompts interactifs
 */
async function collectAgentInfo(options?: CreateAgentOptions): Promise<Required<CreateAgentOptions>> {
  const questions = [];

  // Application
  if (!options?.app) {
    // Récupérer la liste des applications disponibles
    const availableApps = await getAvailableApplications();
    
    if (availableApps.length === 0) {
      throw new Error('No applications found. Create one first with: directive create app <app-name>');
    }

    questions.push({
      type: 'list',
      name: 'app',
      message: 'Select application:',
      choices: availableApps
    });
  }

  // Nom de l'agent
  if (!options?.name) {
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
      default: (answers: any) => `AI directive agent ${answers.name || options?.name}`
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

  return {
    app: options?.app || answers.app,
    name: options?.name || answers.name,
    description: options?.description || answers.description,
    author: options?.author || answers.author || defaultAuthor
  };
}

/**
 * Récupère la liste des applications disponibles
 */
async function getAvailableApplications(): Promise<string[]> {
  const agentsDir = path.join(process.cwd(), 'agents');
  const apps: string[] = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Vérifier que c'est une vraie application (avec index.json)
        const indexPath = path.join(agentsDir, entry.name, 'index.json');
        try {
          await fs.access(indexPath);
          apps.push(entry.name);
        } catch {
          // Ignorer les répertoires sans index.json
        }
      }
    }
  } catch {
    // Répertoire agents n'existe pas ou inaccessible
  }

  return apps.sort();
}

/**
 * Vérifie que l'application existe
 */
async function validateApplicationExists(appName: string): Promise<void> {
  const appPath = path.join(process.cwd(), 'agents', appName);
  
  try {
    await fs.access(appPath);
  } catch {
    throw new Error(`Application "${appName}" does not exist. Create it first with: directive create app ${appName}`);
  }

  // Vérifier que c'est bien une application (avec index.json)
  const indexPath = path.join(appPath, 'index.json');
  try {
    await fs.access(indexPath);
  } catch {
    throw new Error(`"${appName}" is not a valid Directive application (missing index.json).`);
  }
}

/**
 * Valide le nom de l'agent et vérifie l'unicité
 */
async function validateAgentName(appName: string, agentName: string): Promise<void> {
  const agentPath = path.join(process.cwd(), 'agents', appName, agentName);

  // Vérifier que l'agent n'existe pas déjà
  try {
    await fs.access(agentPath);
    throw new Error(`Agent "${agentName}" already exists in application "${appName}".`);
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
 * Crée la structure de l'agent
 */
async function createAgentStructure(agentInfo: Required<CreateAgentOptions>): Promise<void> {
  console.log(chalk.yellow('📁 Creating agent structure...'));

  const agentPath = path.join(process.cwd(), 'agents', agentInfo.app, agentInfo.name);

  // Créer le répertoire de l'agent
  await fs.mkdir(agentPath, { recursive: true });

  // 1. Générer agent.ts avec machine XState
  await generateAgentTypeScript(agentPath, agentInfo);

  // 2. Générer agent.json avec métadonnées
  await generateAgentMetadata(agentPath, agentInfo);

  // 3. Générer desc.mdx avec documentation
  await generateAgentDocumentation(agentPath, agentInfo);

  console.log(chalk.green(`✅ Agent structure created in agents/${agentInfo.app}/${agentInfo.name}/`));
}

/**
 * Génère le fichier agent.ts avec la machine XState
 */
async function generateAgentTypeScript(agentPath: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentType = `${agentInfo.app}/${agentInfo.name}`;
  
  const agentTs = `import { createMachine, assign } from 'xstate';

/**
 * Temporary placeholder for registerAgent function
 * This will be replaced by the actual import when @directive/core is published
 */
const registerAgent = (config: any) => {
  console.log('Agent registered:', config.type);
  // This is a temporary implementation for development
  // In production, this will register the agent with Directive Core
};

/**
 * Context interface for ${agentInfo.name} agent
 */
interface ${toPascalCase(agentInfo.name)}Context {
  direction?: 'left' | 'right';
  inputData?: any;
  result?: any;
  errorMessage?: string;
}

/**
 * Events interface for ${agentInfo.name} agent
 */
type ${toPascalCase(agentInfo.name)}Event =
  | { type: 'CHOOSE_LEFT'; data?: any }
  | { type: 'CHOOSE_RIGHT'; data?: any }
  | { type: 'COMPLETE'; data?: any }
  | { type: 'ERROR'; error: string };

/**
 * ${agentInfo.description}
 * 
 * This is a simple 4-state machine following the MVP specification:
 * initial → runningLeft/runningRight → terminated
 */
const ${toCamelCase(agentInfo.name)}Machine = createMachine({
  id: '${agentInfo.name}',
  initial: 'initial',
  context: {},
  states: {
    initial: {
      // Entry state - agent provides instructions and waits for direction choice
      on: {
        CHOOSE_LEFT: {
          target: 'runningLeft',
          actions: assign({
            direction: 'left',
            inputData: ({ event }) => event.data
          })
        },
        CHOOSE_RIGHT: {
          target: 'runningRight',
          actions: assign({
            direction: 'right',
            inputData: ({ event }) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: ({ event }) => event.error
          })
        }
      }
    },
    
    runningLeft: {
      // Processing with LEFT branch logic
      on: {
        COMPLETE: {
          target: 'terminated',
          actions: assign({
            result: ({ event }) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: ({ event }) => event.error
          })
        }
      }
    },
    
    runningRight: {
      // Processing with RIGHT branch logic
      on: {
        COMPLETE: {
          target: 'terminated',
          actions: assign({
            result: ({ event }) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: ({ event }) => event.error
          })
        }
      }
    },
    
    terminated: {
      // Final state - process completed
      type: 'final'
    }
  }
});

/**
 * Register the agent with Directive Core
 * This makes the agent available for session creation
 */
registerAgent({
  type: '${agentType}',
  machine: ${toCamelCase(agentInfo.name)}Machine,
  metadata: {
    name: '${agentInfo.description}',
    description: 'Simple directive agent with left/right branching logic',
    version: '1.0.0',
    author: '${agentInfo.author}',
    application: '${agentInfo.app}',
    tags: ['directive', 'agent', '${agentInfo.app}', 'xstate']
  }
});

export { ${toCamelCase(agentInfo.name)}Machine };
export type { ${toPascalCase(agentInfo.name)}Context, ${toPascalCase(agentInfo.name)}Event };
`;

  await fs.writeFile(path.join(agentPath, 'agent.ts'), agentTs);
}

/**
 * Génère le fichier agent.json avec les métadonnées
 */
async function generateAgentMetadata(agentPath: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentId = generateAgentId(agentInfo.app, agentInfo.name);
  const agentType = `${agentInfo.app}/${agentInfo.name}`;

  const metadata: AgentMetadata = {
    id: agentId,
    name: agentInfo.name,
    type: agentType,
    description: agentInfo.description,
    author: agentInfo.author,
    version: '1.0.0',
    application: agentInfo.app,
    created_at: new Date().toISOString(),
    xstate_version: '5.x',
    states: ['initial', 'runningLeft', 'runningRight', 'terminated']
  };

  await fs.writeFile(
    path.join(agentPath, 'agent.json'),
    JSON.stringify(metadata, null, 2)
  );
}

/**
 * Génère le fichier desc.mdx avec la documentation
 */
async function generateAgentDocumentation(agentPath: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentType = `${agentInfo.app}/${agentInfo.name}`;
  
  const docMdx = `# ${agentInfo.description}

## Overview

This is a **Directive Agent** that implements a simple 4-state workflow machine using XState.

- **Application**: ${agentInfo.app}
- **Agent Type**: \`${agentType}\`
- **Author**: ${agentInfo.author}
- **Version**: 1.0.0

## State Machine Flow

\`\`\`mermaid
stateDiagram-v2
    [*] --> initial
    initial --> runningLeft : CHOOSE_LEFT
    initial --> runningRight : CHOOSE_RIGHT
    runningLeft --> terminated : COMPLETE
    runningRight --> terminated : COMPLETE
    initial --> terminated : ERROR
    runningLeft --> terminated : ERROR
    runningRight --> terminated : ERROR
    terminated --> [*]
\`\`\`

## States Description

### \`initial\`
- **Purpose**: Entry point where the agent provides instructions and waits for direction choice
- **Transitions**: 
  - \`CHOOSE_LEFT\` → \`runningLeft\`
  - \`CHOOSE_RIGHT\` → \`runningRight\`
  - \`ERROR\` → \`terminated\`

### \`runningLeft\`
- **Purpose**: Processing logic for the LEFT branch
- **Transitions**: 
  - \`COMPLETE\` → \`terminated\`
  - \`ERROR\` → \`terminated\`

### \`runningRight\`
- **Purpose**: Processing logic for the RIGHT branch
- **Transitions**: 
  - \`COMPLETE\` → \`terminated\`
  - \`ERROR\` → \`terminated\`

### \`terminated\`
- **Purpose**: Final state indicating the process is complete
- **Type**: Final state

## Context Data

The agent maintains the following context:

\`\`\`typescript
interface ${toPascalCase(agentInfo.name)}Context {
  direction?: 'left' | 'right';  // Chosen direction
  inputData?: any;               // Input data from events
  result?: any;                  // Final result
  errorMessage?: string;         // Error details if any
}
\`\`\`

## Events

Available events for this agent:

- \`CHOOSE_LEFT\` - Select left processing branch
- \`CHOOSE_RIGHT\` - Select right processing branch  
- \`COMPLETE\` - Mark processing as complete
- \`ERROR\` - Handle error conditions

## Usage Example

\`\`\`bash
# Create a session with this agent
curl -X POST http://localhost:3000/sessions \\
  -H "Content-Type: application/json" \\
  -d '{"agent_type": "${agentType}"}'

# Send direction choice
curl -X POST http://localhost:3000/sessions/{session_id}/events \\
  -H "Content-Type: application/json" \\
  -d '{"event": "CHOOSE_LEFT", "data": {"reason": "User preference"}}'

# Complete the process
curl -X POST http://localhost:3000/sessions/{session_id}/events \\
  -H "Content-Type: application/json" \\
  -d '{"event": "COMPLETE", "data": {"status": "success"}}'
\`\`\`

## Customization

To customize this agent:

1. **Modify states**: Add/remove states in the XState machine
2. **Update events**: Define new event types and transitions
3. **Extend context**: Add more data fields to the context interface
4. **Add actions**: Implement custom actions for state transitions

## Integration

This agent is automatically registered with Directive Core when the application starts. It will be available for session creation via the REST API at \`/sessions\` endpoint.
`;

  await fs.writeFile(path.join(agentPath, 'desc.mdx'), docMdx);
}

/**
 * Met à jour l'application card pour inclure le nouvel agent
 */
async function updateApplicationCard(appName: string, agentName: string): Promise<void> {
  const indexPath = path.join(process.cwd(), 'agents', appName, 'index.json');
  
  try {
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const appData = JSON.parse(indexContent);

    // Ajouter l'agent à la liste
    if (!appData.agents.includes(agentName)) {
      appData.agents.push(agentName);
    }

    await fs.writeFile(indexPath, JSON.stringify(appData, null, 2));
  } catch (error) {
    console.warn(chalk.yellow('⚠️  Could not update application card'));
  }
}

/**
 * Affiche le message de succès final pour un agent
 */
function displayAgentSuccessMessage(agentInfo: Required<CreateAgentOptions>): void {
  console.log(chalk.green('\n🎉 Agent created successfully!'));
  
  console.log(chalk.blue('\n📋 Agent details:'));
  console.log(chalk.gray(`   Application: ${agentInfo.app}`));
  console.log(chalk.gray(`   Name: ${agentInfo.name}`));
  console.log(chalk.gray(`   Type: ${agentInfo.app}/${agentInfo.name}`));
  console.log(chalk.gray(`   Description: ${agentInfo.description}`));
  console.log(chalk.gray(`   Author: ${agentInfo.author}`));
  console.log(chalk.gray(`   Location: agents/${agentInfo.app}/${agentInfo.name}/`));
  
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.gray(`   ls agents/${agentInfo.app}/${agentInfo.name}/               # View agent files`));
  console.log(chalk.gray(`   cat agents/${agentInfo.app}/${agentInfo.name}/desc.mdx      # Read documentation`));
  console.log(chalk.gray(`   directive start                                             # Start server to test agent`));
  
  console.log(chalk.blue('\n📚 Files created:'));
  console.log(chalk.gray(`   agents/${agentInfo.app}/${agentInfo.name}/agent.ts         # XState machine definition`));
  console.log(chalk.gray(`   agents/${agentInfo.app}/${agentInfo.name}/agent.json       # Agent metadata`));
  console.log(chalk.gray(`   agents/${agentInfo.app}/${agentInfo.name}/desc.mdx         # Agent documentation`));
  
  console.log(chalk.yellow('\n⚠️  Note: The agent is ready! Start the server to test it via API.'));
}

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

/**
 * Génère un ID unique pour l'agent
 */
function generateAgentId(appName: string, agentName: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 5);
  return `agent_${appName}_${agentName}_${timestamp}_${random}`;
} 