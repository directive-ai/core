import path from 'path';
import fs from 'fs/promises';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Command } from 'commander';

import { JsonDatabaseService } from '../../implementations/database/json-database.impl.js';
import type { CreateApplicationRequest } from '../../dto/index.js';

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
 * Génère le fichier agent.ts avec machine XState v2.0
 */
async function generateAgentTypeScriptV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const pascalCaseName = toPascalCase(agentInfo.name);
  const camelCaseName = toCamelCase(agentInfo.name);

  const agentTemplate = `import { createMachine, assign } from 'xstate';

/**
 * ${agentInfo.description}
 * 
 * Type: ${agentInfo.agentType}
 * Author: ${agentInfo.author}
 * Architecture: Directive v2.0 (simplified)
 */

export interface ${pascalCaseName}Context {
  // Définir les données du contexte ici
  currentState: string;
  requestData?: any;
  result?: any;
  error?: string;
}

export type ${pascalCaseName}Event = 
  | { type: 'START'; data?: any }
  | { type: 'PROCESS'; payload: any }
  | { type: 'SUCCESS'; result: any }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

/**
 * Machine XState pour l'agent ${agentInfo.name}
 * 
 * États disponibles:
 * - idle: État initial, en attente
 * - processing: Traitement en cours
 * - success: Traitement réussi
 * - error: Erreur rencontrée
 */
export const ${camelCaseName}Machine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOjxAGIBlAFQFEBhAUQGUBRAeQFVYkBiAOgCyAoQGViAIQBS8+QIBKJANoAGALqJQqCAJa58isJP0gAHogC0AJgBsARgCcAVgAMZ1wBZDd7wAci8AXxCFXEceBhZ2LmFeAkIyGjoGJiTOHn4QQWFhEQlpOTKKxWUDKgMvP0M-A1MAKxdbKONbPxcAaUtBj3CHT1c3cP8rHytW0YEBNgSkpJp6Rk4eFO5uPiERMXLhKXTqqlVa8u0nMz8faz8HJx8vQyDg0ITwp0jGlraPbqfn3rdGx9exAkCGCBAsGQ6CsHCwBHBtjgdkwWD8qgC6gJZAAjjYzGZGrYWk1Dm5Dk9dv1nsZBkZZiMwaZnjNZv9nl8fnNbKsApD3KZ9ijSjCqUROPUEa0NNomTYEVjiWwScZKq5nN1GgYJpzvBMGQCjlYfLLrL89mdJdtBnzWXcYU9XuCnlNpd4HS52Z8ddz8fy3ALhULhWBGiR4xVRMSyHjyGSKVSaXSGQZJsyFr5XLZ-NZnMa-PsRZMpTa5ZGlc8XirjQ6A7rbU7XaI+M0Yx1msS8f74lT7nj8VGJpyJp6LQWJtnBXCfq5-K4q2sllY3B4c-nc75vfmi6WfOWViZFqYZbOG03W9M2+2Ox3uyje0I+wONc2BxxGsP8cHyDSJQmPg5h+JYowrGsNinj4+xhMsuwnLYiwrDkJ6rAWzxfB8bzbO8S7XCWqw3jeG6FtuC6fpe16oTeZSvuSZBJPSzSZK0tKfogJ5sE+F4AjehJnhcCyxH4QxhLsvhBJyYReLcdh7FsWqaG8JxaPshiAp+CYhkkrjfr+aJJDBcGgYhyGobOgwAbsO6PLWp7FtRz4tK+fhnjJ8n+MsCw+JJQHXNcdh+CYJqnKcZgdNONZQfOCyOWsJYrGsECQAAZJAzQuAONDOW0CDQrJ8EIUhKFoRhWHvjhawzjJjzQlZ0GkVcmW7F+xZwrEZx5a5sGFaFhLXPOAUbJYo2vhCUrNvNQWRQQC0VL4k2rDNa2dSBe14kJtxAj4Rxns1bWdcVxY3H4Ix+Cscq+C4Fq7Oqk2jXheyIWFRAnSdF26YRu6qbxBmEtCJoWsaPqJk5e7UStgJbAYG1nLsYQbVWQKCl+tZHfdKFfVt+07rqJzfmcZ3xBdqNtcDanGidpEqZcqOXOcez-FsONY0xPXo39gOTvY8OIbsqN-M6FxHCCKMQ1FQRbLCTojKzLhc5eNNPBzNNE6xBLnAGGWxJ+n7nF+BYAkD8PC8bkvxHz8tOkrE5e5cjZ7MdeOdqNLl7AjesFYVLu+pYTzPV5QV+S5AU3dcDrCQYXhTaTxmrdTANS9T2fU9cFnNr4fGOy6KKBGcFynEqQxj+NG5TwzRfXXbAcOjXGOcUz+hHfrPF6zxtEBbaZfOg+uPG8XwddKHjzOu6ZfvXaL97iNzYA8LI8y3ErbNZNOZoQDr8s+A64xxoGaZoT9HnHznMST9PRBp9Pd8+wHiN5EFdLHcYFEhOVKGAEQb5TQNmgXYCCzBVRiHFaKJNRbYn3EsXyPgTYOEGJcUKLk6hj0iE1DqzUJrpE7FcfW4DYbwIXkLdaOFJC4NgXvLBECcF0LwQQjIhNJBGySsHGOplDJJweKw7mHNUYywnJOUsJwdgWJXGYMsXUOELXiMlVKN0uy+DQSDLygtTieJUZBNOAJLj7yvtYYILjxYWJcZYvWzhbG2KEZbdxDj8auOGKY4IQQzENmsW4yJXiXJjx8bqRE8QzA7w6p4EuqxEn5gKBOJccQ6pyzfnE5J8i3EN0jiELxu5kgAWPgXLWXhNLBKvIWQZhYJwP27LZEaF8yzd3sdPJJxSMkzzeN4MpFTKnVNqfUxpzTfgzhvG3OJOp4kj0SbcfMSSJJ2TQi4OsE5AjdCmr+TpOw2ku06RY2JGzRHbPKbEyJdtqZmXJrNWyFJnmbI1NsbJZl3JdXeJ8zWjx-iWynFOHaRVQh9h+dkxJdyMllOJZUspsLNkPHrP0gZJlWlBysQZWJxkApTPAfBYFUKBnpMNoHVJUcJ6JwbHEO6N1gVkshWcsF8KiVgoyQWI5fkdggsmWCzIWxwj7L2Mc05qLdkXPOY7XZKkEi7LafsJyhzbZlJdscJaxxgw2O+vqhOiV5F7DjhcCiLzPk-MyQCyJjzMXPOxfOXFsxPbFhggsaIOprWGPrnrJJdLqX0snnM1yhKumIvySSuOjy+nJwKHYZO4xSJeKfBCBsUKW60rZeS-JLLe7XJJYfMl-iy3LwPl8wFE5Y2AiLPsOpG4Vjrg3D8e+axM0Fq+c25tj4K4TnqWiutHzZXDMGCMyMfTPlVJFU3MFQLQU3ynAFCZCxEgJwHlCJsZ0N01oBmO7IPbU2coTr3d5HaJq+u6sxDBaEzQOFSVJNYqwz02vBbOv5ALp3QoWV84FnS5WPsWUqsVYzxxJuOaFKt4TjFOvBR63F-TsXXvBQ+z4-bCyasmBYztqGEgnH+scL58Rbjrh2t4Q5ow6xnAMz1-6gMzuXWBy936UOVJ+W6i2iwZqdGrOOvpAQO01Q8Gu0iZoez+DiCvPcHCINGJlbK3Vs75WKtNlRYdK8-3OI+n3C1v86wJBdFO3t8KAaUaAzR1WjxVgDBdbxU5HNbHUYqcfGjl96Ohzo63J1fqlPzsJe66mjyPE1CrBW-Ys4VhOTJWGwFEKe29odcOrtPaojepM+F1M17o20YQ5cYqfHkgPFMxK1zG8YGEYs-+qzQHu18Wvfx-D8cO46jUwxLz2TJyJOHfXfcJwr7nyCEwgd7nUPCeMyJ7zZTjsrJQtYwsYRqyLqS4upzNWx3uamwwhlYb6P4oNb0-zGbnO8dCHOuTDHpOwvlKsQ59Qlzz3iF5LsTnL4vtfWFmLcWL5xfOXK9NhXKz8btk9HhGWFiLqWmO3zbm+t9cjKC9AjnVzJGWnYcIh3v6FgHvONdFDgMLDYWJqr8Hv0gbpqRtzxGAteeCfJmDUGYOpqI1e5tDbcmQb7fF4+Znu19Y4z2uzw2A1DazVWlNgaJ1gkOCWKlm7qv3cYyl-bV3B05bJZkz0HCVzBJ-W-cdeqoWqegxq8Hk9y3T0TiNi7SWMdQf-TDqbImBPjemyR7IhZnAVhHkDnr0P8sw5o8J+H-3MsPL67JnQBY+gfFMlOBcjOJ10fZ6OgtQ4Cz7iJ4xNHNH7t-bKULkXyXHvi+SG9gbuvNw-GnMFKqNTLy3e2rZpk78uo3Dq5RmHO2TJ10-0SdBXGOWxkFvkY+RFOPeZ4XfJurD3fuL-XnE9+4bD7xGxIbL46Oqd3vLjH3fJbfK7KLHCL3LPDYBh7YfZFkDHJF5Nq4GJJcFTqFJFqD4H9C4Oq1sH+b+qO-oKDmZ9JFpNhFhFh9j5JA5JWKhJT1LNhD9Qbh7YfAAXZLkHqZyYjj3VyOYJ5Z8FdpjA9gFx+MYdWPKqME5fJ-D4FHf9HNP-T5A9AvQ-SFFxJUNYUoQBApE3YcA8OJ-YI2hZZ04PZi5pIRh1gPCPD9l4JAA`;

  await fs.writeFile(path.join(agentPath, 'agent.ts'), agentTemplate);
}

