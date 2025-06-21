/**
 * Métadonnées d'un agent directeur enregistré
 */
export interface AgentRegistration {
  id: string;                             // Identifiant unique (ex: "agent_metacopi_correction_001")
  type: string;                           // Type unique de l'agent (ex: "metacopi/correction")
  application_id: string;                 // ID de l'application parente
  name: string;                           // Nom lisible de l'agent
  description: string;                    // Description du comportement
  version: string;                        // Version sémantique (ex: "1.0.0")
  deployment_version: number;             // Version de déploiement incrémentale (1, 2, 3...)
  git_commit_id?: string;                 // ID du commit Git au moment du déploiement
  status: 'draft' | 'active' | 'inactive' | 'error' | 'reloading'; // Statut de l'agent
  machine_definition?: Record<string, any>; // Définition de la machine XState
  created_at: string;                     // Timestamp de première création (premier déploiement)
  updated_at: string;                     // Timestamp de dernière mise à jour
  deployed_at: string;                    // Timestamp du dernier déploiement
  last_reload_at?: string;                // Timestamp du dernier rechargement (deprecated, use deployed_at)
  metadata: {
    file_path?: string;                   // Chemin du fichier agent.ts
    source_hash?: string;                 // Hash du code source déployé
    dev_source_hash?: string;             // Hash du code source en développement
    hot_reload_enabled?: boolean;         // Hot-reload activé
    needs_deployment?: boolean;           // true si code source modifié depuis dernier déploiement
    deployment_strategy?: 'wait' | 'migrate' | 'force'; // Stratégie pour sessions actives
    performance?: {
      avg_transition_time_ms?: number;
      success_rate?: number;
    };
    [key: string]: any;                   // Métadonnées supplémentaires
  };
  error_message?: string;                 // Message d'erreur si status = 'error'
}

/**
 * Stratégies de déploiement pour la gestion des sessions actives
 */
export type DeploymentStrategy = 'wait' | 'migrate' | 'force';

/**
 * Requête de déploiement d'un agent
 */
/**
 * Stratégies pour gérer les modifications non commitées lors du déploiement
 */
export type GitCommitStrategy = 'strict' | 'auto-commit' | 'warn' | 'ignore';

export interface DeployAgentRequest {
  agent_type: string;                     // Type de l'agent à déployer (ex: "metacopi/correction")
  strategy?: DeploymentStrategy;          // Stratégie pour les sessions actives (défaut: 'wait')
  force_version?: number;                 // Forcer un numéro de version spécifique
  git_commit_id?: string;                 // ID du commit Git (auto-détecté si non fourni)
  git_strategy?: GitCommitStrategy;       // Stratégie pour les modifications non commitées (défaut: 'strict')
  git_commit_message?: string;            // Message de commit si git_strategy = 'auto-commit'
}

/**
 * Réponse de déploiement d'un agent
 */
export interface DeployAgentResponse {
  success: boolean;
  agent_type: string;
  old_version: number;                    // Version précédente
  new_version: number;                    // Nouvelle version déployée
  git_commit_id?: string;                 // ID du commit Git déployé
  git_strategy_used?: GitCommitStrategy;  // Stratégie Git utilisée
  git_was_dirty?: boolean;                // true si des modifications ont été détectées
  git_committed_files?: string[];         // Fichiers committés automatiquement (si auto-commit)
  deployed_at: string;                    // Timestamp du déploiement
  affected_sessions: number;              // Nombre de sessions actives affectées
  compilation_time_ms: number;            // Temps de compilation en ms
  deployment_time_ms: number;             // Temps total de déploiement en ms
  message: string;                        // Message de succès ou d'erreur
  warnings?: string[];                    // Avertissements éventuels
}

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