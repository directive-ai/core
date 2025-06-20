/**
 * Métadonnées d'un agent directeur enregistré
 */
export interface AgentRegistration {
  id: string;                             // Identifiant unique (ex: "agent_metacopi_correction_001")
  type: string;                           // Type unique de l'agent (ex: "metacopi/correction")
  application_id: string;                 // ID de l'application parente
  name: string;                           // Nom lisible de l'agent
  description: string;                    // Description du comportement
  version: string;                        // Version de l'agent
  status: 'active' | 'inactive' | 'error' | 'reloading'; // Statut de l'agent
  machine_definition?: Record<string, any>; // Définition de la machine XState
  created_at: string;                     // Timestamp de création
  updated_at: string;                     // Timestamp de dernière mise à jour
  last_reload_at?: string;                // Timestamp du dernier rechargement
  metadata: {
    file_path?: string;                   // Chemin du fichier agent.ts
    hash?: string;                        // Hash du fichier pour cache
    hot_reload_enabled?: boolean;         // Hot-reload activé
    performance?: {
      avg_transition_time_ms?: number;
      success_rate?: number;
    };
    [key: string]: any;                   // Métadonnées supplémentaires
  };
  error_message?: string;                 // Message d'erreur si status = 'error'
} 