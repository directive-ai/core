/**
 * Contexte utilisateur après authentification
 */
export interface UserContext {
  userId: string;                         // Identifiant unique utilisateur
  roles: string[];                        // Rôles de l'utilisateur
  permissions: string[];                  // Permissions spécifiques
  metadata?: Record<string, any>;         // Métadonnées utilisateur
}

/**
 * Contexte d'authentification d'une session
 */
export interface SessionAuthContext {
  sessionId: string;                      // ID de la session
  userId: string;                         // ID de l'utilisateur propriétaire
  agentType: string;                      // Type d'agent directeur
  createdAt: Date;                        // Date de création de l'auth
  permissions: string[];                  // Permissions pour cette session
  expiresAt?: Date;                       // Date d'expiration optionnelle
} 