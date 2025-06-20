import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as os from 'os';

/**
 * Tests d'intégration pour la commande directive agent list
 * Valide le listage des agents directeurs
 */
describe('Commande directive list agents', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-agent-list';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-agent-list-test-'));
    testProjectPath = path.join(tempDir, testProjectName);

    // Créer un projet Directive de base avec des agents
    await createBasicDirectiveProjectWithAgents();
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
   * Crée un projet Directive basique avec des agents pour les tests
   */
  async function createBasicDirectiveProjectWithAgents(): Promise<void> {
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

    // Créer package.json
    const packageJson = {
      name: testProjectName,
      version: '1.0.0',
      description: 'Test project',
      author: 'Test Author'
    };
    
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Créer application testapp avec agents
    await createTestApplication('testapp', ['agent1', 'agent2']);
    
    // Créer application otherapp avec un agent
    await createTestApplication('otherapp', ['agent3']);
  }

  /**
   * Crée une application de test avec ses agents
   */
  async function createTestApplication(appName: string, agentNames: string[]): Promise<void> {
    const appPath = path.join(testProjectPath, 'agents', appName);
    await fs.mkdir(appPath, { recursive: true });
    
    // Créer l'application card
    const appCard = {
      id: `app_${appName}_test_123`,
      name: appName,
      description: `${appName} test application`,
      author: 'Test Author',
      version: '1.0.0',
      agents: agentNames,
      metadata: {
        category: 'test',
        tags: ['test'],
        created_at: new Date().toISOString()
      }
    };
    
    await fs.writeFile(
      path.join(appPath, 'index.json'),
      JSON.stringify(appCard, null, 2)
    );

    // Créer les agents
    for (const [index, agentName] of agentNames.entries()) {
      await createTestAgent(appName, agentName, index + 1);
    }
  }

  /**
   * Crée un agent de test
   */
  async function createTestAgent(appName: string, agentName: string, authorNumber: number): Promise<void> {
    const agentPath = path.join(testProjectPath, 'agents', appName, agentName);
    await fs.mkdir(agentPath, { recursive: true });

    // Créer agent.json
    const agentMetadata = {
      id: `agent_${appName}_${agentName}_test_${authorNumber}`,
      name: agentName,
      type: `${appName}/${agentName}`,
      description: `${agentName} test agent description`,
      author: `Author${authorNumber}`,
      version: '1.0.0',
      application: appName,
      created_at: new Date().toISOString(),
      xstate_version: '5.x',
      states: ['initial', 'runningLeft', 'runningRight', 'terminated']
    };

    await fs.writeFile(
      path.join(agentPath, 'agent.json'),
      JSON.stringify(agentMetadata, null, 2)
    );

    // Créer agent.ts (simple stub)
    const agentTs = `// Test agent ${agentName} for ${appName}
export const ${agentName}Machine = {};`;
    
    await fs.writeFile(path.join(agentPath, 'agent.ts'), agentTs);

    // Créer desc.mdx (simple stub)
    const descMdx = `# ${agentName} Agent
Test documentation for ${agentName} agent.`;
    
    await fs.writeFile(path.join(agentPath, 'desc.mdx'), descMdx);
  }

  describe('directive list agents', () => {
    it('devrait lister tous les agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('All agents (3)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).toContain('agent3');
      expect(output).toContain('testapp/');
      expect(output).toContain('otherapp/');
    });

    it('devrait filtrer par application', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app testapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('Agents in application "testapp" (2)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).not.toContain('agent3');
      expect(output).not.toContain('otherapp');
    });

    it('devrait afficher un message quand aucun agent n\'est trouvé', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app nonexistent`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No agents found in application "nonexistent"');
      expect(output).toContain('directive create agent');
    });

    it('devrait afficher les détails des agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app testapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Vérifier les détails des agents
      expect(output).toContain('agent1 test agent description');
      expect(output).toContain('agent2 test agent description');
      expect(output).toContain('Author1');
      expect(output).toContain('Author2');
      expect(output).toContain('v1.0.0');
      expect(output).toContain('4 states');
    });

    it('devrait afficher un message quand aucun agent n\'existe dans le projet', async () => {
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
      const command = `node ${cliPath} list agents`;
      
      const output = execSync(command, { cwd: emptyProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No agents found in this project');
      expect(output).toContain('directive create agent');
    });
  });

  describe('Validation du projet Directive', () => {
    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
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
      const command = `node ${cliPath} list agents`;
      
      expect(() => {
        execSync(command, { cwd: invalidProjectPath, stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('Gestion des erreurs de scan', () => {
    it('devrait ignorer les agents sans agent.json valide', async () => {
      // Créer un répertoire d'agent sans agent.json
      const invalidAgentPath = path.join(testProjectPath, 'agents/testapp/invalid-agent');
      await fs.mkdir(invalidAgentPath, { recursive: true });
      await fs.writeFile(path.join(invalidAgentPath, 'agent.ts'), '// Agent sans metadata');

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents --app testapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Devrait toujours afficher les 2 agents valides
      expect(output).toContain('Agents in application "testapp" (2)');
      expect(output).not.toContain('invalid-agent');
    });

    it('devrait ignorer les répertoires cachés', async () => {
      // Créer un répertoire caché
      const hiddenPath = path.join(testProjectPath, 'agents/.hidden');
      await fs.mkdir(hiddenPath, { recursive: true });

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} list agents`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Devrait afficher les 3 agents normaux
      expect(output).toContain('All agents (3)');
      expect(output).not.toContain('.hidden');
    });
  });
}); 