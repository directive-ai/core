/**
 * Application groupant plusieurs agents directeurs
 */
export interface Application {
  id: string;                             // Identifiant unique (ex: "app_metacopi_001")
  name: string;                           // Nom de l'application (ex: "metacopi")
  description: string;                    // Description de l'application
  author: string;                         // Auteur de l'application
  version: string;                        // Version de l'application
  created_at: string;                     // Timestamp de création
  updated_at: string;                     // Timestamp de dernière mise à jour
  agents_count: number;                   // Nombre d'agents directeurs dans l'application
  metadata: {
    category?: string;                    // Catégorie (ex: "text-processing")
    tags?: string[];                      // Tags descriptifs
    repository?: string;                  // URL du repository Git
    [key: string]: any;                   // Métadonnées supplémentaires
  };
}

/**
 * Requête de création d'application
 */
export interface CreateApplicationRequest {
  name: string;                           // Nom unique de l'application
  description: string;                    // Description
  author?: string;                        // Auteur (optionnel)
  version?: string;                       // Version (défaut: "1.0.0")
  metadata?: Record<string, any>;         // Métadonnées optionnelles
}

/**
 * Requête de mise à jour d'application
 */
export interface UpdateApplicationRequest {
  name?: string;                          // Nouveau nom
  description?: string;                   // Nouvelle description
  author?: string;                        // Nouvel auteur
  version?: string;                       // Nouvelle version
  metadata?: Record<string, any>;         // Nouvelles métadonnées
} 