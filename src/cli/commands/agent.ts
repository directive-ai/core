import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface CreateAgentOptions {
  description?: string;
  author?: string;
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
 * Commande directive agent pour créer et gérer les agents directeurs
 */
export const agentCommand = new Command('agent')
  .description('Create and manage directive agents');

/**
 * Sous-commande pour créer un agent directeur
 */
const createAgentCommand = new Command('create')
  .description('Create a new directive agent')
  .argument('<app-name>', 'Name of the application')
  .argument('<agent-name>', 'Name of the agent to create')
  .option('--description <description>', 'Agent description')
  .option('--author <author>', 'Agent author')
  .action(async (appName: string, agentName: string, options?: CreateAgentOptions) => {
    try {
      console.log(chalk.blue('🤖 Creating new Directive agent...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Vérifier que l'application existe
      await validateApplicationExists(appName);

      // 3. Collecter les informations de l'agent
      const agentInfo = await collectAgentInfo(agentName, options);

      // 4. Valider le nom de l'agent
      await validateAgentName(appName, agentName);

      // 5. Créer la structure de l'agent
      await createAgentStructure(appName, agentName, agentInfo);

      // 6. Mettre à jour l'application card
      await updateApplicationCard(appName, agentName);

      // 7. Afficher le message de succès
      displayAgentSuccessMessage(appName, agentName, agentInfo);

    } catch (error) {
      console.error(chalk.red('❌ Error creating agent:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Sous-commande pour lister les agents
 */
const listAgentsCommand = new Command('list')
  .description('List all available agents')
  .option('--app <app-name>', 'Filter by application name')
  .action(async (options?: { app?: string }) => {
    try {
      console.log(chalk.blue('📋 Listing Directive agents...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Scanner et lister les agents
      const agents = await scanAgents(options?.app);

      // 3. Afficher les résultats
      displayAgentsList(agents, options?.app);

    } catch (error) {
      console.error(chalk.red('❌ Error listing agents:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Ajouter les sous-commandes
agentCommand.addCommand(createAgentCommand);
agentCommand.addCommand(listAgentsCommand);

/**
 * Vérifie qu'on est dans un projet Directive valide
 */
async function validateDirectiveProject(): Promise<void> {
  const cwd = process.cwd();
  
  const configFile = path.join(cwd, 'directive-conf.ts');
  try {
    await fs.access(configFile);
  } catch {
    throw new Error('Not in a Directive project. Please run this command from a Directive project root directory.');
  }

  const agentsDir = path.join(cwd, 'agents');
  try {
    await fs.access(agentsDir);
  } catch {
    throw new Error('No "agents" directory found. Please run this command from a Directive project root directory.');
  }
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
 * Collecte les informations de l'agent via prompts interactifs
 */
async function collectAgentInfo(agentName: string, options?: CreateAgentOptions): Promise<Required<CreateAgentOptions>> {
  const questions = [];

  // Description
  if (!options?.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: 'Agent description:',
      default: `AI directive agent ${agentName}`
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
    
    const authorMatch = configContent.match(/author:\s*['"`]([^'"`]+)['"`]/);
    return authorMatch ? authorMatch[1] : 'Directive Team';
  } catch {
    return 'Directive Team';
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
async function createAgentStructure(appName: string, agentName: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  console.log(chalk.yellow('📁 Creating agent structure...'));

  const agentPath = path.join(process.cwd(), 'agents', appName, agentName);

  // Créer le répertoire de l'agent
  await fs.mkdir(agentPath, { recursive: true });

  // 1. Générer agent.ts avec machine XState
  await generateAgentTypeScript(agentPath, appName, agentName, agentInfo);

  // 2. Générer agent.json avec métadonnées
  await generateAgentMetadata(agentPath, appName, agentName, agentInfo);

  // 3. Générer desc.mdx avec documentation
  await generateAgentDocumentation(agentPath, appName, agentName, agentInfo);

  console.log(chalk.green(`✅ Agent structure created in agents/${appName}/${agentName}/`));
}

/**
 * Génère le fichier agent.ts avec la machine XState
 */
async function generateAgentTypeScript(agentPath: string, appName: string, agentName: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentType = `${appName}/${agentName}`;
  
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
 * Context interface for ${agentName} agent
 */
interface ${toPascalCase(agentName)}Context {
  direction?: 'left' | 'right';
  inputData?: any;
  result?: any;
  errorMessage?: string;
}

/**
 * Events interface for ${agentName} agent
 */
type ${toPascalCase(agentName)}Event =
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
const ${toCamelCase(agentName)}Machine = createMachine<${toPascalCase(agentName)}Context, ${toPascalCase(agentName)}Event>({
  id: '${agentName}',
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
            inputData: (context, event) => event.data
          })
        },
        CHOOSE_RIGHT: {
          target: 'runningRight',
          actions: assign({
            direction: 'right',
            inputData: (context, event) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: (context, event) => event.error
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
            result: (context, event) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: (context, event) => event.error
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
            result: (context, event) => event.data
          })
        },
        ERROR: {
          target: 'terminated',
          actions: assign({
            errorMessage: (context, event) => event.error
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
  machine: ${toCamelCase(agentName)}Machine,
  metadata: {
    name: '${agentInfo.description}',
    description: 'Simple directive agent with left/right branching logic',
    version: '1.0.0',
    author: '${agentInfo.author}',
    application: '${appName}',
    tags: ['directive', 'agent', '${appName}', 'xstate']
  }
});

export { ${toCamelCase(agentName)}Machine };
export type { ${toPascalCase(agentName)}Context, ${toPascalCase(agentName)}Event };
`;

  await fs.writeFile(path.join(agentPath, 'agent.ts'), agentTs);
}

/**
 * Génère le fichier agent.json avec les métadonnées
 */
async function generateAgentMetadata(agentPath: string, appName: string, agentName: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentId = generateAgentId(appName, agentName);
  const agentType = `${appName}/${agentName}`;

  const metadata: AgentMetadata = {
    id: agentId,
    name: agentName,
    type: agentType,
    description: agentInfo.description,
    author: agentInfo.author,
    version: '1.0.0',
    application: appName,
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
async function generateAgentDocumentation(agentPath: string, appName: string, agentName: string, agentInfo: Required<CreateAgentOptions>): Promise<void> {
  const agentType = `${appName}/${agentName}`;
  
  const docMdx = `# ${agentInfo.description}

## Overview

This is a **Directive Agent** that implements a simple 4-state workflow machine using XState.

- **Application**: ${appName}
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
interface ${toPascalCase(agentName)}Context {
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
 * Scanner les agents disponibles
 */
async function scanAgents(filterApp?: string): Promise<AgentMetadata[]> {
  const agentsDir = path.join(process.cwd(), 'agents');
  const agents: AgentMetadata[] = [];

  try {
    const apps = await fs.readdir(agentsDir, { withFileTypes: true });
    
    for (const app of apps) {
      if (!app.isDirectory() || app.name.startsWith('.')) continue;
      if (filterApp && app.name !== filterApp) continue;

      const appPath = path.join(agentsDir, app.name);
      
      try {
        const agentDirs = await fs.readdir(appPath, { withFileTypes: true });
        
        for (const agentDir of agentDirs) {
          if (!agentDir.isDirectory() || agentDir.name.startsWith('.')) continue;

          const agentJsonPath = path.join(appPath, agentDir.name, 'agent.json');
          
          try {
            const agentContent = await fs.readFile(agentJsonPath, 'utf-8');
            const agentData = JSON.parse(agentContent) as AgentMetadata;
            agents.push(agentData);
          } catch {
            // Ignorer les agents sans agent.json valide
          }
        }
      } catch {
        // Ignorer les erreurs d'accès aux répertoires d'application
      }
    }
  } catch (error) {
    throw new Error('Could not scan agents directory');
  }

  return agents;
}

/**
 * Affiche la liste des agents
 */
function displayAgentsList(agents: AgentMetadata[], filterApp?: string): void {
  if (agents.length === 0) {
    const message = filterApp 
      ? `No agents found in application "${filterApp}"`
      : 'No agents found in this project';
    console.log(chalk.yellow(`⚠️  ${message}`));
    console.log(chalk.gray('   Create your first agent with: directive agent create <app-name> <agent-name>'));
    return;
  }

  const title = filterApp 
    ? `📋 Agents in application "${filterApp}" (${agents.length})`
    : `📋 All agents (${agents.length})`;
  
  console.log(chalk.blue(title));
  console.log();

  // Grouper par application si pas de filtre
  const groupedAgents = filterApp 
    ? { [filterApp]: agents }
    : agents.reduce((groups, agent) => {
        const app = agent.application;
        if (!groups[app]) groups[app] = [];
        groups[app].push(agent);
        return groups;
      }, {} as Record<string, AgentMetadata[]>);

  for (const [appName, appAgents] of Object.entries(groupedAgents)) {
    if (!filterApp) {
      console.log(chalk.cyan(`🏠 ${appName}/`));
    }

    for (const agent of appAgents) {
      const indent = filterApp ? '   ' : '     ';
      console.log(`${indent}🤖 ${chalk.white(agent.name)} (${chalk.gray(agent.type)})`);
      console.log(`${indent}   ${chalk.gray(agent.description)}`);
      console.log(`${indent}   ${chalk.gray(`v${agent.version} • ${agent.author} • ${agent.states.length} states`)}`);
      console.log();
    }
  }

  console.log(chalk.blue('📋 Next steps:'));
  console.log(chalk.gray('   directive start                     # Start the server to run agents'));
  console.log(chalk.gray('   directive agent create <app> <name> # Create another agent'));
}

/**
 * Affiche le message de succès final
 */
function displayAgentSuccessMessage(appName: string, agentName: string, agentInfo: Required<CreateAgentOptions>): void {
  console.log(chalk.green('\n🎉 Agent created successfully!'));
  
  console.log(chalk.blue('\n📋 Agent details:'));
  console.log(chalk.gray(`   Application: ${appName}`));
  console.log(chalk.gray(`   Name: ${agentName}`));
  console.log(chalk.gray(`   Type: ${appName}/${agentName}`));
  console.log(chalk.gray(`   Description: ${agentInfo.description}`));
  console.log(chalk.gray(`   Author: ${agentInfo.author}`));
  console.log(chalk.gray(`   Location: agents/${appName}/${agentName}/`));
  
  console.log(chalk.blue('\n📋 Next steps:'));
  console.log(chalk.gray(`   ls agents/${appName}/${agentName}/               # View agent files`));
  console.log(chalk.gray(`   cat agents/${appName}/${agentName}/desc.mdx      # Read documentation`));
  console.log(chalk.gray(`   directive start                                  # Start server to test agent`));
  
  console.log(chalk.blue('\n📚 Files created:'));
  console.log(chalk.gray(`   agents/${appName}/${agentName}/agent.ts         # XState machine definition`));
  console.log(chalk.gray(`   agents/${appName}/${agentName}/agent.json       # Agent metadata`));
  console.log(chalk.gray(`   agents/${appName}/${agentName}/desc.mdx         # Agent documentation`));
  
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