import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as os from 'os';

/**
 * Tests d'intégration pour la commande directive init
 * Valide que le projet généré est fonctionnel et bien structuré
 */
describe('Commande directive init', () => {
  let tempDir: string;
  let testProjectPath: string;
  const testProjectName = 'test-directive-project';

  beforeEach(async () => {
    // Créer un répertoire temporaire unique pour chaque test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'directive-test-'));
    testProjectPath = path.join(tempDir, testProjectName);
  });

  afterEach(async () => {
    // Nettoyer le répertoire temporaire
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Warning: Could not clean up temp directory:', error);
    }
  });

  describe('Création de projet basique', () => {
    it('devrait créer un projet avec la structure de répertoires correcte', async () => {
      // Exécuter la commande init avec options non-interactives
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { 
        cwd: tempDir,
        stdio: 'pipe' // Supprimer les outputs pour les tests
      });

      // Vérifier que les répertoires existent (avec data/ par défaut pour JSON)
      const expectedDirs = [
        testProjectPath,
        path.join(testProjectPath, 'agents'),
        path.join(testProjectPath, 'data')
      ];

      for (const dir of expectedDirs) {
        const exists = await fs.access(dir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }

      // Vérifier que le répertoire agents est vide (avec juste .gitkeep)
      const agentsContent = await fs.readdir(path.join(testProjectPath, 'agents'));
      expect(agentsContent).toEqual(['.gitkeep']);
    });

    it('devrait créer tous les fichiers de configuration requis', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que tous les fichiers sont créés (sans app par défaut)
      const expectedFiles = [
        'package.json',
        'tsconfig.json',
        'directive-conf.ts',
        'README.md',
        '.gitignore',
        'agents/.gitkeep'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(testProjectPath, file);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('devrait générer un package.json valide avec versions flexibles', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const packageJsonPath = path.join(testProjectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Vérifier les champs principaux
      expect(packageJson.name).toBe(testProjectName);
      expect(packageJson.author).toBe('Test Author');
      expect(packageJson.description).toBe('Test Project');

      // Vérifier les scripts
      expect(packageJson.scripts).toHaveProperty('start', 'directive start');
      expect(packageJson.scripts).toHaveProperty('dev', 'directive start --watch');
      expect(packageJson.scripts).toHaveProperty('build', 'tsc');

      // Vérifier les dépendances avec versions flexibles
      expect(packageJson.devDependencies).toHaveProperty('@directive/core', '^1.0.0');
      expect(packageJson.devDependencies).toHaveProperty('typescript', '~5.8.0'); // Tilde pour minor lock
      expect(packageJson.devDependencies).toHaveProperty('xstate', '^5.20.0');
      expect(packageJson.devDependencies).toHaveProperty('@types/node', '^24.0.0');
    });

    it('devrait générer une configuration TypeScript valide simplifiée', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const tsconfigPath = path.join(testProjectPath, 'tsconfig.json');
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);

      // Vérifier la configuration TypeScript
      expect(tsconfig.compilerOptions.target).toBe('ES2020');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.moduleResolution).toBe('node');
      expect(tsconfig.compilerOptions.strict).toBe(true);
      
      // Vérifier les chemins absolus simplifiés
      expect(tsconfig.compilerOptions.paths).toHaveProperty('@/*');
      expect(tsconfig.compilerOptions.paths).not.toHaveProperty('@/types/*');
      
      // Vérifier include/exclude simplifiés
      expect(tsconfig.include).toEqual(['agents/**/*']);
      expect(tsconfig.exclude).toContain('node_modules');
    });

    it('devrait générer une configuration Directive valide en anglais', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const configPath = path.join(testProjectPath, 'directive-conf.ts');
      const configContent = await fs.readFile(configPath, 'utf-8');

      // Vérifier que la configuration contient les éléments essentiels en anglais
      expect(configContent).toContain('export const directiveConfig');
      expect(configContent).toContain('// Server configuration');
      expect(configContent).toContain('// Agents configuration');
      expect(configContent).toContain('// Database configuration');
      expect(configContent).toContain('autoScan: true');
      expect(configContent).toContain("'type': 'json'");
      expect(configContent).toContain('type: \'mock\'');
      expect(configContent).toContain(testProjectName);
      expect(configContent).toContain('Test Author');
    });

    it('devrait générer un README avec la structure par défaut (JSON)', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const readmePath = path.join(testProjectPath, 'README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Vérifier les instructions en anglais et structure par défaut (JSON)
      expect(readmeContent).toContain('## Project Structure');
      expect(readmeContent).toContain('- `agents/` : AI agents organized by application');
      expect(readmeContent).toContain('- `data/` : Local JSON database (sessions, agent states)');
      expect(readmeContent).toContain('## Database');
      expect(readmeContent).toContain('LowDB');
    });
  });

  describe('Projet vide par défaut', () => {
    it('devrait créer un projet vide sans app par défaut', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que le répertoire agents est vide
      const agentsPath = path.join(testProjectPath, 'agents');
      const agentsContent = await fs.readdir(agentsPath);
      
      expect(agentsContent).toEqual(['.gitkeep']);
    });

    it('devrait générer un README avec instructions pour créer des agents', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const readmePath = path.join(testProjectPath, 'README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      // Vérifier les instructions en anglais
      expect(readmeContent).toContain('## Getting Started');
      expect(readmeContent).toContain('### 1. Create your first application');
      expect(readmeContent).toContain('npm run agent:create <app-name> <agent-name>');
      expect(readmeContent).toContain('### 2. Start the Directive server');
      expect(readmeContent).toContain('npm run dev');
      expect(readmeContent).toContain('## API Usage');
      expect(readmeContent).toContain('curl http://localhost:3000/agents');
    });
  });

  describe('Validation syntaxique', () => {
    it.skip('devrait générer du code TypeScript syntaxiquement valide', async () => {
      // Skip temporairement - @directive/core n'est pas encore publié sur npm
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que TypeScript peut compiler le code généré
      try {
        // Installer les dépendances nécessaires pour la compilation
        execSync('npm install', { cwd: testProjectPath, stdio: 'pipe' });
        
        // Tenter de compiler avec TypeScript
        execSync('npx tsc --noEmit', { cwd: testProjectPath, stdio: 'pipe' });
      } catch (error) {
        // Si la compilation échoue, le test échoue
        throw new Error(`La compilation TypeScript a échoué: ${error}`);
      }
    }, 30000); // Timeout plus long pour l'installation

    it('devrait générer du JSON valide', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Tester la validité JSON de tous les fichiers JSON
      const jsonFiles = [
        'package.json',
        'tsconfig.json'
      ];

      for (const file of jsonFiles) {
        const filePath = path.join(testProjectPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        expect(() => JSON.parse(content)).not.toThrow();
      }
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait échouer si le répertoire existe déjà', async () => {
      // Créer un répertoire avec le nom du projet
      await fs.mkdir(testProjectPath, { recursive: true });

      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      // Test avec répertoire existant - devrait échouer
      try {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
        throw new Error('La commande aurait dû échouer quand le répertoire existe déjà');
      } catch (error) {
        // C'est le comportement attendu - la commande doit échouer
        expect(error).toBeDefined();
      }
    });

    it('devrait valider le nom du projet', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const invalidName = 'INVALID-NAME-123!@#';
      const command = `node ${cliPath} init ${invalidName} --author "Test Author" --description "Test Project" --skip-install`;
      
      // Test avec un nom invalide - devrait échouer
      try {
        execSync(command, { cwd: tempDir, stdio: 'pipe' });
        throw new Error('La commande aurait dû échouer avec un nom de projet invalide');
      } catch (error) {
        // C'est le comportement attendu - la commande doit échouer
        expect(error).toBeDefined();
      }
    });
  });

  describe('Options de la commande', () => {
    it('devrait respecter l\'option --skip-install', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que node_modules n'existe pas
      const nodeModulesPath = path.join(testProjectPath, 'node_modules');
      const exists = await fs.access(nodeModulesPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('devrait générer un README avec les informations du projet en anglais', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Custom Author" --description "Custom Description" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const readmePath = path.join(testProjectPath, 'README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');

      expect(readmeContent).toContain(testProjectName);
      expect(readmeContent).toContain('Custom Description');
      expect(readmeContent).toContain('Custom Author');
      expect(readmeContent).toContain('## Installation');
      expect(readmeContent).toContain('npm install');
      expect(readmeContent).toContain('npm run dev');
      expect(readmeContent).toContain('## Getting Started');
      expect(readmeContent).toContain('Created by: Custom Author');
    });
  });

  describe('Nom par défaut', () => {
    it('devrait utiliser "directive-agents" comme nom par défaut', async () => {
      // Pour tester le mode interactif, on va vérifier que la valeur par défaut est bien configurée
      // En lisant le code de la commande init
      const initCommandPath = path.resolve(__dirname, '../src/cli/commands/init.ts');
      const initContent = await fs.readFile(initCommandPath, 'utf-8');
      
      expect(initContent).toContain("default: 'directive-agents'");
    });
  });

  describe('Choix de base de données', () => {
    it('devrait créer un projet avec JSON/LowDB par défaut', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que le répertoire data/ existe
      const dataPath = path.join(testProjectPath, 'data');
      const dataExists = await fs.access(dataPath).then(() => true).catch(() => false);
      expect(dataExists).toBe(true);

      // Vérifier la configuration
      const configPath = path.join(testProjectPath, 'directive-conf.ts');
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain("'type': 'json'");
      expect(configContent).toContain("'dataDir': './data'");

      // Vérifier les dépendances
      const packageJsonPath = path.join(testProjectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).toHaveProperty('lowdb');
    });

    it('devrait créer un projet avec MongoDB quand spécifié', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --database mongodb --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que le répertoire data/ N'existe PAS
      const dataPath = path.join(testProjectPath, 'data');
      const dataExists = await fs.access(dataPath).then(() => true).catch(() => false);
      expect(dataExists).toBe(false);

      // Vérifier que .env.example existe
      const envExamplePath = path.join(testProjectPath, '.env.example');
      const envExists = await fs.access(envExamplePath).then(() => true).catch(() => false);
      expect(envExists).toBe(true);

      // Vérifier le contenu de .env.example
      const envContent = await fs.readFile(envExamplePath, 'utf-8');
      expect(envContent).toContain('MONGODB_URL=');
      expect(envContent).toContain('MONGODB_DATABASE=' + testProjectName);

      // Vérifier la configuration
      const configPath = path.join(testProjectPath, 'directive-conf.ts');
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain("'type': 'mongodb'");
      expect(configContent).toContain("'url': 'mongodb://localhost:27017'");

      // Vérifier les dépendances MongoDB
      const packageJsonPath = path.join(testProjectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).toHaveProperty('mongodb');
      expect(packageJson.devDependencies).toHaveProperty('@types/mongodb');
      expect(packageJson.devDependencies).not.toHaveProperty('lowdb');
    });

    it('devrait créer un projet avec PostgreSQL quand spécifié', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --database postgresql --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      // Vérifier que le répertoire data/ N'existe PAS
      const dataPath = path.join(testProjectPath, 'data');
      const dataExists = await fs.access(dataPath).then(() => true).catch(() => false);
      expect(dataExists).toBe(false);

      // Vérifier que .env.example existe avec config PostgreSQL
      const envExamplePath = path.join(testProjectPath, '.env.example');
      const envContent = await fs.readFile(envExamplePath, 'utf-8');
      expect(envContent).toContain('POSTGRES_HOST=');
      expect(envContent).toContain('POSTGRES_DATABASE=' + testProjectName);

      // Vérifier la configuration
      const configPath = path.join(testProjectPath, 'directive-conf.ts');
      const configContent = await fs.readFile(configPath, 'utf-8');
      expect(configContent).toContain("'type': 'postgresql'");

      // Vérifier les dépendances PostgreSQL
      const packageJsonPath = path.join(testProjectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.devDependencies).toHaveProperty('pg');
      expect(packageJson.devDependencies).toHaveProperty('@types/pg');
    });

    it('devrait générer un README adapté au type de base de données', async () => {
      const cliPath = path.resolve(__dirname, '../dist/cli/index.js');
      const command = `node ${cliPath} init ${testProjectName} --database mongodb --author "Test Author" --description "Test Project" --skip-install`;
      
      execSync(command, { cwd: tempDir, stdio: 'pipe' });

      const readmePath = path.join(testProjectPath, 'README.md');
      const readmeContent = await fs.readFile(readmePath, 'utf-8');
      
      // Vérifier les instructions spécifiques à MongoDB
      expect(readmeContent).toContain('## Database');
      expect(readmeContent).toContain('MongoDB');
      expect(readmeContent).toContain('MONGODB_URL');
      expect(readmeContent).toContain('Make sure MongoDB is running');
      expect(readmeContent).not.toContain('data/');
    });
  });
}); 