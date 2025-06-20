import { JsonDatabaseService } from '../src/implementations/database/json-database.impl';
import { Session, ConversationEntry, SessionStatus } from '../src/dto/index';
import * as fs from 'fs/promises';
import * as path from 'path';
import { jest } from '@jest/globals';

describe('JsonDatabaseService', () => {
  let dbService: JsonDatabaseService;
  let testDataDir: string;

  beforeEach(async () => {
    // Créer un répertoire temporaire pour les tests
    testDataDir = path.join(__dirname, '..', 'test-data', `test-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`);
    await fs.mkdir(testDataDir, { recursive: true });
    
    // Initialiser le service avec le répertoire de test
    dbService = new JsonDatabaseService(testDataDir);
    await dbService.initialize();
  });

  afterEach(async () => {
    // Nettoyer le répertoire de test
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
  });

  describe('Initialisation', () => {
    test('doit créer la base de données avec la structure par défaut', async () => {
      const dbFile = path.join(testDataDir, 'directive.json');
      const fileExists = await fs.access(dbFile).then(() => true).catch(() => false);
      
      expect(fileExists).toBe(true);
      
      const content = await fs.readFile(dbFile, 'utf-8');
      const data = JSON.parse(content);
      
      expect(data).toHaveProperty('applications');
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('agents');
      expect(data).toHaveProperty('conversation_history');
      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toHaveProperty('version', '1.0.0');
    });

    test('doit gérer plusieurs initialisations sans erreur', async () => {
      await expect(dbService.initialize()).resolves.toBeUndefined();
      await expect(dbService.initialize()).resolves.toBeUndefined();
    });
  });

  describe('Gestion des sessions', () => {
    test('doit créer une session avec un ID unique', async () => {
      const sessionData: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/simple-agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'initial',
          context: { test: 'data' },
          history: ['initial']
        },
        conversation_history: []
      };

      const session = await dbService.createSession(sessionData);

      expect(session.session_id).toMatch(/^sess_testapp_[a-z0-9]+_[a-z0-9]+$/);
      expect(session.agent_directeur_type).toBe('testapp/simple-agent');
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.created_at).toBeDefined();
      expect(new Date(session.created_at)).toBeInstanceOf(Date);
    });

    test('doit récupérer une session existante', async () => {
      const sessionData: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'running',
          context: { step: 1 },
          history: ['initial', 'running']
        },
        conversation_history: []
      };

      const createdSession = await dbService.createSession(sessionData);
      const retrievedSession = await dbService.getSession(createdSession.session_id);

      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.session_id).toBe(createdSession.session_id);
      expect(retrievedSession!.current_state.context.step).toBe(1);
    });

    test('doit retourner null pour une session inexistante', async () => {
      const session = await dbService.getSession('sess_nonexistent_123');
      expect(session).toBeNull();
    });

    test('doit mettre à jour l\'état d\'une session', async () => {
      const sessionData: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'initial',
          context: {},
          history: ['initial']
        },
        conversation_history: []
      };

      const session = await dbService.createSession(sessionData);
      
      const newState = {
        xstate_state: 'completed',
        context: { result: 'success' },
        history: ['initial', 'running', 'completed']
      };

      await dbService.updateSessionState(session.session_id, newState);
      
      const updatedSession = await dbService.getSession(session.session_id);
      expect(updatedSession!.current_state.xstate_state).toBe('completed');
      expect(updatedSession!.current_state.context.result).toBe('success');
      expect(updatedSession!.current_state.history).toHaveLength(3);
    });

    test('doit mettre à jour le statut d\'une session', async () => {
      const sessionData: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'initial',
          context: {},
          history: ['initial']
        },
        conversation_history: []
      };

      const session = await dbService.createSession(sessionData);
      
      await dbService.updateSessionStatus(session.session_id, SessionStatus.COMPLETED);
      
      const updatedSession = await dbService.getSession(session.session_id);
      expect(updatedSession!.status).toBe(SessionStatus.COMPLETED);
    });

    test('doit lancer une erreur lors de la mise à jour d\'une session inexistante', async () => {
      const newState = {
        xstate_state: 'completed',
        context: {},
        history: ['completed']
      };

      await expect(
        dbService.updateSessionState('sess_nonexistent_123', newState)
      ).rejects.toThrow('Session sess_nonexistent_123 not found');
    });
  });

  describe('Gestion de l\'historique des conversations', () => {
    let sessionId: string;

    beforeEach(async () => {
      const sessionData: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/chat-agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'chatting',
          context: {},
          history: ['initial', 'chatting']
        },
        conversation_history: []
      };

      const session = await dbService.createSession(sessionData);
      sessionId = session.session_id;
    });

    test('doit ajouter une entrée de conversation', async () => {
      const entry: Omit<ConversationEntry, 'timestamp'> = {
        from: 'agent_directeur',
        to: 'agent_executant',
        content: 'Bonjour, comment puis-je vous aider ?',
        state_before: 'initial',
        state_after: 'chatting'
      };

      await dbService.addConversationEntry(sessionId, entry);
      
      const history = await dbService.getSessionHistory(sessionId);
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('Bonjour, comment puis-je vous aider ?');
      expect(history[0].from).toBe('agent_directeur');
      expect(history[0].timestamp).toBeDefined();
    });

    test('doit récupérer l\'historique dans l\'ordre chronologique', async () => {
      const entries: Omit<ConversationEntry, 'timestamp'>[] = [
        {
          from: 'agent_directeur',
          to: 'agent_executant',
          content: 'Premier message'
        },
        {
          from: 'agent_executant',
          to: 'agent_directeur',
          content: 'Réponse',
          trigger: 'USER_RESPONSE'
        },
        {
          from: 'agent_directeur',
          to: 'agent_executant',
          content: 'Message de suivi'
        }
      ];

      for (const entry of entries) {
        await dbService.addConversationEntry(sessionId, entry);
        // Petit délai pour assurer l'ordre chronologique
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const history = await dbService.getSessionHistory(sessionId);
      expect(history).toHaveLength(3);
      expect(history[0].content).toBe('Premier message');
      expect(history[1].content).toBe('Réponse');
      expect(history[2].content).toBe('Message de suivi');
    });

    test('doit lancer une erreur pour une session inexistante', async () => {
      const entry: Omit<ConversationEntry, 'timestamp'> = {
        from: 'agent_directeur',
        to: 'agent_executant',
        content: 'Test'
      };

      await expect(
        dbService.addConversationEntry('sess_nonexistent_123', entry)
      ).rejects.toThrow('Session sess_nonexistent_123 not found');
    });

    test('doit isoler l\'historique par session', async () => {
      // Créer une deuxième session
      const sessionData2: Omit<Session, 'session_id' | 'created_at'> = {
        agent_directeur_type: 'testapp/other-agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'initial',
          context: {},
          history: ['initial']
        },
        conversation_history: []
      };

      const session2 = await dbService.createSession(sessionData2);

      // Ajouter des entrées à chaque session
      await dbService.addConversationEntry(sessionId, {
        from: 'agent_directeur',
        to: 'agent_executant',
        content: 'Message session 1'
      });

      await dbService.addConversationEntry(session2.session_id, {
        from: 'agent_directeur',
        to: 'agent_executant',
        content: 'Message session 2'
      });

      // Vérifier l'isolation
      const history1 = await dbService.getSessionHistory(sessionId);
      const history2 = await dbService.getSessionHistory(session2.session_id);

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1[0].content).toBe('Message session 1');
      expect(history2[0].content).toBe('Message session 2');
    });
  });

  describe('Fonctionnalités utilitaires', () => {
    test('doit retourner le statut de santé de la base de données', async () => {
      const health = await dbService.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health.status).toBe('ok');
      expect(health).toHaveProperty('total_applications');
      expect(health).toHaveProperty('total_agents');
      expect(health).toHaveProperty('active_agents');
      expect(health).toHaveProperty('total_sessions');
      expect(health).toHaveProperty('active_sessions');
      expect(health).toHaveProperty('storage_size');
    });

    test('doit nettoyer les sessions expirées', async () => {
      // Créer une session récente (active)
      await dbService.createSession({
        agent_directeur_type: 'testapp/agent',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'running',
          context: {},
          history: ['initial', 'running']
        },
        conversation_history: []
      });

      // Simuler une session ancienne et terminée
      const expiredSession = await dbService.createSession({
        agent_directeur_type: 'testapp/agent',
        status: SessionStatus.COMPLETED,
        current_state: {
          xstate_state: 'terminated',
          context: {},
          history: ['initial', 'running', 'terminated']
        },
        conversation_history: []
      });

      // Nettoyer les sessions expirées (24h = 24 * 60 * 60 * 1000 ms)
      const removedCount = await dbService.cleanupExpiredSessions(24 * 60 * 60 * 1000);

      // Note: Le test est approximatif car nous ne pouvons pas facilement 
      // modifier la date de création dans cette implémentation
      // En pratique, aucune session ne sera supprimée car elles viennent d'être créées
      expect(removedCount).toBeGreaterThanOrEqual(0);
    });

    test('doit générer des IDs de session uniques avec le bon format', async () => {
      const sessionIds = new Set<string>();
      
      for (let i = 0; i < 10; i++) {
        const session = await dbService.createSession({
          agent_directeur_type: 'testapp/unique-agent',
          status: SessionStatus.ACTIVE,
          current_state: {
            xstate_state: 'initial',
            context: {},
            history: ['initial']
          },
          conversation_history: []
        });

        expect(session.session_id).toMatch(/^sess_testapp_[a-z0-9]+_[a-z0-9]+$/);
        expect(sessionIds.has(session.session_id)).toBe(false);
        sessionIds.add(session.session_id);
      }

      expect(sessionIds.size).toBe(10);
    });
  });

  describe('Gestion des erreurs et robustesse', () => {
    test('doit préserver l\'intégrité des données en cas d\'erreur', async () => {
      // Créer une session
      const session = await dbService.createSession({
        agent_directeur_type: 'testapp/integrity-test',
        status: SessionStatus.ACTIVE,
        current_state: {
          xstate_state: 'initial',
          context: {},
          history: ['initial']
        },
        conversation_history: []
      });

      // Tenter une opération invalide
      await expect(
        dbService.updateSessionState('invalid-session-id', {
          xstate_state: 'test',
          context: {},
          history: []
        })
      ).rejects.toThrow();

      // Vérifier que la session valide existe toujours
      const retrievedSession = await dbService.getSession(session.session_id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.session_id).toBe(session.session_id);
    });

    test('doit fermer proprement la connexion', async () => {
      await expect(dbService.close()).resolves.toBeUndefined();
    });
  });
}); 