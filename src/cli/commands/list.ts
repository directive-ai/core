import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

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

interface ApplicationCard {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  agents: string[];
  metadata: {
    category: string;
    tags: string[];
    created_at: string;
  };
}

/**
 * Commande directive list pour lister applications et agents
 */
export const listCommand = new Command('list')
  .description('List applications and agents');

/**
 * Sous-commande pour lister les applications
 */
const listAppsCommand = new Command('app')
  .description('List all applications')
  .action(async () => {
    try {
      console.log(chalk.blue('📱 Listing Directive applications...\n'));

      // 1. Vérifier qu'on est dans un projet Directive
      await validateDirectiveProject();

      // 2. Scanner et lister les applications
      const apps = await scanApplications();

      // 3. Afficher les résultats
      displayApplicationsList(apps);

    } catch (error) {
      console.error(chalk.red('❌ Error listing applications:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Sous-commande pour lister les agents
 */
const listAgentsCommand = new Command('agents')
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
listCommand.addCommand(listAppsCommand);
listCommand.addCommand(listAgentsCommand);

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
 * Scanner les applications disponibles
 */
async function scanApplications(): Promise<ApplicationCard[]> {
  const agentsDir = path.join(process.cwd(), 'agents');
  const apps: ApplicationCard[] = [];

  try {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const appPath = path.join(agentsDir, entry.name);
      const indexPath = path.join(appPath, 'index.json');
      
      try {
        const appContent = await fs.readFile(indexPath, 'utf-8');
        const appData = JSON.parse(appContent) as ApplicationCard;
        apps.push(appData);
      } catch {
        // Ignorer les répertoires sans index.json valide
      }
    }
  } catch (error) {
    throw new Error('Could not scan applications directory');
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
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
 * Affiche la liste des applications
 */
function displayApplicationsList(apps: ApplicationCard[]): void {
  if (apps.length === 0) {
    console.log(chalk.yellow('⚠️  No applications found in this project'));
    console.log(chalk.gray('   Create your first application with: directive create app'));
    return;
  }

  console.log(chalk.blue(`📱 Applications (${apps.length})`));
  console.log();

  for (const app of apps) {
    console.log(`   🏠 ${chalk.white(app.name)}`);
    console.log(`      ${chalk.gray(app.description)}`);
    console.log(`      ${chalk.gray(`v${app.version} • ${app.author} • ${app.agents.length} agents`)}`);
    
    if (app.agents.length > 0) {
      console.log(`      ${chalk.gray(`Agents: ${app.agents.join(', ')}`)}`);
    }
    console.log();
  }

  console.log(chalk.blue('📋 Next steps:'));
  console.log(chalk.gray('   directive list agents                # View all agents'));
  console.log(chalk.gray('   directive create agent               # Create a new agent'));
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
    console.log(chalk.gray('   Create your first agent with: directive create agent'));
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
  console.log(chalk.gray('   directive start                      # Start the server to run agents'));
  console.log(chalk.gray('   directive create agent               # Create another agent'));
} 