/**
 * Génère le fichier agent.json avec métadonnées v2.0
 */
async function generateAgentMetadataV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const agentId = generateAgentIdV2(agentInfo.projectName, agentInfo.name);
  
  const metadata = {
    id: agentId,
    name: agentInfo.name,
    type: agentInfo.agentType,  // Format: "project/agent"
    description: agentInfo.description,
    author: agentInfo.author,
    version: '1.0.0',
    project_name: agentInfo.projectName,  // v2.0: Nom du projet
    created_at: new Date().toISOString(),
    xstate_version: '^5.20.0',
    architecture: 'directive-v2.0',
    structure: 'simplified',  // agents/{agent}/ direct
    states: [
      'idle',
      'processing', 
      'success',
      'error'
    ]
  };

  await fs.writeFile(
    path.join(agentPath, 'agent.json'),
    JSON.stringify(metadata, null, 2)
  );
}

/**
 * Génère le fichier desc.mdx avec documentation v2.0
 */
async function generateAgentDocumentationV2(agentPath: string, agentInfo: AgentInfoV2): Promise<void> {
  const documentation = `# ${agentInfo.name}

${agentInfo.description}

## Informations

- **Type**: \`${agentInfo.agentType}\`
- **Auteur**: ${agentInfo.author}
- **Version**: 1.0.0
- **Architecture**: Directive v2.0 (simplifiée)

## Description

Cet agent fait partie du projet **${agentInfo.projectName}** et utilise la nouvelle architecture Directive v2.0 avec une structure simplifiée.

### Fonctionnalités

- ✅ Machine XState pour la logique métier
- ✅ Structure simplifiée \`agents/${agentInfo.name}/\`
- ✅ Base de données globale \`~/.directive/data/\`
- ✅ Type d'agent: \`${agentInfo.agentType}\`

## Usage

### Déploiement

\`\`\`bash
directive deploy agent ${agentInfo.name}
\`\`\`

### Test via API

\`\`\`bash
# Démarrer le serveur
directive start

# Créer une session
curl -X POST http://localhost:3000/sessions \\
  -H "Content-Type: application/json" \\
  -d '{"agent_type": "${agentInfo.agentType}"}'

# Lister les agents
curl http://localhost:3000/agents
\`\`\`

## Structure du Projet

\`\`\`
${agentInfo.projectName}/
├── agents/
│   └── ${agentInfo.name}/
│       ├── agent.ts          # Machine XState
│       ├── agent.json        # Métadonnées
│       └── desc.mdx          # Cette documentation
├── directive-conf.ts         # Configuration application
└── package.json              # Dépendances
\`\`\`

## Développement

### Modifier la logique

Éditez le fichier \`agent.ts\` pour personnaliser la machine XState :

\`\`\`typescript
export const ${toCamelCase(agentInfo.name)}Machine = createMachine({
  // Votre logique ici
});
\`\`\`

### États disponibles

- **idle**: État initial, en attente
- **processing**: Traitement en cours  
- **success**: Traitement réussi
- **error**: Erreur rencontrée

## Architecture v2.0

Cette version utilise la nouvelle architecture Directive v2.0 :

- 🌍 **Configuration globale**: \`~/.directive/config.json\`
- 🗄️ **Base de données globale**: \`~/.directive/data/\`
- 📁 **Structure simplifiée**: Plus de sous-applications
- 🔗 **Mapping automatique**: Projet = Application

---

Créé avec Directive v2.0 le ${new Date().toLocaleDateString('fr-FR')}
`;

  await fs.writeFile(path.join(agentPath, 'desc.mdx'), documentation);
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
  const directiveConfig = `import type { DirectiveConfig } from '@directive/core';

/**
 * Configuration Directive pour l'application ${projectInfo.name}
 * 
 * Version: 2.0 (Architecture simplifiée)
 * - Plus de sous-applications : 1 projet = 1 application
 * - Structure simplifiée : agents/{agent}/ (plus agents/{app}/{agent}/)
 * - Base de données globale : ~/.directive/data/
 * - Configuration globale : ~/.directive/config.json
 */
const config: DirectiveConfig = {
  // === MÉTADONNÉES APPLICATION ===
  name: '${projectInfo.name}',
  description: '${projectInfo.description}',
  author: '${projectInfo.author}',
  version: '1.0.0',

  // === ARCHITECTURE V2.0 ===
  architecture: 'v2.0',
  
  // Configuration locale uniquement pour métadonnées
  // (La base de données et serveur sont configurés globalement)
  metadata: {
    category: 'user-project',
    tags: ['directive-v2.0', 'simplified'],
    created_at: '${new Date().toISOString()}'
  }
};

export default config;
`;

  await fs.writeFile(path.join(projectPath, 'directive-conf.ts'), directiveConfig);
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