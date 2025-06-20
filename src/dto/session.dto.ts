/**
 * Statut d'une session
 */
export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed', 
  TIMEOUT = 'timeout',
  ERROR = 'error'
}

/**
 * Entrée dans l'historique de conversation d'une session
 */
export interface ConversationEntry {
  timestamp: string;                      // ISO 8601 timestamp
  from: 'agent_directeur' | 'agent_executant';
  to: 'agent_directeur' | 'agent_executant';
  content: string;                        // Contenu du message
  state_before?: string;                  // État XState avant transition
  state_after?: string;                   // État XState après transition
  trigger?: string;                       // Événement déclencheur
}

/**
 * État actuel d'une session avec machine XState
 */
export interface SessionState {
  xstate_state: string;                   // État courant de la machine XState
  context: Record<string, any>;           // Contexte de la machine à état
  history: string[];                      // Historique des états traversés
}

/**
 * Session complète avec agent directeur et historique
 */
export interface Session {
  session_id: string;                     // Identifiant unique de session
  agent_directeur_type: string;           // Type d'agent directeur (ex: "metacopi/correction")
  created_at: string;                     // ISO 8601 timestamp de création
  status: SessionStatus;                  // Statut actuel de la session
  current_state: SessionState;            // État actuel de la machine XState
  conversation_history: ConversationEntry[]; // Historique complet des échanges
} 