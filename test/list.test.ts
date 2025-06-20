import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as os from 'os';

/**
 * Tests d'intégration pour les commandes directive list
 * Valide le listage des applications et agents
 */
describe('Commandes directive list', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-list';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-list-test-'));
    testProjectPath = path.join(tempDir, testProjectName);

    // Créer un projet Directive de base avec applications et agents
    await createTestProject();
  });

  afterEach(async () => {
    // Nettoyer le répertoire temporaire
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Could not clean up temp directory:', error);
    }
  });

  /**
   * Crée un projet Directive complet pour les tests
   */
  async function createTestProject(): Promise<void> {
    // Créer la structure de base
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(path.join(testProjectPath, 'agents'), { recursive: true });

    // Créer directive-conf.ts
    const config = `export const directiveConfig = {
  server: { port: 3000, host: 'localhost' },
  agents: { autoScan: true, scanPath: './agents', hotReload: true },
  database: { type: 'json' as const, config: { dataDir: './data' } },
  iam: { type: 'mock' as const },
  project: { name: '${testProjectName}', author: 'Test Author', version: '1.0.0' }
};`;
    
    await fs.writeFile(path.join(testProjectPath, 'directive-conf.ts'), config);

    // Créer applications et agents de test
    await createTestApplication('webapp', ['frontend', 'backend'], 'Web Team');
    await createTestApplication('mobile', ['ios', 'android'], 'Mobile Team');
    await createTestApplication('emptyapp', [], 'Empty Team');
  }

  /**
   * Crée une application de test avec ses agents
   */
  async function createTestApplication(appName: string, agentNames: string[], author: string): Promise<void> {
    const appPath = path.join(testProjectPath, 'agents', appName);
    await fs.mkdir(appPath, { recursive: true });
    
    // Créer l'application card
    const appCard = {
      id: `app_${appName}_test_123`,
      name: appName,
      description: `${appName} test application`,
      author: author,
      version: '1.0.0',
      agents: agentNames,
      metadata: {
        category: 'test',
        tags: ['test', appName],
        created_at: new Date().toISOString()
      }
    };
    
    await fs.writeFile(
      path.join(appPath, 'index.json'),
      JSON.stringify(appCard, null, 2)
    );

    // Créer les agents
    for (const [index, agentName] of agentNames.entries()) {
      await createTestAgent(appName, agentName, author, index + 1);
    }
  }

  /**
   * Crée un agent de test
   */
  async function createTestAgent(appName: string, agentName: string, author: string, sequence: number): Promise<void> {
    const agentPath = path.join(testProjectPath, 'agents', appName, agentName);
    await fs.mkdir(agentPath, { recursive: true });

    // Créer agent.json
    const agentMetadata = {
      id: `agent_${appName}_${agentName}_test_${sequence}`,
      name: agentName,
      type: `${appName}/${agentName}`,
      description: `${agentName} test agent for ${appName}`,
      author: author,
      version: '1.0.0',
      application: appName,
      created_at: new Date().toISOString(),
      xstate_version: '5.x',
      states: ['initial', 'running', 'completed', 'error']
    };

    await fs.writeFile(
      path.join(agentPath, 'agent.json'),
      JSON.stringify(agentMetadata, null, 2)
    );

    // Créer agent.ts (stub)
    const agentTs = `// Test agent ${agentName}
export const ${agentName}Machine = {};`;
    
    await fs.writeFile(path.join(agentPath, 'agent.ts'), agentTs);
  }

  describe('directive list app', () => {
    it('devrait lister toutes les applications', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list app`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('Applications (3)');
      expect(output).toContain('🏠 emptyapp');
      expect(output).toContain('🏠 mobile');
      expect(output).toContain('🏠 webapp');
      expect(output).toContain('Empty Team');
      expect(output).toContain('Mobile Team');
      expect(output).toContain('Web Team');
    });

    it('devrait afficher les détails des applications', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list app`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Vérifier les détails des applications
      expect(output).toContain('webapp test application');
      expect(output).toContain('mobile test application');
      expect(output).toContain('v1.0.0 • Web Team • 2 agents');
      expect(output).toContain('v1.0.0 • Mobile Team • 2 agents');
      expect(output).toContain('v1.0.0 • Empty Team • 0 agents');
      expect(output).toContain('Agents: frontend, backend');
      expect(output).toContain('Agents: ios, android');
    });

    it('devrait afficher un message quand aucune application n\'existe', async () => {
      // Créer un projet vide
      const emptyProjectPath = path.join(tempDir, 'empty-project');
      await fs.mkdir(emptyProjectPath, { recursive: true });
      await fs.mkdir(path.join(emptyProjectPath, 'agents'), { recursive: true });

      const config = `export const directiveConfig = {
  server: { port: 3000, host: 'localhost' },
  agents: { autoScan: true, scanPath: './agents', hotReload: true },
  database: { type: 'json' as const, config: { dataDir: './data' } },
  iam: { type: 'mock' as const },
  project: { name: 'empty-project', author: 'Test Author', version: '1.0.0' }
};`;
      
      await fs.writeFile(path.join(emptyProjectPath, 'directive-conf.ts'), config);

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list app`;
      
      const output = execSync(command, { cwd: emptyProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No applications found in this project');
      expect(output).toContain('directive create app');
    });

    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list app`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('directive list agents', () => {
    it('devrait lister tous les agents groupés par application', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('All agents (4)');
      expect(output).toContain('🏠 mobile/');
      expect(output).toContain('🏠 webapp/');
      expect(output).toContain('🤖 frontend');
      expect(output).toContain('🤖 backend');
      expect(output).toContain('🤖 ios');
      expect(output).toContain('🤖 android');
    });

    it('devrait filtrer par application', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app webapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('Agents in application "webapp" (2)');
      expect(output).toContain('🤖 frontend');
      expect(output).toContain('🤖 backend');
      expect(output).not.toContain('ios');
      expect(output).not.toContain('android');
      expect(output).not.toContain('🏠 mobile/');
    });

    it('devrait afficher les détails des agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app mobile`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Vérifier les détails des agents
      expect(output).toContain('ios test agent for mobile');
      expect(output).toContain('android test agent for mobile');
      expect(output).toContain('Mobile Team');
      expect(output).toContain('v1.0.0');
      expect(output).toContain('4 states');
    });

    it('devrait afficher un message quand aucun agent n\'est trouvé', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app nonexistent`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No agents found in application "nonexistent"');
      expect(output).toContain('directive create agent');
    });

    it('devrait afficher un message quand aucun agent n\'existe dans le projet', async () => {
      // Créer un projet avec applications vides
      const emptyProjectPath = path.join(tempDir, 'empty-agents-project');
      await fs.mkdir(emptyProjectPath, { recursive: true });
      await fs.mkdir(path.join(emptyProjectPath, 'agents'), { recursive: true });

      const config = `export const directiveConfig = {
  server: { port: 3000, host: 'localhost' },
  agents: { autoScan: true, scanPath: './agents', hotReload: true },
  database: { type: 'json' as const, config: { dataDir: './data' } },
  iam: { type: 'mock' as const },
  project: { name: 'empty-agents-project', author: 'Test Author', version: '1.0.0' }
};`;
      
      await fs.writeFile(path.join(emptyProjectPath, 'directive-conf.ts'), config);

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents`;
      
      const output = execSync(command, { cwd: emptyProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No agents found in this project');
      expect(output).toContain('directive create agent');
    });
  });

  describe('Validation du projet Directive', () => {
    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      ['list app', 'list agents'].forEach(command => {
        expect(() => {
          execSync(`node ${cliPath} ${command}`, { cwd: tempDir, stdio: 'pipe' });
        }).toThrow();
      });
    });

    it('devrait échouer si le répertoire agents n\'existe pas', async () => {
      // Créer un projet sans répertoire agents
      const invalidProjectPath = path.join(tempDir, 'invalid-project');
      await fs.mkdir(invalidProjectPath, { recursive: true });

      const config = `export const directiveConfig = {
  server: { port: 3000, host: 'localhost' },
  agents: { autoScan: true, scanPath: './agents', hotReload: true },
  database: { type: 'json' as const, config: { dataDir: './data' } },
  iam: { type: 'mock' as const },
  project: { name: 'invalid-project', author: 'Test Author', version: '1.0.0' }
};`;
      
      await fs.writeFile(path.join(invalidProjectPath, 'directive-conf.ts'), config);

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      ['list app', 'list agents'].forEach(command => {
        expect(() => {
          execSync(`node ${cliPath} ${command}`, { cwd: invalidProjectPath, stdio: 'pipe' });
        }).toThrow();
      });
    });
  });

  describe('Gestion des erreurs de scan', () => {
    it('devrait ignorer les applications sans index.json valide', async () => {
      // Créer un répertoire d'application sans index.json
      const invalidAppPath = path.join(testProjectPath, 'agents/invalid-app');
      await fs.mkdir(invalidAppPath, { recursive: true });
      await fs.writeFile(path.join(invalidAppPath, 'some-file.txt'), 'Invalid app');

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list app`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Devrait toujours afficher les 3 applications valides
      expect(output).toContain('Applications (3)');
      expect(output).not.toContain('invalid-app');
    });

    it('devrait ignorer les agents sans agent.json valide', async () => {
      // Créer un répertoire d'agent sans agent.json
      const invalidAgentPath = path.join(testProjectPath, 'agents/webapp/invalid-agent');
      await fs.mkdir(invalidAgentPath, { recursive: true });
      await fs.writeFile(path.join(invalidAgentPath, 'agent.ts'), '// Agent sans metadata');

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app webapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Devrait toujours afficher les 2 agents valides de webapp
      expect(output).toContain('Agents in application "webapp" (2)');
      expect(output).not.toContain('invalid-agent');
    });

    it('devrait ignorer les répertoires cachés', async () => {
      // Créer des répertoires cachés
      const hiddenAppPath = path.join(testProjectPath, 'agents/.hidden-app');
      await fs.mkdir(hiddenAppPath, { recursive: true });

      const hiddenAgentPath = path.join(testProjectPath, 'agents/webapp/.hidden-agent');
      await fs.mkdir(hiddenAgentPath, { recursive: true });

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      const appOutput = execSync(`node ${cliPath} list app`, { cwd: testProjectPath, encoding: 'utf-8' });
      const agentOutput = execSync(`node ${cliPath} list agents`, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(appOutput).not.toContain('.hidden-app');
      expect(agentOutput).not.toContain('.hidden-agent');
    });
  });
}); 