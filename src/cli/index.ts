#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

// Import commands 
import { initCommand } from './commands/init.js';
// import { createCommand } from './commands/create.js';
// import { agentCommand } from './commands/agent.js';
// import { startCommand } from './commands/start.js';

const program = new Command();

program
  .name('directive')
  .description('CLI pour Directive - Orchestrateur d\'agents IA')
  .version('1.0.0');

// Global error handler
program.exitOverride((err) => {
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  console.error(chalk.red('Erreur:'), err.message);
  process.exit(1);
});

// Add commands
program.addCommand(initCommand);
// program.addCommand(createCommand);
// program.addCommand(agentCommand);
// program.addCommand(startCommand);

// Temporary test command (will be removed later)
program
  .command('test')
  .description('Commande de test temporaire')
  .action(() => {
    console.log(chalk.green('✅ CLI Directive fonctionne correctement !'));
    console.log(chalk.blue('Version:'), '1.0.0');
    console.log(chalk.blue('Status:'), 'Lot 3.2 - Commande init implémentée');
    console.log(chalk.yellow('🔗 Mode:'), 'Développement avec npm link');
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 