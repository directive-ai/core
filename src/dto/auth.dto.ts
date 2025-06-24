import { UserContext } from './index.js';

/**
 * DTOs pour l'authentification CLI
 */

export interface LoginCredentials {
  email?: string;
  password?: string;
  token?: string;
  provider: 'email' | 'token' | 'github' | 'google';
}

export interface LoginResult {
  success: boolean;
  token: string;
  user: UserContext;
  expiresIn: number; // secondes
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ServerInfo {
  version: string;
  status: 'healthy' | 'unhealthy';
  environment: 'local' | 'production';
  features: string[];
}

export interface CreateApplicationRequest {
  name: string;
  description: string;
}

export interface CreateAgentRequest {
  name: string;
  type: string;
  applicationId: string;
  description?: string;
}

export interface DeployAgentRequest {
  agentId: string;
  force?: boolean;
}

// ============================================================================
// NOUVEAUX DTOs - PHASE 3.1 (Migration CLI/API REST)
// ============================================================================

/**
 * Configuration globale Directive (CLI + serveur)
 */
export interface GlobalConfig {
  version: string;
  preferences: {
    defaultAuthor: string;
    defaultDatabase: string;
  };
  server: {
    url: string;
    environment: 'local' | 'production';
  };
  cli: {
    version: string;
    lastUpdate: string;
  };
}

/**
 * Requête d'initialisation globale
 */
export interface InitRequest {
  defaultAuthor?: string;
  serverUrl?: string;
  force?: boolean;
}

/**
 * Réponse d'initialisation globale
 */
export interface InitResponse {
  success: boolean;
  config: GlobalConfig;
  message: string;
  directoryCreated: string;
}

/**
 * Informations étendues du serveur
 */
export interface ExtendedServerInfo {
  name: string;
  version: string;
  environment: 'local' | 'production';
  baseUrl: string;
  status: 'healthy' | 'degraded' | 'down';
  features: {
    authentication: boolean;
    deployments: boolean;
    templating: boolean;
    versioning: boolean;
  };
} 