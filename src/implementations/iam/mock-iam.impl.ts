import { IIAMService } from '@/interfaces/index.js';
import { UserContext, SessionAuthContext, LoginCredentials, LoginResult } from '@/dto/index.js';

/**
 * Implémentation mock du service IAM pour le MVP
 * 
 * Cette implémentation autorise tout pour simplifier le développement.
 * En production, elle sera remplacée par une vraie solution IAM.
 */
export class MockIAMService implements IIAMService {
  private sessionAuth: Map<string, SessionAuthContext> = new Map();
  private mockUsers: Map<string, UserContext> = new Map();
  
  // === NOUVEAUX MEMBRES POUR CLI ===
  private cliUsers = new Map([
    ['admin@directive.com', {
      id: 'admin',
      name: 'Administrator',
      email: 'admin@directive.com',
      password: 'admin123',
      roles: ['admin'],
      permissions: ['*']
    }],
    ['dev@directive.com', {
      id: 'dev',
      name: 'Developer',
      email: 'dev@directive.com', 
      password: 'dev123',
      roles: ['developer'],
      permissions: ['app:*', 'agent:*']
    }],
    ['user@directive.com', {
      id: 'user',
      name: 'User',
      email: 'user@directive.com',
      password: 'user123', 
      roles: ['user'],
      permissions: ['app:list', 'agent:list', 'agent:create']
    }]
  ]);

  private activeTokens = new Map<string, UserContext>();
  private tokenExpiration = new Map<string, Date>();

  constructor() {
    // Créer quelques utilisateurs de test (legacy pour sessions)
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

  // ==========================================
  // NOUVELLES MÉTHODES POUR LA CLI
  // ==========================================

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      let user: any = null;

      if (credentials.provider === 'email') {
        // Authentification email/password
        user = Array.from(this.cliUsers.values()).find(u => 
          u.email === credentials.email && u.password === credentials.password
        );
      } else if (credentials.provider === 'token') {
        // Authentification par token prédéfini
        if (credentials.token === 'dev-token') {
          user = this.cliUsers.get('dev@directive.com');
        } else if (credentials.token === 'admin-token') {
          user = this.cliUsers.get('admin@directive.com');
        } else if (credentials.token === 'user-token') {
          user = this.cliUsers.get('user@directive.com');
        }
      }

      if (!user) {
        return {
          success: false,
          token: '',
          user: {} as UserContext,
          expiresIn: 0
        };
      }

      // Générer un token simple (en production, utiliser JWT)
      const token = `token_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const expiresIn = 24 * 60 * 60; // 24 heures
      const expirationDate = new Date(Date.now() + expiresIn * 1000);

      const userContext: UserContext = {
        userId: user.id,
        roles: user.roles,
        permissions: user.permissions,
        metadata: {
          authMethod: 'mock',
          name: user.name,
          email: user.email
        }
      };

      this.activeTokens.set(token, userContext);
      this.tokenExpiration.set(token, expirationDate);

      return {
        success: true,
        token,
        user: userContext,
        expiresIn
      };
    } catch (error) {
      return {
        success: false,
        token: '',
        user: {} as UserContext,
        expiresIn: 0
      };
    }
  }

  async validateToken(token: string): Promise<UserContext | null> {
    if (!this.activeTokens.has(token)) {
      return null;
    }

    const expiration = this.tokenExpiration.get(token);
    if (expiration && expiration < new Date()) {
      // Token expiré
      this.activeTokens.delete(token);
      this.tokenExpiration.delete(token);
      return null;
    }

    return this.activeTokens.get(token) || null;
  }

  async refreshToken(token: string): Promise<string> {
    const user = await this.validateToken(token);
    if (!user) {
      throw new Error('Invalid token');
    }

    // Révoquer l'ancien token
    await this.revokeToken(token);

    // Créer un nouveau token
    const newToken = `token_${user.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const expiresIn = 24 * 60 * 60;
    const expirationDate = new Date(Date.now() + expiresIn * 1000);

    this.activeTokens.set(newToken, user);
    this.tokenExpiration.set(newToken, expirationDate);

    return newToken;
  }

  async revokeToken(token: string): Promise<void> {
    this.activeTokens.delete(token);
    this.tokenExpiration.delete(token);
  }

  // ==========================================
  // PERMISSIONS GRANULAIRES POUR RESSOURCES
  // ==========================================

  async canCreateApplication(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes('*') || 
           permissions.includes('app:*') || 
           permissions.includes('app:create');
  }

  async canDeleteApplication(userId: string, appId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    // Admin peut tout supprimer
    if (permissions.includes('*') || permissions.includes('app:*')) {
      return true;
    }

    // Utilisateur peut supprimer ses propres apps (mock - toujours true pour simplifier)
    return permissions.includes('app:delete');
  }

  async canCreateAgent(userId: string, appId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    if (permissions.includes('*') || permissions.includes('agent:*')) {
      return true;
    }

    return permissions.includes('agent:create');
  }

  async canDeleteAgent(userId: string, agentId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    if (permissions.includes('*') || permissions.includes('agent:*')) {
      return true;
    }

    return permissions.includes('agent:delete');
  }

  async canDeployAgent(userId: string, agentId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    if (permissions.includes('*') || permissions.includes('agent:*')) {
      return true;
    }

    return permissions.includes('agent:deploy');
  }

  async canListResources(userId: string, resourceType: 'applications' | 'agents'): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const prefix = resourceType === 'applications' ? 'app' : 'agent';
    
    return permissions.includes('*') || 
           permissions.includes(`${prefix}:*`) ||
           permissions.includes(`${prefix}:list`);
  }
} 