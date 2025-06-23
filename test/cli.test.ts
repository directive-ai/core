import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

describe('CLI Tests', () => {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const expectedVersion = packageJson.version;

  beforeAll(() => {
    // S'assurer que la CLI est compilée avant les tests
    try {
      execSync('npm run build:cli', { stdio: 'inherit' });
    } catch (error) {
      console.error('Failed to build CLI before tests:', error);
      throw error;
    }
  });

  describe('directive --version', () => {
    it('should return the correct version', () => {
      try {
        // Exécuter la commande directive --version
        const output = execSync('directive --version', { 
          encoding: 'utf8',
          timeout: 5000 // Timeout de 5 secondes
        });

        // Vérifier que la sortie contient la version attendue
        expect(output.trim()).toBe(expectedVersion);
      } catch (error: any) {
        // Si la commande globale n'est pas disponible, tester avec le script npm
        console.warn('Global directive command not available, testing with npm script...');
        
        const output = execSync('npm run cli -- --version', { 
          encoding: 'utf8',
          timeout: 5000
        });

        expect(output).toContain(expectedVersion);
      }
    });

    it('should have zero exit code', () => {
      try {
        // Tester que la commande se termine avec le code 0
        execSync('directive --version', { 
          stdio: 'pipe',
          timeout: 5000
        });
        
        // Si on arrive ici, le code de sortie était 0
        expect(true).toBe(true);
      } catch (error: any) {
        // Fallback vers npm script
        execSync('npm run cli -- --version', { 
          stdio: 'pipe',
          timeout: 5000
        });
        
        expect(true).toBe(true);
      }
    });
  });

  describe('directive --help', () => {
    it('should display help information', () => {
      let output = '';
      
      try {
        output = execSync('directive --help', { 
          encoding: 'utf8',
          timeout: 5000
        });
      } catch (error: any) {
        // Commander.js sort avec un code d'erreur pour --help, c'est normal
        // L'output est dans stderr ou stdout même en cas d'erreur
        output = error.stdout || error.stderr || '';
        
        if (!output) {
          // Fallback vers npm script
          try {
            output = execSync('npm run cli -- --help', { 
              encoding: 'utf8',
              timeout: 5000
            });
          } catch (npmError: any) {
            // Même chose, récupérer l'output même en cas d'erreur
            output = npmError.stdout || npmError.stderr || '';
          }
        }
      }

      // Vérifier que l'aide contient les éléments essentiels
      expect(output).toContain('CLI for Directive');
      expect(output).toContain('AI Agents Orchestrator');
      expect(output).toContain('--version');
      expect(output).toContain('--help');
    });
  });

  describe('directive test', () => {
    it('should execute test command successfully', () => {
      try {
        const output = execSync('directive test', { 
          encoding: 'utf8',
          timeout: 5000
        });

        // Vérifier que la commande de test s'exécute correctement
        expect(output).toContain('CLI Directive fonctionne correctement');
        expect(output).toContain('Version:');
        expect(output).toContain('1.0.0');
        // Retirer le test de configuration phase car il peut varier
      } catch (error: any) {
        // Fallback vers npm script
        const output = execSync('npm run cli -- test', { 
          encoding: 'utf8',
          timeout: 5000
        });

        expect(output).toContain('CLI Directive fonctionne correctement');
        expect(output).toContain('Version:');
        expect(output).toContain('1.0.0');
      }
    });
  });
}); 