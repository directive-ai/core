import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JsonDatabaseService } from '../../implementations/database/json-database.impl.js';

interface AgentMetadata {
  id: string;
  name: string;
  type: string;
  description: string;
  author: string;
  version: string;
  application: string;
  created_at: string;
  deployment_version: number;
  status: 'draft' | 'active' | 'inactive';
  deployed_at?: string;
  states: string[];
}

interface ApplicationCard {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  agents: string[];
  agents_count: number;
  metadata: {
    category: string;
    tags: string[];
    created_at: string;
  };
}

/**
 * Commande directive list pour lister applications et agents (v2.0 - Base de données globale)
 */
export const listCommand = new Command('list')
  .description('List applications and agents from global database');

/**
 * Sous-commande pour lister les applications depuis la base de données globale
 */
const listAppsCommand = new Command('app')
  .description('List all applications from global database')
  .action(async () => {
    try {
      console.log(chalk.blue('📱 Listing Directive applications (global database)...\n'));

      // 1. Initialiser la base de données globale
      const database = await initGlobalDatabase();

      // 2. Récupérer les applications depuis la BDD
      const apps = await getApplicationsFromDatabase(database);

      // 3. Afficher les résultats
      displayApplicationsList(apps);
      
      await database.close();

    } catch (error) {
      console.error(chalk.red('❌ Error listing applications:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Sous-commande pour lister les agents depuis la base de données globale
 */
const listAgentsCommand = new Command('agents')
  .description('List all agents from global database')
  .option('--app <app-name>', 'Filter by application name')
  .option('--status <status>', 'Filter by status: draft, active, inactive')
  .action(async (options?: { app?: string; status?: 'draft' | 'active' | 'inactive' }) => {
    try {
      console.log(chalk.blue('📋 Listing Directive agents (global database)...\n'));

      // 1. Initialiser la base de données globale
      const database = await initGlobalDatabase();

      // 2. Récupérer les agents depuis la BDD
      const agents = await getAgentsFromDatabase(database, options);

      // 3. Afficher les résultats
      displayAgentsList(agents, options);
      
      await database.close();

    } catch (error) {
      console.error(chalk.red('❌ Error listing agents:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Ajouter les sous-commandes
listCommand.addCommand(listAppsCommand);
listCommand.addCommand(listAgentsCommand);

/**
 * Initialise la connexion à la base de données globale
 */
async function initGlobalDatabase(): Promise<JsonDatabaseService> {
  try {
    const { getGlobalDbPath } = await import('../utils/global-config.js');
    const database = new JsonDatabaseService(getGlobalDbPath());
    await database.initialize();
    return database;
  } catch (error) {
    throw new Error(`Cannot connect to global database. Run "directive init" first. Error: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Récupère les applications depuis la base de données globale
 */
async function getApplicationsFromDatabase(database: JsonDatabaseService): Promise<ApplicationCard[]> {
  try {
    const applications = await database.getApplications();
    
    return applications.map(app => ({
      id: app.id,
      name: app.name,
      description: app.description,
      author: app.author,
      version: app.version,
      agents: [], // Sera rempli si nécessaire
      agents_count: app.agents_count || 0,
      metadata: {
        category: app.metadata?.category || 'default',
        tags: app.metadata?.tags || [],
        created_at: app.created_at
      }
    }));
  } catch (error) {
    throw new Error(`Failed to retrieve applications: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Récupère les agents depuis la base de données globale
 */
async function getAgentsFromDatabase(
  database: JsonDatabaseService, 
  options?: { app?: string; status?: 'draft' | 'active' | 'inactive' }
): Promise<AgentMetadata[]> {
  try {
    // Récupérer tous les agents
    const dbAgents = await database.getRegisteredAgents();
    
    // Récupérer les applications pour résoudre les noms
    const applications = await database.getApplications();
    const appMap = new Map(applications.map(app => [app.id, app.name]));
    
    let agents = dbAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      description: agent.description,
      author: agent.metadata?.author || 'Unknown',
      version: agent.version,
      application: appMap.get(agent.application_id) || 'Unknown',
      created_at: agent.created_at,
      deployment_version: agent.deployment_version || 0,
      status: agent.status as 'draft' | 'active' | 'inactive',
      deployed_at: agent.deployed_at,
      states: extractStatesFromMachine(agent.machine_definition)
    }));

    // Filtrer par application si spécifié
    if (options?.app) {
      agents = agents.filter(agent => agent.application === options.app);
    }

    // Filtrer par statut si spécifié
    if (options?.status) {
      agents = agents.filter(agent => agent.status === options.status);
    }

    return agents.sort((a, b) => a.type.localeCompare(b.type));
    
  } catch (error) {
    throw new Error(`Failed to retrieve agents: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Extrait les états d'une machine XState
 */
function extractStatesFromMachine(machineDefinition: any): string[] {
  if (!machineDefinition || !machineDefinition.states) {
    return [];
  }
  
  return Object.keys(machineDefinition.states);
}

/**
 * Vérifie qu'on est dans un projet Directive valide (LEGACY - plus nécessaire pour v2.0)
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
 * Scanner les applications disponibles (LEGACY - v1.0)
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
 * Scanner les agents disponibles (LEGACY - v1.0)
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
 * Affiche la liste des applications (v2.0 - avec statuts)
 */
function displayApplicationsList(apps: ApplicationCard[]): void {
  if (apps.length === 0) {
    console.log(chalk.yellow('⚠️  No applications found in global database'));
    console.log(chalk.gray('   Create your first application with: directive create app <project-name>'));
    return;
  }

  console.log(chalk.blue(`📱 Applications (${apps.length})`));
  console.log();

  for (const app of apps) {
    console.log(`   🏠 ${chalk.white(app.name)} (${chalk.gray(app.id)})`);
    console.log(`      ${chalk.gray(app.description)}`);
    console.log(`      ${chalk.gray(`v${app.version} • ${app.author} • ${app.agents_count} agents`)}`);
    
    const tags = app.metadata.tags.length > 0 ? app.metadata.tags.join(', ') : 'none';
    console.log(`      ${chalk.gray(`Category: ${app.metadata.category} • Tags: ${tags}`)}`);
    console.log(`      ${chalk.gray(`Created: ${new Date(app.metadata.created_at).toLocaleDateString()}`)}`);
    console.log();
  }

  console.log(chalk.blue('📋 Next steps:'));
  console.log(chalk.gray('   directive list agents                # View all agents'));
  console.log(chalk.gray('   directive create agent <name>       # Create a new agent'));
}

/**
 * Affiche la liste des agents (v2.0 - avec statuts de déploiement)
 */
function displayAgentsList(agents: AgentMetadata[], options?: { app?: string; status?: string }): void {
  if (agents.length === 0) {
    let message = 'No agents found in global database';
    if (options?.app) message = `No agents found for application "${options.app}"`;
    if (options?.status) message += ` with status "${options.status}"`;
    
    console.log(chalk.yellow(`⚠️  ${message}`));
    console.log(chalk.gray('   Create your first agent with: directive create agent <name>'));
    return;
  }

  let title = `📋 All agents (${agents.length})`;
  if (options?.app) title = `📋 Agents in application "${options.app}" (${agents.length})`;
  if (options?.status) title += ` [${options.status}]`;
  
  console.log(chalk.blue(title));
  console.log();

  // Grouper par application si pas de filtre app
  const groupedAgents = options?.app 
    ? { [options.app]: agents }
    : agents.reduce((groups, agent) => {
        const app = agent.application;
        if (!groups[app]) groups[app] = [];
        groups[app].push(agent);
        return groups;
      }, {} as Record<string, AgentMetadata[]>);

  for (const [appName, appAgents] of Object.entries(groupedAgents)) {
    if (!options?.app) {
      console.log(chalk.cyan(`🏠 ${appName}/`));
    }

    for (const agent of appAgents) {
      const indent = options?.app ? '   ' : '     ';
      
      // Icône de statut
      const statusIcon = {
        'draft': '📝',
        'active': '✅', 
        'inactive': '⏸️'
      }[agent.status] || '❓';
      
      // Couleur du statut
      const statusColor = {
        'draft': chalk.yellow,
        'active': chalk.green,
        'inactive': chalk.gray
      }[agent.status] || chalk.white;
      
      console.log(`${indent}${statusIcon} ${chalk.white(agent.name)} (${chalk.gray(agent.type)})`);
      console.log(`${indent}   ${chalk.gray(agent.description)}`);
      console.log(`${indent}   ${statusColor(`Status: ${agent.status}`)} • ${chalk.gray(`v${agent.version} (deploy: v${agent.deployment_version})`)}`);
      console.log(`${indent}   ${chalk.gray(`States: ${agent.states.join(', ')}`)}`);
      
      if (agent.deployed_at) {
        console.log(`${indent}   ${chalk.gray(`Deployed: ${new Date(agent.deployed_at).toLocaleString()}`)}`);
      }
      console.log();
    }
  }

  console.log(chalk.blue('📋 Next steps:'));
  console.log(chalk.gray('   directive deploy agent <name>       # Deploy a draft agent'));
  console.log(chalk.gray('   directive start                     # Start the server to run agents'));
  console.log(chalk.gray('   directive create agent <name>       # Create another agent'));
  
  // Statistiques
  const stats = {
    draft: agents.filter(a => a.status === 'draft').length,
    active: agents.filter(a => a.status === 'active').length,
    inactive: agents.filter(a => a.status === 'inactive').length
  };
  
  console.log(chalk.blue('\n📊 Summary:'));
  console.log(chalk.gray(`   Draft: ${stats.draft} • Active: ${stats.active} • Inactive: ${stats.inactive}`));
} 