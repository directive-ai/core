import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as os from 'os';

/**
 * Tests d'intégration pour la commande directive create app
 * Valide la création d'applications dans un projet Directive existant
 */
describe('Commande directive create app', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-project';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-create-test-'));
    testProjectPath = path.join(tempDir, testProjectName);

    // Créer un projet Directive de base pour les tests
    await createBasicDirectiveProject();
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
   * Crée un projet Directive basique pour les tests
   */
  async function createBasicDirectiveProject(): Promise<void> {
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

    // Créer .gitkeep dans agents
    await fs.writeFile(path.join(testProjectPath, 'agents/.gitkeep'), '');
  }

  describe('Validation du projet Directive', () => {
    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create app test-app --author "Test Author" --description "Test Description"`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait réussir dans un projet Directive valide', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create app test-app --author "Test Author" --description "Test Description"`;
      
      expect(() => {
        execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
      }).not.toThrow();
    });
  });

  describe('Création d\'application', () => {
    it('devrait créer une application avec toutes les options', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const appName = 'my-test-app';
      const command = `node ${cliPath} create app ${appName} --author "Custom Author" --description "Custom Description"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      // Vérifier que le répertoire est créé
      const appPath = path.join(testProjectPath, 'agents', appName);
      const exists = await fs.access(appPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Vérifier que index.json est créé
      const indexPath = path.join(appPath, 'index.json');
      const indexExists = await fs.access(indexPath).then(() => true).catch(() => false);
      expect(indexExists).toBe(true);

      // Vérifier le contenu de index.json
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const appData = JSON.parse(indexContent);

      expect(appData.name).toBe(appName);
      expect(appData.description).toBe('Custom Description');
      expect(appData.author).toBe('Custom Author');
      expect(appData.version).toBe('1.0.0');
      expect(appData.agents).toEqual([]);
      expect(appData.id).toMatch(/^app_my-test-app_/);
      expect(appData.metadata.category).toBe('custom');
      expect(appData.metadata.tags).toContain('application');
      expect(appData.metadata.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('devrait créer une application avec auteur depuis la config du projet', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const appName = 'auto-author-app';
      const command = `node ${cliPath} create app ${appName} --description "Auto Author Test"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const indexPath = path.join(testProjectPath, 'agents', appName, 'index.json');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      const appData = JSON.parse(indexContent);

      // L'auteur devrait être extrait de la config du projet
      expect(appData.author).toBe('Test Author');
    });

    it('devrait échouer si l\'application existe déjà', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const appName = 'duplicate-app';
      const command = `node ${cliPath} create app ${appName} --author "Test Author" --description "Test Description"`;
      
      // Première création - devrait réussir
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      // Deuxième création - devrait échouer
      expect(() => {
        execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('Validation du nom d\'application', () => {
    it('devrait accepter des noms valides', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const validNames = ['app', 'my-app', 'my_app', 'app123', 'a1-b2-c3'];
      
      for (const name of validNames) {
        const command = `node ${cliPath} create app ${name} --author "Test" --description "Test"`;
        
        expect(() => {
          execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
        }).not.toThrow();
      }
    });

    it('devrait rejeter des noms invalides', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const invalidNames = ['App', 'my.app', 'my app', 'app@123', 'a', ''];
      
      for (const name of invalidNames) {
        const command = `node ${cliPath} create app "${name}" --author "Test" --description "Test"`;
        
        expect(() => {
          execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
        }).toThrow();
      }
    });

    it('devrait rejeter des noms réservés', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const reservedNames = ['core', 'system', 'admin', 'api', 'config'];
      
      for (const name of reservedNames) {
        const command = `node ${cliPath} create app ${name} --author "Test" --description "Test"`;
        
        expect(() => {
          execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
        }).toThrow();
      }
    });

    it('devrait valider la longueur du nom', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      
      // Nom trop court
      const shortName = 'a';
      const shortCommand = `node ${cliPath} create app ${shortName} --author "Test" --description "Test"`;
      expect(() => {
        execSync(shortCommand, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();

      // Nom trop long
      const longName = 'a'.repeat(51);
      const longCommand = `node ${cliPath} create app ${longName} --author "Test" --description "Test"`;
      expect(() => {
        execSync(longCommand, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('Structure des fichiers générés', () => {
    it('devrait générer un ID unique pour chaque application', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create app test-unique --author "Test" --description "Test"`;
      
      // Créer deux applications rapidement
      execSync(command.replace('test-unique', 'app1'), { cwd: testProjectPath, stdio: 'pipe' });
      execSync(command.replace('test-unique', 'app2'), { cwd: testProjectPath, stdio: 'pipe' });

      // Vérifier que les IDs sont différents
      const app1Data = JSON.parse(await fs.readFile(path.join(testProjectPath, 'agents/app1/index.json'), 'utf-8'));
      const app2Data = JSON.parse(await fs.readFile(path.join(testProjectPath, 'agents/app2/index.json'), 'utf-8'));

      expect(app1Data.id).not.toBe(app2Data.id);
      expect(app1Data.id).toMatch(/^app_app1_/);
      expect(app2Data.id).toMatch(/^app_app2_/);
    });

    it('devrait créer une structure JSON valide', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create app json-test --author "Test" --description "Test"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const indexPath = path.join(testProjectPath, 'agents/json-test/index.json');
      const content = await fs.readFile(indexPath, 'utf-8');
      
      // Vérifier que c'est du JSON valide
      expect(() => JSON.parse(content)).not.toThrow();
      
      // Vérifier la structure
      const data = JSON.parse(content);
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('author');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('agents');
      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toHaveProperty('category');
      expect(data.metadata).toHaveProperty('tags');
      expect(data.metadata).toHaveProperty('created_at');
    });
  });
});

/**
 * Tests d'intégration pour la commande directive create agent
 * Valide la création d'agents directeurs dans des applications existantes
 */
describe('Commande directive create agent', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-create-agent';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-create-agent-test-'));
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

    // Créer une deuxième application
    await fs.mkdir(path.join(testProjectPath, 'agents/metacopi'), { recursive: true });
    
    const appCard2 = {
      id: 'app_metacopi_test_456',
      name: 'metacopi',
      description: 'Metacopi application',
      author: 'Test Author',
      version: '1.0.0',
      agents: [],
      metadata: {
        category: 'text',
        tags: ['correction'],
        created_at: new Date().toISOString()
      }
    };
    
    await fs.writeFile(
      path.join(testProjectPath, 'agents/metacopi/index.json'),
      JSON.stringify(appCard2, null, 2)
    );
  }

  describe('directive create agent avec options CLI', () => {
    it('devrait créer un agent avec toutes les options CLI', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app testapp --name simple-agent --author "Custom Author" --description "Test agent description"`;
      
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
      const command = `node ${cliPath} create agent --app metacopi --name correction --author "Meta Author" --description "Agent de correction"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const agentJsonPath = path.join(testProjectPath, 'agents/metacopi/correction/agent.json');
      const agentContent = await fs.readFile(agentJsonPath, 'utf-8');
      const agentData = JSON.parse(agentContent);

      expect(agentData.name).toBe('correction');
      expect(agentData.type).toBe('metacopi/correction');
      expect(agentData.description).toBe('Agent de correction');
      expect(agentData.author).toBe('Meta Author');
      expect(agentData.version).toBe('1.0.0');
      expect(agentData.application).toBe('metacopi');
      expect(agentData.id).toMatch(/^agent_metacopi_correction_/);
      expect(agentData.states).toEqual(['initial', 'runningLeft', 'runningRight', 'terminated']);
      expect(agentData.xstate_version).toBe('5.x');
    });

    it('devrait mettre à jour l\'application card', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app testapp --name update-test --author "Update Author" --description "Test application card update"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const appCardPath = path.join(testProjectPath, 'agents/testapp/index.json');
      const appContent = await fs.readFile(appCardPath, 'utf-8');
      const appData = JSON.parse(appContent);

      expect(appData.agents).toContain('update-test');
    });
  });

  describe('Validation des erreurs', () => {
    it('devrait échouer si l\'application n\'existe pas', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app nonexistent --name test-agent --author "Test" --description "Test"`;
      
      expect(() => {
        execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait échouer si l\'agent existe déjà', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app testapp --name duplicate-agent --author "Test" --description "Test"`;
      
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
        const command = `node ${cliPath} create agent --app testapp --name "${name}" --author "Test" --description "Test"`;
        
        expect(() => {
          execSync(command, { cwd: testProjectPath, stdio: 'pipe' });
        }).toThrow();
      }
    });

    it('devrait échouer si pas dans un projet Directive', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app testapp --name test-agent --author "Test" --description "Test"`;
      
      expect(() => {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
      }).toThrow();
    });

    it('devrait échouer s\'il n\'y a aucune application disponible', async () => {
      // Créer un projet sans applications
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
      const command = `node ${cliPath} create agent --name test-agent --author "Test" --description "Test"`;
      
      expect(() => {
        execSync(command, { cwd: emptyProjectPath, stdio: 'pipe' });
      }).toThrow();
    });
  });

  describe('Contenu des fichiers générés', () => {
    it('devrait générer une machine XState valide dans agent.ts', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app testapp --name xstate-test --author "XState Author" --description "XState testing agent"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const agentTsPath = path.join(testProjectPath, 'agents/testapp/xstate-test/agent.ts');
      const agentContent = await fs.readFile(agentTsPath, 'utf-8');

      // Vérifier les imports et structure XState
      expect(agentContent).toContain("import { createMachine, assign } from 'xstate'");
      expect(agentContent).toContain("const registerAgent = (config: any) =>");
      expect(agentContent).toContain('const xstateTestMachine = createMachine');
      expect(agentContent).toContain("id: 'xstate-test'");
      expect(agentContent).toContain("initial: 'initial'");
      
      // Vérifier les 4 états MVP
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

    it('devrait générer une documentation complète dans desc.mdx', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} create agent --app metacopi --name doc-test --author "Doc Author" --description "Documentation testing agent"`;
      
      execSync(command, { cwd: testProjectPath, stdio: 'pipe' });

      const descMdxPath = path.join(testProjectPath, 'agents/metacopi/doc-test/desc.mdx');
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
      expect(descContent).toContain('metacopi/doc-test');
      expect(descContent).toContain('Doc Author');
      expect(descContent).toContain('stateDiagram-v2');
      
      // Vérifier les exemples curl
      expect(descContent).toContain('curl -X POST http://localhost:3000/sessions');
      expect(descContent).toContain('CHOOSE_LEFT');
      expect(descContent).toContain('CHOOSE_RIGHT');
    });
  });
}); 