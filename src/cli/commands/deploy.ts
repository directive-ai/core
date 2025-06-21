import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { AgentDirecteurFactory } from '../../core/agent-factory/agent-directeur-factory.js';
import { JsonDatabaseService } from '../../implementations/database/json-database.impl.js';

/**
 * Options pour la commande deploy agent
 */
interface DeployAgentOptions {
  strategy?: 'strict' | 'auto-commit' | 'warn' | 'ignore';
  message?: string;
  force?: boolean;
}

/**
 * Commande directive deploy pour déployer des agents à chaud
 */
export const deployCommand = new Command('deploy')
  .description('Deploy agents and applications');

/**
 * Sous-commande pour déployer un agent
 */
const deployAgentCommand = new Command('agent')
  .description('Deploy a specific agent')
  .argument('<agent-type>', 'Agent type in format {app}/{agent} (e.g., metacopi/correction)')
  .option('--strategy <strategy>', 'Git strategy for uncommitted changes', 'strict')
  .option('--message <message>', 'Commit message if using auto-commit strategy')
  .option('--force', 'Force deployment even if agent is not found')
  .action(async (agentType: string, options?: DeployAgentOptions) => {
    try {
      console.log(chalk.blue(`🚀 Deploying agent ${chalk.white(agentType)}...\n`));

      // 1. Valider le projet Directive
      await validateDirectiveProject();

      // 2. Valider et parser le type d'agent
      const { app, agent } = parseAgentType(agentType);

      // 3. Vérifier que l'agent existe
      const agentPath = await validateAgentExists(app, agent);

      // 4. Compiler et charger l'agent
      console.log(chalk.gray('📦 Compiling agent...'));
      await compileAgent(agentType, options);
      
      console.log(chalk.gray('📦 Loading compiled agent...'));
      const compiledModule = await loadCompiledAgent(agentType);

      // 5. Initialiser la database et factory
      const database = new JsonDatabaseService('./data');
      await database.initialize();
      const factory = AgentDirecteurFactory.getInstance(database);

      // 6. Obtenir l'application ID
      const applicationId = await getApplicationId(database, app);

      // 7. Déployer l'agent
      console.log(chalk.gray('🔧 Registering agent with factory...'));
      const result = await factory.registerAgent(
        agentType,
        compiledModule.machine,
        {
          name: compiledModule.metadata.name,
          description: compiledModule.metadata.description,
          version: compiledModule.metadata.version,
          application_id: applicationId,
          file_path: path.relative(process.cwd(), agentPath),
          git_strategy: options?.strategy as any || 'strict',
          git_commit_message: options?.message
        }
      );

      // 8. Afficher le résultat
      await database.close();
      displayDeploymentResult(result, agentType);

    } catch (error) {
      console.error(chalk.red('❌ Deployment failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Valide qu'on est dans un projet Directive
 */
async function validateDirectiveProject(): Promise<void> {
  try {
    await fs.access('./directive-conf.ts');
    await fs.access('./agents');
  } catch (error) {
    throw new Error('Not in a Directive project. Run "directive init" first.');
  }
}

/**
 * Parse et valide le type d'agent
 */
function parseAgentType(agentType: string): { app: string; agent: string } {
  const parts = agentType.split('/');
  if (parts.length !== 2) {
    throw new Error('Agent type must be in format {app}/{agent} (e.g., metacopi/correction)');
  }

  const [app, agent] = parts;
  
  // Validation du format
  if (!/^[a-z0-9-_]+$/.test(app) || !/^[a-z0-9-_]+$/.test(agent)) {
    throw new Error('App and agent names must contain only lowercase letters, numbers, hyphens and underscores');
  }

  return { app, agent };
}

/**
 * Valide que l'agent existe et retourne son chemin
 */
async function validateAgentExists(app: string, agent: string): Promise<string> {
  const agentPath = path.join(process.cwd(), 'agents', app, agent);
  const agentTsPath = path.join(agentPath, 'agent.ts');
  const agentJsonPath = path.join(agentPath, 'agent.json');

  try {
    await fs.access(agentPath);
    await fs.access(agentTsPath);
    await fs.access(agentJsonPath);
  } catch (error) {
    throw new Error(`Agent ${app}/${agent} not found. Create it first with "directive create agent --app ${app} --name ${agent}"`);
  }

  return agentPath;
}

/**
 * Compile l'agent via le projet utilisateur
 */
async function compileAgent(agentType: string, options?: DeployAgentOptions): Promise<void> {
  const { app, agent } = parseAgentType(agentType);
  
  try {
    // 1. Vérifier Git selon la stratégie
    if (options?.strategy === 'strict') {
      const hasChanges = execSync('git status --porcelain', { 
        stdio: 'pipe', 
        encoding: 'utf8' 
      }).trim();
      
      if (hasChanges) {
        throw new Error('Working directory has uncommitted changes. Commit first or use --strategy warn/ignore');
      }
    }
    
    // 2. Exécuter la compilation via npm run build:agent
    console.log(chalk.gray(`   Running: npm run build:agent ${app}/${agent}`));
    
    execSync(`npm run build:agent -- --env agent=${app}/${agent}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(chalk.green('   ✅ Agent compiled successfully'));
    
  } catch (error: any) {
    if (error.message.includes('Working directory has uncommitted changes')) {
      throw error;
    }
    throw new Error(`Agent compilation failed: ${error.message}`);
  }
}

/**
 * Charge l'agent compilé depuis /dist
 */
async function loadCompiledAgent(agentType: string): Promise<{
  machine: any;
  metadata: {
    name: string;
    description: string;
    version: string;
  };
}> {
  const { app, agent } = parseAgentType(agentType);
  
  try {
    // 1. Chemins vers les fichiers compilés
    const compiledJsPath = path.join(process.cwd(), 'dist', `${app}/${agent}.js`);
    const agentJsonPath = path.join(process.cwd(), 'agents', app, agent, 'agent.json');
    
    // 2. Vérifier que les fichiers existent
    try {
      await fs.access(compiledJsPath);
      await fs.access(agentJsonPath);
    } catch (error) {
      throw new Error(`Compiled agent not found. Make sure compilation succeeded. Expected: ${compiledJsPath}`);
    }
    
    // 3. Charger les métadonnées
    const metadataContent = await fs.readFile(agentJsonPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    // 4. Charger le module compilé avec externals
    console.log(chalk.gray(`   Loading from: ${compiledJsPath}`));
    
    // Import du module avec cache busting
    const moduleUrl = `file://${path.resolve(compiledJsPath)}?t=${Date.now()}`;
    const module = await import(moduleUrl);
    
    // 5. Détecter la machine exportée
    const possibleExports = [
      'Agent',          // Objet webpack contenant la machine  
      'simpleMachine',  // Template par défaut
      `${agent}Machine`, // Template dynamique (ex: workflowMachine)
      `${agent.charAt(0).toUpperCase() + agent.slice(1)}Machine`, // Template capitalisé
      'machine',
      'default'
    ];
    
    let machine = null;
    for (const exportName of possibleExports) {
      if (module[exportName]) {
        machine = module[exportName];
        console.log(chalk.gray(`   ✅ Found machine export: ${exportName}`));
        break;
      }
    }
    
    // Si on a trouvé un objet Agent, chercher la machine à l'intérieur
    if (machine && typeof machine === 'object' && !machine.config) {
      // C'est probablement l'objet Agent webpack, chercher la vraie machine
      const possibleMachineProps = [
        'simpleMachine',
        `${agent}Machine`,
        `${agent.charAt(0).toUpperCase() + agent.slice(1)}Machine`,
        'machine'
      ];
      
      for (const prop of possibleMachineProps) {
        if (machine[prop] && machine[prop].config) {
          machine = machine[prop];
          break;
        }
      }
    }
    
    if (!machine) {
      throw new Error(`Agent module must export a XState machine. Available exports: ${Object.keys(module).join(', ')}`);
    }
    
    return {
      machine,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        version: metadata.version
      }
    };
    
  } catch (error) {
    throw new Error(`Failed to load compiled agent: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Obtient l'ID de l'application depuis la base de données
 */
async function getApplicationId(database: any, appName: string): Promise<string> {
  const app = await database.getApplicationByName(appName);
  if (!app) {
    throw new Error(`Application "${appName}" not found in database. Create it first with "directive create app --name ${appName}"`);
  }
  return app.id;
}



/**
 * Affiche le résultat du déploiement
 */
function displayDeploymentResult(result: any, agentType: string): void {
  if (result.success) {
    console.log(chalk.green('\n🎉 Agent deployed successfully!'));
    
    console.log(chalk.blue('\n📋 Deployment details:'));
    console.log(chalk.gray(`   Agent: ${agentType}`));
    console.log(chalk.gray(`   Version: v${result.old_version} → v${result.new_version}`));
    console.log(chalk.gray(`   Git strategy: ${result.git_strategy_used}`));
    
    if (result.git_commit_id) {
      console.log(chalk.gray(`   Git commit: ${result.git_commit_id.substring(0, 7)}`));
    }
    
    if (result.git_was_dirty) {
      console.log(chalk.yellow(`   ⚠️  Working directory was dirty`));
      if (result.git_committed_files && result.git_committed_files.length > 0) {
        console.log(chalk.gray(`   Auto-committed files: ${result.git_committed_files.join(', ')}`));
      }
    }
    
    console.log(chalk.gray(`   Deployed at: ${new Date(result.deployed_at).toLocaleString()}`));
    console.log(chalk.gray(`   Deployment time: ${result.deployment_time_ms}ms`));
    
    if (result.warnings && result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      result.warnings.forEach((warning: string) => {
        console.log(chalk.yellow(`   ${warning}`));
      });
    }
    
    console.log(chalk.blue('\n📋 Next steps:'));
    console.log(chalk.gray('   directive start                    # Start server to test the agent'));
    console.log(chalk.gray(`   directive list agents --app ${agentType.split('/')[0]}     # View deployed agents`));
    
  } else {
    console.log(chalk.red('\n❌ Deployment failed!'));
    console.log(chalk.red(`   Error: ${result.message}`));
    
    if (result.git_strategy_used === 'strict' && result.git_was_dirty) {
      console.log(chalk.yellow('\n💡 Suggestion:'));
      console.log(chalk.gray('   Commit your changes first:'));
      console.log(chalk.gray('   git add . && git commit -m "Update agent"'));
      console.log(chalk.gray('   Or use a different Git strategy:'));
      console.log(chalk.gray(`   directive deploy agent ${agentType} --strategy warn`));
    }
  }
}

// Ajouter la sous-commande à la commande deploy
deployCommand.addCommand(deployAgentCommand); 