import { UserContext, SessionAuthContext } from '@/dto/index.js';

/**
 * Interface pour les services d'authentification et autorisation (IAM)
 * 
 * Cette interface définit le contrat pour la gestion des identités,
 * l'authentification et l'autorisation dans Directive.
 * Version stub pour le MVP avec implémentation mock.
 */
export interface IIAMService {
  // ==========================================
  // Authentification
  // ==========================================

  /**
   * Authentifie un utilisateur à partir d'un token
   * @param token Token d'authentification (JWT, API key, etc.)
   * @returns Contexte utilisateur ou null si authentification échouée
   */
  authenticate(token: string): Promise<UserContext | null>;

  /**
   * Valide une session existante
   * @param sessionId Identifiant de la session
   * @param userId Identifiant de l'utilisateur
   * @returns true si la session est valide
   */
  validateSession(sessionId: string, userId: string): Promise<boolean>;

  // ==========================================
  // Autorisation
  // ==========================================

  /**
   * Vérifie si un utilisateur peut créer une session avec un agent donné
   * @param userId Identifiant de l'utilisateur
   * @param agentType Type d'agent directeur
   * @returns true si l'utilisateur est autorisé
   */
  canCreateSession(userId: string, agentType: string): Promise<boolean>;

  /**
   * Vérifie si un utilisateur peut accéder à une session
   * @param userId Identifiant de l'utilisateur
   * @param sessionId Identifiant de la session
   * @returns true si l'utilisateur est autorisé
   */
  canAccessSession(userId: string, sessionId: string): Promise<boolean>;

  /**
   * Vérifie si un utilisateur peut exécuter une action sur une session
   * @param userId Identifiant de l'utilisateur
   * @param sessionId Identifiant de la session
   * @param action Action à vérifier (ex: "read", "write", "delete")
   * @returns true si l'utilisateur est autorisé
   */
  canExecuteAction(userId: string, sessionId: string, action: string): Promise<boolean>;

  // ==========================================
  // Gestion des contextes de session
  // ==========================================

  /**
   * Crée un contexte d'authentification pour une session
   * @param sessionId Identifiant de la session
   * @param userId Identifiant de l'utilisateur
   * @param agentType Type d'agent directeur
   * @returns Contexte d'authentification créé
   */
  createSessionAuth(sessionId: string, userId: string, agentType: string): Promise<SessionAuthContext>;

  /**
   * Récupère le contexte d'authentification d'une session
   * @param sessionId Identifiant de la session
   * @returns Contexte d'authentification ou null si inexistant
   */
  getSessionAuth(sessionId: string): Promise<SessionAuthContext | null>;

  /**
   * Révoque l'authentification d'une session
   * @param sessionId Identifiant de la session
   */
  revokeSessionAuth(sessionId: string): Promise<void>;

  // ==========================================
  // Gestion des permissions
  // ==========================================

  /**
   * Récupère les permissions d'un utilisateur
   * @param userId Identifiant de l'utilisateur
   * @returns Liste des permissions
   */
  getUserPermissions(userId: string): Promise<string[]>;

  /**
   * Vérifie si un utilisateur a une permission spécifique
   * @param userId Identifiant de l'utilisateur
   * @param permission Permission à vérifier
   * @returns true si l'utilisateur a la permission
   */
  hasPermission(userId: string, permission: string): Promise<boolean>;

  // ==========================================
  // Utilitaires
  // ==========================================

  /**
   * Vérifie la santé du service IAM
   * @returns Statut de santé du service
   */
  getHealthStatus(): Promise<{
    status: 'ok' | 'error';
    authenticatedUsers: number;
    activeSessions: number;
    authMethod: string;
  }>;
} 