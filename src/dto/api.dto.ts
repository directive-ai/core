import { AgentResponse } from './agent-response.dto.js';
import { SessionStatus } from './session.dto.js';

/**
 * Requête de création de session
 */
export interface CreateSessionRequest {
  agent_type: string;                     // Type d'agent directeur à instancier
  metadata?: Record<string, any>;         // Métadonnées initiales
}

/**
 * Réponse de création de session
 */
export interface CreateSessionResponse {
  session_id: string;                     // ID unique de la session créée
  state: string;                          // État initial de la machine XState
  created_at: string;                     // Timestamp de création
  agent_response: AgentResponse;          // Première réponse de l'agent directeur
}

/**
 * Événement à envoyer à une session
 */
export interface SessionEvent {
  event: string;                          // Nom de l'événement XState
  data?: Record<string, any>;             // Données associées à l'événement
}

/**
 * Réponse après traitement d'un événement
 */
export interface SessionEventResponse {
  session_id: string;                     // ID de la session
  state: string;                          // Nouvel état après transition
  agent_response?: AgentResponse;         // Réponse de l'agent directeur (si applicable)
  message?: string;                       // Message de statut
}

/**
 * Métadonnées d'un agent directeur
 */
export interface AgentMetadata {
  name: string;                           // Nom lisible de l'agent
  description: string;                    // Description du comportement
  version: string;                        // Version de l'agent
  author?: string;                        // Auteur de l'agent
  created_at?: string;                    // Date de création
}

/**
 * Informations d'un agent directeur enregistré
 */
export interface RegisteredAgent {
  type: string;                           // Type unique de l'agent
  status: 'active' | 'error' | 'loading'; // Statut de l'agent
  metadata: AgentMetadata;                // Métadonnées de l'agent
  file_path?: string;                     // Chemin du fichier agent.ts
  hash?: string;                          // Hash du fichier pour cache
  error_message?: string;                 // Message d'erreur si status = 'error'
}

/**
 * Statut de santé du serveur
 */
export interface HealthStatus {
  status: 'ok' | 'error';                 // Statut général
  agents: number;                         // Nombre d'agents enregistrés
  active_sessions: number;                // Nombre de sessions actives
  uptime: number;                         // Temps de fonctionnement en secondes
  version: string;                        // Version du serveur
} 