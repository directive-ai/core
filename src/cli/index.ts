#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

// Import commands 
import { initCommand } from './commands/init.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { deployCommand } from './commands/deploy.js';
import { agentCommand } from './commands/agent.js';
// import { startCommand } from './commands/start.js';

const program = new Command();

program
  .name('directive')
  .description('CLI for Directive - AI Agents Orchestrator')
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
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(deployCommand);
program.addCommand(agentCommand);
// program.addCommand(startCommand);

// Temporary test command (will be removed later)
program
  .command('test')
  .description('Commande de test temporaire')
  .action(() => {
    console.log(chalk.green('✅ CLI Directive fonctionne correctement !'));
    console.log(chalk.blue('Version:'), '1.0.0');
    console.log(chalk.blue('Status:'), 'Lot 3.4 - Commands refactored with list');
    console.log(chalk.yellow('🔗 Mode:'), 'Développement avec npm link');
  });

// Parse command line arguments
program.parseAsync(process.argv).catch((error) => {
  console.error('Erreur:', error.message);
  process.exit(1);
});

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

export { program }; 