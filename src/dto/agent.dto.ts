// Imports depuis @directive/types pour éviter les duplications
import type {
  AgentRegistration,
  DeploymentStrategy,
  GitCommitStrategy,
  DeployAgentRequest,
  DeployAgentResponse
} from '@directive/types';

// Réexport pour compatibilité avec le code existant
export type {
  AgentRegistration,
  DeploymentStrategy,
  GitCommitStrategy,
  DeployAgentRequest,
  DeployAgentResponse
};

/**
 * Statut de déploiement d'un agent (pour la commande status)
 */
export interface AgentDeploymentStatus {
  agent_type: string;
  current_version: number;                // Version actuellement déployée
  current_git_commit_id?: string;         // ID du commit Git actuellement déployé
  needs_deployment: boolean;              // Modifications en attente
  source_modified_at?: string;            // Date de dernière modification du source
  last_deployed_at: string;               // Date du dernier déploiement
  active_sessions: number;                // Nombre de sessions actives
  deployment_strategy: DeploymentStrategy; // Stratégie configurée
} 