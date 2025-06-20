import { MockIAMService } from '../src/implementations/iam/mock-iam.impl';

describe('MockIAMService', () => {
  let iamService: MockIAMService;

  beforeEach(() => {
    iamService = new MockIAMService();
  });

  describe('authenticate', () => {
    it('should return null for empty token', async () => {
      const result = await iamService.authenticate('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace token', async () => {
      const result = await iamService.authenticate('   ');
      expect(result).toBeNull();
    });

    it('should return user context for dev-token', async () => {
      const result = await iamService.authenticate('dev-token');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user_dev_001');
      expect(result?.roles).toContain('developer');
      expect(result?.roles).toContain('admin');
      expect(result?.permissions).toContain('*');
    });

    it('should return user context for test-token', async () => {
      const result = await iamService.authenticate('test-token');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user_test_001');
      expect(result?.roles).toContain('user');
      expect(result?.permissions).toContain('session:create');
    });

    it('should create generic user for unknown token', async () => {
      const result = await iamService.authenticate('random-token-123');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user_random-t');
      expect(result?.roles).toContain('user');
      expect(result?.metadata?.authMethod).toBe('mock');
    });
  });

  describe('authorization methods', () => {
    it('should always allow session creation', async () => {
      const result = await iamService.canCreateSession('user_123', 'testapp/simple-agent');
      expect(result).toBe(true);
    });

    it('should always allow session access', async () => {
      const result = await iamService.canAccessSession('user_123', 'sess_123');
      expect(result).toBe(true);
    });

    it('should always allow action execution', async () => {
      const result = await iamService.canExecuteAction('user_123', 'sess_123', 'read');
      expect(result).toBe(true);
    });
  });

  describe('session auth management', () => {
    it('should create and retrieve session auth', async () => {
      const sessionId = 'sess_test_001';
      const userId = 'user_test_001';
      const agentType = 'testapp/simple-agent';

      // Créer auth de session
      const auth = await iamService.createSessionAuth(sessionId, userId, agentType);
      
      expect(auth.sessionId).toBe(sessionId);
      expect(auth.userId).toBe(userId);
      expect(auth.agentType).toBe(agentType);
      expect(auth.permissions).toContain('*');

      // Récupérer auth de session
      const retrieved = await iamService.getSessionAuth(sessionId);
      expect(retrieved).toEqual(auth);
    });

    it('should return null for non-existent session auth', async () => {
      const result = await iamService.getSessionAuth('sess_nonexistent');
      expect(result).toBeNull();
    });

    it('should revoke session auth', async () => {
      const sessionId = 'sess_test_002';
      
      // Créer auth
      await iamService.createSessionAuth(sessionId, 'user_123', 'agent_type');
      
      // Vérifier qu'elle existe
      let auth = await iamService.getSessionAuth(sessionId);
      expect(auth).not.toBeNull();
      
      // Révoquer
      await iamService.revokeSessionAuth(sessionId);
      
      // Vérifier qu'elle n'existe plus
      auth = await iamService.getSessionAuth(sessionId);
      expect(auth).toBeNull();
    });
  });

  describe('permissions', () => {
    it('should return all permissions for any user', async () => {
      const permissions = await iamService.getUserPermissions('user_123');
      expect(permissions).toContain('*');
    });

    it('should always grant permission', async () => {
      const hasPermission = await iamService.hasPermission('user_123', 'session:create');
      expect(hasPermission).toBe(true);
    });
  });

  describe('health status', () => {
    it('should return healthy status', async () => {
      const health = await iamService.getHealthStatus();
      
      expect(health.status).toBe('ok');
      expect(health.authMethod).toBe('mock');
      expect(typeof health.authenticatedUsers).toBe('number');
      expect(typeof health.activeSessions).toBe('number');
    });
  });
}); 