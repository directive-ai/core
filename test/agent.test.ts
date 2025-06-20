import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as os from 'os';

/**
 * Tests d'intégration pour les commandes directive agent
 * Valide la création et listage d'agents directeurs
 */
describe('Commandes directive agent', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-agent';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-agent-test-'));
    testProjectPath = path.join(tempDir, testProjectName);

    // Créer un projet Directive de base avec une application
    await createBasicDirectiveProjectWithApp();
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
   * Crée un projet Directive basique avec une application pour les tests
   */
  async function createBasicDirectiveProjectWithApp(): Promise<void> {
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

    // Créer une application de test
    await fs.mkdir(path.join(testProjectPath, 'agents/testapp'), { recursive: true });
    
    const appCard = {
      id: 'app_testapp_test_123',
      name: 'testapp',
      description: 'Test application',
      author: 'Test Author',
      version: '1.0.0',
      agents: [],
      metadata: {
        category: 'test',
        tags: ['test'],
        created_at: new Date().toISOString()
      }
    };
    
    await fs.writeFile(
      path.join(testProjectPath, 'agents/testapp/index.json'),
      JSON.stringify(appCard, null, 2)
    );
  }

  describe('directive agent create', () => {
    it('devrait créer un agent avec toutes les options', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp simple-agent --author "Custom Author" --description "Test agent description"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      // Vérifier que le répertoire est créé
      const agentPath = path.join(testProjectPath, 'agents/testapp/simple-agent');
      const exists = await fs.access(agentPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Vérifier les fichiers créés
      const agentTsExists = await fs.access(path.join(agentPath, 'agent.ts')).then(() => true).catch(() => false);
      const agentJsonExists = await fs.access(path.join(agentPath, 'agent.json')).then(() => true).catch(() => false);
      const descMdxExists = await fs.access(path.join(agentPath, 'desc.mdx')).then(() => true).catch(() => false);
      
      expect(agentTsExists).toBe(true);
      expect(agentJsonExists).toBe(true);
      expect(descMdxExists).toBe(true);
    });

    it('devrait valider le contenu du fichier agent.json', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp metadata-test --author "Meta Author" --description "Agent for metadata testing"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const agentJsonPath = path.join(testProjectPath, 'agents/testapp/metadata-test/agent.json');
      const agentContent = await fs.readFile(agentJsonPath, 'utf-8');
      const agentData = JSON.parse(agentContent);

      expect(agentData.name).toBe('metadata-test');
      expect(agentData.type).toBe('testapp/metadata-test');
      expect(agentData.description).toBe('Agent for metadata testing');
      expect(agentData.author).toBe('Meta Author');
      expect(agentData.version).toBe('1.0.0');
      expect(agentData.application).toBe('testapp');
      expect(agentData.id).toMatch(/^agent_testapp_metadata-test_/);
      expect(agentData.states).toEqual(['initial', 'runningLeft', 'runningRight', 'terminated']);
      expect(agentData.xstate_version).toBe('5.x');
    });

    it('devrait valider le contenu du fichier agent.ts', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp xstate-test --author "XState Author" --description "XState testing agent"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const agentTsPath = path.join(testProjectPath, 'agents/testapp/xstate-test/agent.ts');
      const agentContent = await fs.readFile(agentTsPath, 'utf-8');

      // Vérifier les imports XState
      expect(agentContent).toContain("import { createMachine, assign } from 'xstate'");
      expect(agentContent).toContain("const registerAgent = (config: any) =>");
      
      // Vérifier la définition de la machine
      expect(agentContent).toContain('const xstateTestMachine = createMachine');
      expect(agentContent).toContain("id: 'xstate-test'");
      expect(agentContent).toContain("initial: 'initial'");
      
      // Vérifier les états
      expect(agentContent).toContain('initial:');
      expect(agentContent).toContain('runningLeft:');
      expect(agentContent).toContain('runningRight:');
      expect(agentContent).toContain('terminated:');
      
      // Vérifier les transitions
      expect(agentContent).toContain('CHOOSE_LEFT');
      expect(agentContent).toContain('CHOOSE_RIGHT');
      expect(agentContent).toContain('COMPLETE');
      expect(agentContent).toContain('ERROR');
      
      // Vérifier l'enregistrement
      expect(agentContent).toContain('registerAgent({');
      expect(agentContent).toContain("type: 'testapp/xstate-test'");
    });

    it('devrait valider le contenu du fichier desc.mdx', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp doc-test --author "Doc Author" --description "Documentation testing agent"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const descMdxPath = path.join(testProjectPath, 'agents/testapp/doc-test/desc.mdx');
      const descContent = await fs.readFile(descMdxPath, 'utf-8');

      // Vérifier la structure de documentation
      expect(descContent).toContain('# Documentation testing agent');
      expect(descContent).toContain('## Overview');
      expect(descContent).toContain('## State Machine Flow');
      expect(descContent).toContain('## States Description');
      expect(descContent).toContain('## Context Data');
      expect(descContent).toContain('## Events');
      expect(descContent).toContain('## Usage Example');
      
      // Vérifier les détails spécifiques
      expect(descContent).toContain('testapp/doc-test');
      expect(descContent).toContain('Doc Author');
      expect(descContent).toContain('stateDiagram-v2');
      
      // Vérifier les exemples curl
      expect(descContent).toContain('curl -X POST http://localhost:3000/sessions');
      expect(descContent).toContain('CHOOSE_LEFT');
      expect(descContent).toContain('CHOOSE_RIGHT');
    });

    it('devrait mettre à jour l\'application card', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp update-test --author "Update Author" --description "Test application card update"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const appCardPath = path.join(testProjectPath, 'agents/testapp/index.json');
      const appContent = await fs.readFile(appCardPath, 'utf-8');
      const appData = JSON.parse(appContent);

      expect(appData.agents).toContain('update-test');
    });

    it('devrait échouer si l\'application n\'existe pas', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create nonexistent test-agent --author "Test" --description "Test"`;
      
      expect(() => {
        execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait échouer si l\'agent existe déjà', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp duplicate-agent --author "Test" --description "Test"`;
      
      // Première création - devrait réussir
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      // Deuxième création - devrait échouer
      expect(() => {
        execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait valider le format du nom d\'agent', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      const invalidNames = ['Agent', 'my.agent', 'my agent', 'agent@123', 'a', 'core', 'index'];
      
      for (const name of invalidNames) {
        const command = `node ${cliPath} agent create testapp "${name}" --author "Test" --description "Test"`;
        
        expect(() => {
          execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
        }).toThrow();
      }
    });
  });

  describe('directive agent list', () => {
    beforeEach(async () => {
      // Créer quelques agents de test
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      execSync(`node ${cliPath} agent create testapp agent1 --author "Author1" --description "First test agent"`, 
        { cwd: testProjectPath, stdio: 'pipe' });
      
      execSync(`node ${cliPath} agent create testapp agent2 --author "Author2" --description "Second test agent"`, 
        { cwd: testProjectPath, stdio: 'pipe' });

      // Créer une deuxième application
      await fs.mkdir(path.join(testProjectPath, 'agents/otherapp'), { recursive: true });
      const appCard2 = {
        id: 'app_otherapp_test_456',
        name: 'otherapp',
        description: 'Other test application',
        author: 'Test Author',
        version: '1.0.0',
        agents: [],
        metadata: {
          category: 'test',
          tags: ['test'],
          created_at: new Date().toISOString()
        }
      };
      
      await fs.writeFile(
        path.join(testProjectPath, 'agents/otherapp/index.json'),
        JSON.stringify(appCard2, null, 2)
      );

      execSync(`node ${cliPath} agent create otherapp agent3 --author "Author3" --description "Third test agent"`, 
        { cwd: testProjectPath, stdio: 'pipe' });
    });

    it('devrait lister tous les agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent list`;
      
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
      const command = `node ${cliPath} agent list --app testapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('Agents in application "testapp" (2)');
      expect(output).toContain('agent1');
      expect(output).toContain('agent2');
      expect(output).not.toContain('agent3');
      expect(output).not.toContain('otherapp');
    });

    it('devrait afficher un message quand aucun agent n\'est trouvé', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent list --app nonexistent`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      expect(output).toContain('No agents found in application "nonexistent"');
    });

    it('devrait afficher les détails des agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent list --app testapp`;
      
      const output = execSync(command, { cwd: testProjectPath, encoding: 'utf-8' });
      
      // Vérifier les détails des agents
      expect(output).toContain('First test agent');
      expect(output).toContain('Second test agent');
      expect(output).toContain('Author1');
      expect(output).toContain('Author2');
      expect(output).toContain('v1.0.0');
      expect(output).toContain('4 states');
    });
  });

  describe('Validation du projet Directive', () => {
    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent create testapp test-agent --author "Test" --description "Test"`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait échouer pour agent list si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} agent list`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
    });
  });
}); 