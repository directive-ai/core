import { IIAMService } from '@/interfaces/index.js';
import { UserContext, SessionAuthContext } from '@/dto/index.js';

/**
 * Implémentation mock du service IAM pour le MVP
 * 
 * Cette implémentation autorise tout pour simplifier le développement.
 * En production, elle sera remplacée par une vraie solution IAM.
 */
export class MockIAMService implements IIAMService {
  private sessionAuth: Map<string, SessionAuthContext> = new Map();
  private mockUsers: Map<string, UserContext> = new Map();

  constructor() {
    // Créer quelques utilisateurs de test
    this.mockUsers.set('dev-token', {
      userId: 'user_dev_001',
      roles: ['developer', 'admin'],
      permissions: ['*'], // Autorise tout
      metadata: { 
        authMethod: 'mock',
        name: 'Développeur'
      }
    });

    this.mockUsers.set('test-token', {
      userId: 'user_test_001',
      roles: ['user'],
      permissions: ['session:create', 'session:read', 'agent:list'],
      metadata: { 
        authMethod: 'mock',
        name: 'Utilisateur Test'
      }
    });
  }

  // ==========================================
  // Authentification
  // ==========================================

  async authenticate(token: string): Promise<UserContext | null> {
    // Mock: accepte tous les tokens non vides
    if (!token || token.trim().length === 0) {
      return null;
    }

    // Vérifier si c'est un token prédéfini
    if (this.mockUsers.has(token)) {
      return this.mockUsers.get(token)!;
    }

    // Sinon, créer un utilisateur générique
    return {
      userId: `user_${token.substring(0, 8)}`,
      roles: ['user'],
      permissions: ['session:create', 'session:read'],
      metadata: { 
        authMethod: 'mock',
        token: token.substring(0, 8)
      }
    };
  }

  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    // Mock: autorise toujours
    return true;
  }

  // ==========================================
  // Autorisation
  // ==========================================

  async canCreateSession(userId: string, agentType: string): Promise<boolean> {
    // Mock: autorise toujours
    return true;
  }

  async canAccessSession(userId: string, sessionId: string): Promise<boolean> {
    // Mock: autorise toujours
    return true;
  }

  async canExecuteAction(userId: string, sessionId: string, action: string): Promise<boolean> {
    // Mock: autorise toujours
    return true;
  }

  // ==========================================
  // Gestion des contextes de session
  // ==========================================

  async createSessionAuth(sessionId: string, userId: string, agentType: string): Promise<SessionAuthContext> {
    const auth: SessionAuthContext = {
      sessionId,
      userId,
      agentType,
      createdAt: new Date(),
      permissions: ['*'], // Autorise tout
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    };

    this.sessionAuth.set(sessionId, auth);
    return auth;
  }

  async getSessionAuth(sessionId: string): Promise<SessionAuthContext | null> {
    return this.sessionAuth.get(sessionId) || null;
  }

  async revokeSessionAuth(sessionId: string): Promise<void> {
    this.sessionAuth.delete(sessionId);
  }

  // ==========================================
  // Gestion des permissions
  // ==========================================

  async getUserPermissions(userId: string): Promise<string[]> {
    // Mock: retourne toutes les permissions
    return ['*'];
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    // Mock: autorise toujours
    return true;
  }

  // ==========================================
  // Utilitaires
  // ==========================================

  async getHealthStatus(): Promise<{
    status: 'ok' | 'error';
    authenticatedUsers: number;
    activeSessions: number;
    authMethod: string;
  }> {
    return {
      status: 'ok',
      authenticatedUsers: this.mockUsers.size,
      activeSessions: this.sessionAuth.size,
      authMethod: 'mock'
    };
  }
} 