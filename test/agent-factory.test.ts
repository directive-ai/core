import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createMachine } from 'xstate';
import { AgentDirecteurFactory } from '../src/core/agent-factory/agent-directeur-factory';
import { JsonDatabaseService } from '../src/implementations/database/json-database.impl';

describe('AgentDirecteurFactory', () => {
  let database: JsonDatabaseService;
  let factory: AgentDirecteurFactory;
  let testAppId: string;
  let app1Id: string;

  beforeEach(async () => {
    // Réinitialiser le singleton avant chaque test
    AgentDirecteurFactory.resetInstance();
    
    // Utiliser un répertoire temporaire pour les tests
    database = new JsonDatabaseService('./test-data');
    await database.initialize();
    factory = AgentDirecteurFactory.getInstance(database);

    // Créer les applications de test nécessaires
    const testApp = await database.createApplication({
      name: 'testapp',
      description: 'Application de test',
      version: '1.0.0'
    });
    testAppId = testApp.id;

    const app1 = await database.createApplication({
      name: 'app1',
      description: 'Application de test 1',
      version: '1.0.0'
    });
    app1Id = app1.id;
  });

  afterEach(async () => {
    await database.close();
    // Nettoyer les données de test
    const fs = require('fs/promises');
    try {
      await fs.rm('./test-data', { recursive: true, force: true });
    } catch (error) {
      // Ignorer les erreurs si le répertoire n'existe pas
    }
  });

  test('should register a simple agent successfully', async () => {
    // Machine XState ultra-simple pour test
    const simpleMachine = createMachine({
      id: 'test-agent',
      initial: 'initial',
      states: {
        initial: {
          on: {
            START: 'running'
          }
        },
        running: {
          on: {
            COMPLETE: 'terminated'
          }
        },
        terminated: {
          type: 'final'
        }
      }
    });

    // Enregistrer l'agent
    const result = await factory.registerAgent(
      'testapp/simple-agent',
      simpleMachine,
      {
        name: 'Agent Simple de Test',
        description: 'Un agent simple pour tester la factory',
        version: '1.0.0',
        application_id: testAppId,
        git_strategy: 'ignore' // Ignorer Git pour les tests
      }
    );

    // Vérifications
    expect(result.success).toBe(true);
    expect(result.agent_type).toBe('testapp/simple-agent');
    expect(result.new_version).toBe(1);
    expect(result.old_version).toBe(0);
    expect(result.message).toContain('deployed successfully');
    expect(result.git_strategy_used).toBe('ignore');
    expect(result.git_was_dirty).toBeDefined();
    
    // Vérifier que l'ID du commit Git est inclus (si on est dans un repo Git)
    if (result.git_commit_id) {
      expect(result.git_commit_id).toMatch(/^[a-f0-9]{40}$/i);
      expect(result.message).toContain('@');
    }

    // Vérifier que l'agent en base contient aussi le git_commit_id
    const agentInDb = await factory.getAgent('testapp/simple-agent');
    expect(agentInDb).toBeDefined();
    if (result.git_commit_id) {
      expect(agentInDb!.git_commit_id).toBe(result.git_commit_id);
    }
  });

  test('should create machine instance with restored state', async () => {
    // D'abord enregistrer un agent
    const machine = createMachine({
      id: 'test-agent',
      initial: 'initial',
      states: {
        initial: { on: { START: 'running' } },
        running: { on: { COMPLETE: 'terminated' } },
        terminated: { type: 'final' }
      }
    });

    await factory.registerAgent('testapp/simple-agent', machine, {
      name: 'Test Agent',
      description: 'Test',
      version: '1.0.0',
      application_id: testAppId,
      git_strategy: 'ignore'
    });

    // Créer une instance
    const instance = await factory.createMachineInstance(
      'testapp/simple-agent',
      'test-session-001'
    );

    // Vérifications
    expect(instance.agentType).toBe('testapp/simple-agent');
    expect(instance.sessionId).toBe('test-session-001');
    expect(instance.interpreter).toBeDefined();
    expect(instance.currentState).toBeDefined();
  });

  test('should increment version on re-deployment', async () => {
    const machine = createMachine({
      id: 'test-agent',
      initial: 'initial',
      states: {
        initial: { on: { START: 'running' } },
        running: { type: 'final' }
      }
    });

    // Premier déploiement
    const firstDeploy = await factory.registerAgent('testapp/versioned-agent', machine, {
      name: 'Agent Versionné',
      description: 'Test versioning',
      version: '1.0.0',
      application_id: testAppId,
      git_strategy: 'ignore'
    });

    expect(firstDeploy.new_version).toBe(1);

    // Deuxième déploiement (machine modifiée)
    const modifiedMachine = createMachine({
      id: 'test-agent',
      initial: 'initial',
      states: {
        initial: { on: { START: 'running' } },
        running: { on: { PAUSE: 'paused' } },
        paused: { on: { RESUME: 'running' } }
      }
    });

    const secondDeploy = await factory.registerAgent('testapp/versioned-agent', modifiedMachine, {
      name: 'Agent Versionné',
      description: 'Test versioning - Version 2',
      version: '1.1.0',
      application_id: testAppId,
      git_strategy: 'ignore'
    });

    expect(secondDeploy.new_version).toBe(2);
    expect(secondDeploy.old_version).toBe(1);
  });

  test('should validate machine structure before registration', async () => {
    // Créer une "machine" complètement invalide
    const invalidMachine = {
      // Machine sans config valide
      config: {
        id: 'invalid-agent',
        // Pas d'initial
        states: {} // Pas d'états
      }
    };

    const result = await factory.registerAgent('testapp/invalid-agent', invalidMachine, {
      name: 'Agent Invalide',
      description: 'Test validation',
      version: '1.0.0',
      application_id: testAppId,
      git_strategy: 'ignore'
    });

    // Doit échouer à la validation
    expect(result.success).toBe(false);
    expect(result.message).toContain('validation failed');
  });

  test('should list registered agents', async () => {
    // Enregistrer quelques agents
    const machine = createMachine({
      id: 'test',
      initial: 'initial',
      states: { initial: { type: 'final' } }
    });

    await factory.registerAgent('app1/agent1', machine, {
      name: 'Agent 1',
      description: 'Test',
      version: '1.0.0',
      application_id: app1Id,
      git_strategy: 'ignore'
    });

    await factory.registerAgent('app1/agent2', machine, {
      name: 'Agent 2', 
      description: 'Test',
      version: '1.0.0',
      application_id: app1Id,
      git_strategy: 'ignore'
    });

    // Lister tous les agents
    const allAgents = await factory.listAgents();
    expect(allAgents.length).toBeGreaterThanOrEqual(2);

    // Lister agents par application
    const app1Agents = await factory.listAgents({ application_id: app1Id });
    expect(app1Agents.length).toBe(2);
  });

  describe('Git Integration', () => {
    test('should handle strict git strategy with clean directory', async () => {
      const machine = createMachine({
        id: 'git-test',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      const result = await factory.registerAgent('testapp/git-strict', machine, {
        name: 'Git Strict Test',
        description: 'Test strict git strategy',
        version: '1.0.0',
        application_id: testAppId,
        git_strategy: 'strict'
      });

      // Si on est dans un repo Git propre, ça devrait marcher
      // Si on n'est pas dans un repo Git, ça devrait marcher aussi
      // Si on est dans un repo Git sale, ça devrait échouer
      expect(result).toBeDefined();
      expect(result.git_strategy_used).toBe('strict');
      
      if (result.success) {
        expect(result.git_was_dirty).toBe(false);
        expect(result.message).toContain('deployed successfully');
      } else {
        expect(result.git_was_dirty).toBe(true);
        expect(result.message).toContain('Git strategy failed');
      }
    });

    test('should handle warn git strategy', async () => {
      const machine = createMachine({
        id: 'git-warn-test',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      const result = await factory.registerAgent('testapp/git-warn', machine, {
        name: 'Git Warn Test',
        description: 'Test warn git strategy',
        version: '1.0.0',
        application_id: testAppId,
        git_strategy: 'warn'
      });

      expect(result.success).toBe(true);
      expect(result.git_strategy_used).toBe('warn');
      
      // Si dirty, devrait avoir un warning
      if (result.git_was_dirty) {
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBeGreaterThan(0);
        expect(result.warnings![0]).toContain('Working directory has uncommitted changes');
      }
    });

    test('should handle ignore git strategy', async () => {
      const machine = createMachine({
        id: 'git-ignore-test',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      const result = await factory.registerAgent('testapp/git-ignore', machine, {
        name: 'Git Ignore Test',
        description: 'Test ignore git strategy',
        version: '1.0.0',
        application_id: testAppId,
        git_strategy: 'ignore'
      });

      expect(result.success).toBe(true);
      expect(result.git_strategy_used).toBe('ignore');
      // Ignore devrait toujours réussir peu importe l'état du repo
    });

    test('should use default strict strategy when not specified', async () => {
      const machine = createMachine({
        id: 'git-default-test',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      const result = await factory.registerAgent('testapp/git-default', machine, {
        name: 'Git Default Test',
        description: 'Test default git strategy',
        version: '1.0.0',
        application_id: testAppId
        // Pas de git_strategy spécifiée = strict par défaut
      });

      expect(result).toBeDefined();
      expect(result.git_strategy_used).toBe('strict');
    });

    test('should include git commit info in deployment response', async () => {
      const machine = createMachine({
        id: 'git-info-test',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      const result = await factory.registerAgent('testapp/git-info', machine, {
        name: 'Git Info Test',
        description: 'Test git commit info',
        version: '1.0.0',
        application_id: testAppId,
        git_strategy: 'ignore'
      });

      expect(result.success).toBe(true);
      
      // Vérifier les champs Git dans la réponse
      expect(result.git_strategy_used).toBeDefined();
      expect(result.git_was_dirty).toBeDefined();
      
      // Si on est dans un repo Git, il devrait y avoir un commit ID
      if (result.git_commit_id) {
        expect(result.git_commit_id).toMatch(/^[a-f0-9]{40}$/);
        expect(result.message).toContain('@');
        
        // Vérifier que l'agent en base contient aussi ces infos
        const agentInDb = await factory.getAgent('testapp/git-info');
        expect(agentInDb!.git_commit_id).toBe(result.git_commit_id);
      }
    });

    test('should demonstrate strict strategy behavior', async () => {
      const machine = createMachine({
        id: 'git-strict-demo',
        initial: 'initial',
        states: { initial: { type: 'final' } }
      });

      // Créer un fichier temporaire pour simuler des modifications non commitées
      const fs = require('fs');
      const tempFile = './temp-test-file.txt';
      let tempFileCreated = false;

      try {
        // Vérifier d'abord l'état actuel avec strict
        const initialResult = await factory.registerAgent('testapp/git-strict-demo', machine, {
          name: 'Git Strict Demo',
          description: 'Demonstration of strict git strategy',
          version: '1.0.0',
          application_id: testAppId,
          git_strategy: 'strict'
        });

        // Si on est dans un repo Git propre, ça devrait marcher
        if (initialResult.success) {
          // Maintenant créer un fichier pour "salir" le repo
          fs.writeFileSync(tempFile, 'This is a temporary test file to make git dirty');
          tempFileCreated = true;

          // Tenter un nouveau déploiement en mode strict
          const dirtyResult = await factory.registerAgent('testapp/git-strict-demo-dirty', machine, {
            name: 'Git Strict Demo Dirty',
            description: 'This should fail with strict strategy on dirty repo',
            version: '1.0.0',
            application_id: testAppId,
            git_strategy: 'strict'
          });

          // Si on est dans un repo Git, cela devrait échouer maintenant
          // (sauf si le système de fichiers ne permet pas d'écrire)
          if (dirtyResult.success) {
            // Pas dans un repo Git ou fichier pas détecté par Git
            expect(dirtyResult.git_strategy_used).toBe('strict');
          } else {
            // Échec attendu avec repo Git sale
            expect(dirtyResult.success).toBe(false);
            expect(dirtyResult.git_strategy_used).toBe('strict');
            expect(dirtyResult.git_was_dirty).toBe(true);
            expect(dirtyResult.message).toContain('Git strategy failed');
          }
        } else {
          // Le repo était déjà sale au départ
          expect(initialResult.git_strategy_used).toBe('strict');
          expect(initialResult.git_was_dirty).toBe(true);
          expect(initialResult.message).toContain('Git strategy failed');
        }
      } finally {
        // Nettoyer le fichier temporaire s'il a été créé
        if (tempFileCreated && fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });
}); 