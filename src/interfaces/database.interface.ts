import { 
  Session, 
  ConversationEntry, 
  AgentRegistration, 
  Application, 
  CreateApplicationRequest, 
  UpdateApplicationRequest 
} from '@/dto/index.js';

/**
 * Interface pour les services de base de données
 * 
 * Cette interface définit le contrat pour la persistance des données
 * dans Directive. Elle permet d'abstraire l'implémentation concrète
 * (JSON, PostgreSQL, etc.) du reste de l'application.
 */
export interface IDatabaseService {
  // ==========================================
  // Gestion des Applications
  // ==========================================

  /**
   * Crée une nouvelle application
   * @param application Données de l'application à créer
   * @returns Application créée avec ID et timestamps
   */
  createApplication(application: CreateApplicationRequest): Promise<Application>;

  /**
   * Récupère une application par son ID
   * @param applicationId Identifiant unique de l'application
   * @returns Application trouvée ou null si inexistante
   */
  getApplication(applicationId: string): Promise<Application | null>;

  /**
   * Récupère une application par son nom
   * @param name Nom de l'application
   * @returns Application trouvée ou null si inexistante
   */
  getApplicationByName(name: string): Promise<Application | null>;

  /**
   * Récupère toutes les applications
   * @returns Liste de toutes les applications
   */
  getApplications(): Promise<Application[]>;

  /**
   * Met à jour une application
   * @param applicationId Identifiant de l'application
   * @param updates Données à mettre à jour
   */
  updateApplication(applicationId: string, updates: UpdateApplicationRequest): Promise<void>;

  /**
   * Supprime une application et tous ses agents/sessions
   * @param applicationId Identifiant de l'application
   */
  deleteApplication(applicationId: string): Promise<void>;

  /**
   * Récupère tous les agents directeurs d'une application
   * @param applicationId Identifiant de l'application
   * @returns Liste des agents de l'application
   */
  getApplicationAgents(applicationId: string): Promise<AgentRegistration[]>;

  // ==========================================
  // Gestion des Sessions
  // ==========================================

  /**
   * Crée une nouvelle session avec un ID unique
   * @param session Données de session sans session_id et created_at
   * @returns Session créée avec ID et timestamp
   */
  createSession(session: Omit<Session, 'session_id' | 'created_at'>): Promise<Session>;

  /**
   * Récupère une session par son ID
   * @param sessionId Identifiant unique de la session
   * @returns Session trouvée ou null si inexistante
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Met à jour l'état actuel d'une session
   * @param sessionId Identifiant de la session
   * @param state Nouvel état de la machine XState
   */
  updateSessionState(sessionId: string, state: Session['current_state']): Promise<void>;

  /**
   * Met à jour le statut d'une session
   * @param sessionId Identifiant de la session
   * @param status Nouveau statut de la session
   */
  updateSessionStatus(sessionId: string, status: Session['status']): Promise<void>;

  /**
   * Ajoute une entrée à l'historique de conversation d'une session
   * @param sessionId Identifiant de la session
   * @param entry Nouvelle entrée de conversation
   */
  addConversationEntry(sessionId: string, entry: Omit<ConversationEntry, 'timestamp'>): Promise<void>;

  /**
   * Récupère l'historique complet des conversations d'une session
   * @param sessionId Identifiant de la session
   * @returns Liste chronologique des entrées de conversation
   */
  getSessionHistory(sessionId: string): Promise<ConversationEntry[]>;

  /**
   * Supprime une session et tout son historique
   * @param sessionId Identifiant de la session à supprimer
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Récupère toutes les sessions actives
   * @returns Liste des sessions avec status 'active'
   */
  getActiveSessions(): Promise<Session[]>;

  /**
   * Nettoie les sessions expirées ou orphelines
   * @param maxAge Age maximum en millisecondes
   * @returns Nombre de sessions supprimées
   */
  cleanupExpiredSessions(maxAge: number): Promise<number>;

  // ==========================================
  // Gestion des Agents Directeurs
  // ==========================================

  /**
   * Crée un agent directeur en mode draft (sans machine_definition)
   * @param agent Données de base de l'agent à créer
   * @returns Agent créé avec statut 'draft'
   */
  createAgent(agent: {
    type: string;
    application_id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    file_path?: string;
  }): Promise<AgentRegistration>;

  /**
   * Enregistre ou déploie un agent directeur (avec versioning automatique)
   * @param agent Données complètes de l'agent à enregistrer
   * @returns Agent enregistré avec ID et timestamps
   */
  registerAgent(agent: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'>): Promise<AgentRegistration>;

  /**
   * Récupère la liste de tous les agents directeurs enregistrés
   * @param filter Filtre optionnel sur le statut ou l'application
   * @returns Liste des agents avec leurs métadonnées
   */
  getRegisteredAgents(filter?: { 
    status?: 'draft' | 'active' | 'inactive' | 'error' | 'reloading';
    application_id?: string;
  }): Promise<AgentRegistration[]>;

  /**
   * Récupère les informations d'un agent directeur par son ID
   * @param agentId ID unique de l'agent
   * @returns Informations de l'agent ou null si inexistant
   */
  getAgent(agentId: string): Promise<AgentRegistration | null>;

  /**
   * Récupère les informations d'un agent directeur par son type
   * @param agentType Type de l'agent (ex: "metacopi/correction")
   * @returns Informations de l'agent ou null si inexistant
   */
  getAgentByType(agentType: string): Promise<AgentRegistration | null>;

  /**
   * Supprime un agent directeur du registre
   * @param agentId ID de l'agent à supprimer
   */
  removeAgent(agentId: string): Promise<void>;

  /**
   * Met à jour le statut d'un agent directeur
   * @param agentId ID de l'agent
   * @param status Nouveau statut
   * @param errorMessage Message d'erreur optionnel
   */
  updateAgentStatus(
    agentId: string, 
    status: 'draft' | 'active' | 'inactive' | 'error' | 'reloading',
    errorMessage?: string
  ): Promise<void>;

  /**
   * Marque un agent comme ayant besoin d'être redéployé
   * @param agentType Type de l'agent
   * @param sourceHash Hash du nouveau code source
   */
  markAgentForDeployment(agentType: string, sourceHash: string): Promise<void>;

  /**
   * Récupère les agents qui ont besoin d'être redéployés
   * @param applicationId Filtrer par application (optionnel)
   * @returns Liste des agents nécessitant un redéploiement
   */
  getAgentsNeedingDeployment(applicationId?: string): Promise<AgentRegistration[]>;

  /**
   * Récupère le statut de déploiement d'un agent spécifique
   * @param agentType Type de l'agent
   * @returns Statut de déploiement ou null si agent inexistant
   */
  getAgentDeploymentStatus(agentType: string): Promise<{
    agent_type: string;
    current_version: number;
    needs_deployment: boolean;
    last_deployed_at: string;
    active_sessions: number;
  } | null>;

  // ==========================================
  // Méthodes utilitaires
  // ==========================================

  /**
   * Vérifie la santé de la base de données
   * @returns Statut de santé et métriques
   */
  getHealthStatus(): Promise<{
    status: 'ok' | 'error';
    total_applications: number;
    total_agents: number;
    active_agents: number;
    total_sessions: number;
    active_sessions: number;
    storage_size?: number;
    last_cleanup?: string;
  }>;

  /**
   * Initialise la base de données (création des tables/collections)
   */
  initialize(): Promise<void>;

  /**
   * Ferme proprement la connexion à la base de données
   */
  close(): Promise<void>;
} 