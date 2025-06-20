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