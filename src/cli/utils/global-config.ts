import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface GlobalConfig {
  database: {
    type: 'json' | 'mongodb' | 'postgresql';
    config: {
      path?: string;
      url?: string;
      database?: string;
      host?: string;
      port?: number;
      username?: string;
      password?: string;
    };
  };
  server: {
    defaultPort: number;
    defaultHost: string;
  };
  preferences: {
    defaultAuthor?: string;
    defaultCategory?: string;
  };
  version: string;
}

export interface ApplicationConfig {
  application: {
    name: string;
    description: string;
    author: string;
    version: string;
    metadata?: {
      category?: string;
      tags?: string[];
    };
  };
}

/**
 * Retourne le chemin vers ~/.directive/
 */
export function getGlobalDirectivePath(): string {
  return path.join(os.homedir(), '.directive');
}

/**
 * Retourne le chemin vers ~/.directive/config.json
 */
export function getGlobalConfigPath(): string {
  return path.join(getGlobalDirectivePath(), 'config.json');
}

/**
 * Retourne le chemin vers ~/.directive/data/
 */
export function getGlobalDbPath(): string {
  return path.join(getGlobalDirectivePath(), 'data');
}

/**
 * Vérifie si la configuration globale existe
 */
export async function hasGlobalConfig(): Promise<boolean> {
  try {
    await fs.access(getGlobalConfigPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Crée la structure ~/.directive/ si elle n'existe pas
 */
export async function createGlobalDirectoryStructure(): Promise<void> {
  const globalPath = getGlobalDirectivePath();
  const dataPath = getGlobalDbPath();
  const logsPath = path.join(globalPath, 'logs');

  await fs.mkdir(globalPath, { recursive: true });
  await fs.mkdir(dataPath, { recursive: true });
  await fs.mkdir(logsPath, { recursive: true });

  console.log(chalk.green(`✅ Global Directive structure created at ${globalPath}`));
}

/**
 * Lit la configuration globale
 */
export async function getGlobalConfig(): Promise<GlobalConfig> {
  const configPath = getGlobalConfigPath();
  
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Cannot read global configuration at ${configPath}. Run 'directive init' first.`);
  }
}

/**
 * Sauvegarde la configuration globale
 */
export async function setGlobalConfig(config: GlobalConfig): Promise<void> {
  const configPath = getGlobalConfigPath();
  
  // Créer la structure si elle n'existe pas
  await createGlobalDirectoryStructure();
  
  await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 2),
    'utf-8'
  );

  console.log(chalk.green(`✅ Global configuration saved to ${configPath}`));
}

/**
 * Crée une configuration globale par défaut
 */
export function createDefaultGlobalConfig(author?: string): GlobalConfig {
  return {
    database: {
      type: 'json',
      config: {
        path: getGlobalDbPath()
      }
    },
    server: {
      defaultPort: 3000,
      defaultHost: 'localhost'
    },
    preferences: {
      defaultAuthor: author || 'Directive Team',
      defaultCategory: 'custom'
    },
    version: '2.0.0'
  };
}

/**
 * Lit la configuration application (directive-conf.ts)
 */
export async function getAppConfig(projectPath?: string): Promise<ApplicationConfig> {
  const basePath = projectPath || process.cwd();
  const configPath = path.join(basePath, 'directive-conf.ts');
  
  try {
    await fs.access(configPath);
    
    // Lecture simple du fichier pour extraire la config
    const configContent = await fs.readFile(configPath, 'utf-8');
    
    // Extraction basique des métadonnées de l'application
    const nameMatch = configContent.match(/name:\s*['"`]([^'"`]+)['"`]/);
    const descMatch = configContent.match(/description:\s*['"`]([^'"`]+)['"`]/);
    const authorMatch = configContent.match(/author:\s*['"`]([^'"`]+)['"`]/);
    const versionMatch = configContent.match(/version:\s*['"`]([^'"`]+)['"`]/);
    
    if (!nameMatch) {
      throw new Error('Invalid directive-conf.ts: missing application name');
    }
    
    return {
      application: {
        name: nameMatch[1],
        description: descMatch?.[1] || '',
        author: authorMatch?.[1] || 'Unknown',
        version: versionMatch?.[1] || '1.0.0'
      }
    };
  } catch (error) {
    throw new Error(`Cannot read application configuration at ${configPath}. Not in a Directive project?`);
  }
}

/**
 * Génère la configuration directive-conf.ts pour une application
 */
export async function generateAppConfig(
  projectPath: string, 
  appInfo: {
    name: string;
    author: string;
    description: string;
    version?: string;
  },
  globalConfig?: GlobalConfig
): Promise<void> {
  // Utiliser l'auteur par défaut de la config globale si disponible
  const author = appInfo.author || globalConfig?.preferences?.defaultAuthor || 'Directive Team';
  
  const config = `// Directive application configuration for ${appInfo.name}
export const directiveConfig = {
  application: {
    name: '${appInfo.name}',
    description: '${appInfo.description}',
    author: '${author}',
    version: '${appInfo.version || '1.0.0'}',
    metadata: {
      category: '${globalConfig?.preferences?.defaultCategory || 'custom'}',
      tags: ['directive', 'agents']
    }
  }
};

export default directiveConfig;
`;

  await fs.writeFile(
    path.join(projectPath, 'directive-conf.ts'),
    config
  );
}

/**
 * Valide qu'un projet a bien une configuration d'application
 */
export async function validateDirectiveProject(projectPath?: string): Promise<void> {
  const basePath = projectPath || process.cwd();
  
  const configFile = path.join(basePath, 'directive-conf.ts');
  const agentsDir = path.join(basePath, 'agents');
  
  try {
    await fs.access(configFile);
  } catch {
    throw new Error('Not in a Directive project. Missing directive-conf.ts file.');
  }

  try {
    await fs.access(agentsDir);
  } catch {
    throw new Error('Not in a Directive project. Missing agents/ directory.');
  }
}

/**
 * Initialise la base de données globale (structure de base compatible JsonDatabaseService)
 */
export async function initializeGlobalDatabase(): Promise<void> {
  const globalConfig = await getGlobalConfig();
  
  if (globalConfig.database.type === 'json') {
    const dbPath = path.join(getGlobalDbPath(), 'directive.json');
    
    // Vérifier si la base existe déjà
    try {
      await fs.access(dbPath);
      
      // Vérifier si elle a le bon format (v2.0 compatible JsonDatabaseService)
      const existingContent = await fs.readFile(dbPath, 'utf-8');
      const existingDb = JSON.parse(existingContent);
      
      // Si c'est l'ancien format (arrays au lieu d'objects), migrer
      if (Array.isArray(existingDb.applications) || !existingDb.metadata) {
        console.log(chalk.yellow('🔄 Migrating global database to v2.0 format...'));
        await migrateGlobalDatabase(dbPath, existingDb);
        return;
      }
      
      console.log(chalk.yellow('ℹ️ Global database already exists and is up-to-date'));
      return;
    } catch {
      // C'est normal qu'elle n'existe pas encore
    }
    
    // Créer la structure de base de données vide compatible JsonDatabaseService
    const initialDb = {
      applications: {},              // Object (pas array)
      sessions: {},                  // Object (pas array)  
      agents: {},                    // Object (pas array)
      conversation_history: [],      // Array (nom correct)
      metadata: {                    // Structure metadata
        version: '2.0.0',
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      }
    };
    
    await fs.writeFile(dbPath, JSON.stringify(initialDb, null, 2));
    console.log(chalk.green(`✅ Global database initialized at ${dbPath} with v2.0 format`));
  } else {
    console.log(chalk.yellow(`ℹ️ Database type ${globalConfig.database.type} - external database initialization skipped`));
  }
}

/**
 * Migre l'ancienne structure de base de données vers le nouveau format v2.0
 */
async function migrateGlobalDatabase(dbPath: string, oldDb: any): Promise<void> {
  // Convertir l'ancien format vers le nouveau
  const migratedDb = {
    applications: {},              // Convertir array → object
    sessions: {},                  // Convertir array → object
    agents: {},                    // Convertir array → object
    conversation_history: oldDb.deployment_history || oldDb.conversation_history || [],
    metadata: {
      version: '2.0.0',
      created_at: oldDb.created_at || new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
  };
  
  // Si il y avait des données dans l'ancien format, les préserver
  if (Array.isArray(oldDb.applications)) {
    oldDb.applications.forEach((app: any) => {
      if (app.id) {
        migratedDb.applications[app.id] = app;
      }
    });
  }
  
  if (Array.isArray(oldDb.agents)) {
    oldDb.agents.forEach((agent: any) => {
      if (agent.id) {
        migratedDb.agents[agent.id] = agent;
      }
    });
  }
  
  if (Array.isArray(oldDb.sessions)) {
    oldDb.sessions.forEach((session: any) => {
      if (session.session_id) {
        migratedDb.sessions[session.session_id] = session;
      }
    });
  }
  
  // Créer une sauvegarde de l'ancien fichier
  const backupPath = dbPath + '.backup.' + Date.now();
  await fs.writeFile(backupPath, JSON.stringify(oldDb, null, 2));
  
  // Écrire la nouvelle structure
  await fs.writeFile(dbPath, JSON.stringify(migratedDb, null, 2));
  
  console.log(chalk.green(`✅ Database migrated to v2.0 format`));
  console.log(chalk.gray(`   Backup saved: ${backupPath}`));
} 