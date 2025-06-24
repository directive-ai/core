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