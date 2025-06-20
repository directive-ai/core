/**
 * Format de réponse attendu de l'agent exécutant
 */
export interface ResponseFormat {
  type: 'text' | 'structured' | 'choice' | 'file';
  schema?: Record<string, string>;        // Schema pour structured
  options?: string[];                     // Choix pour choice
  maxLength?: number;                     // Limite pour text
  required?: string[];                    // Champs obligatoires
  validation?: string;                    // Règles de validation
}

/**
 * Document attaché à la réponse de l'agent directeur
 */
export interface AgentDocument {
  type: 'reference' | 'template' | 'validation' | 'data';
  content: string;                        // Contenu du document
  url?: string;                          // URL optionnelle
}

/**
 * Contexte fourni avec la réponse de l'agent directeur
 */
export interface AgentContext {
  documents: AgentDocument[];             // Documents en pièce jointe
  metadata: Record<string, any>;          // Contexte métier
}

/**
 * Réponse structurée de l'agent directeur vers l'agent exécutant
 */
export interface AgentResponse {
  type: 'prompt' | 'instruction' | 'validation' | 'completion';
  instruction: string;                    // Texte des directives
  format: ResponseFormat;                 // Format attendu en retour
  context: AgentContext;                  // Contexte et pièces jointes
  metadata?: Record<string, any>;         // Métadonnées additionnelles
} 