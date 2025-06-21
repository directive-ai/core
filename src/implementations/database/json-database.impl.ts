import * as path from 'path';
import * as fs from 'fs/promises';
import { IDatabaseService } from '../../interfaces/database.interface';
import { 
  Session, 
  ConversationEntry, 
  AgentRegistration, 
  Application, 
  CreateApplicationRequest, 
  UpdateApplicationRequest 
} from '../../dto/index';

/**
 * Schéma de la base de données JSON pour Directive
 */
interface DatabaseSchema {
  applications: Record<string, Application>;
  sessions: Record<string, Session>;
  agents: Record<string, AgentRegistration>;
  conversation_history: Array<ConversationEntry & { session_id: string }>;
  metadata: {
    version: string;
    created_at: string;
    last_modified: string;
    last_cleanup?: string;
  };
}

/**
 * Implémentation de IDatabaseService avec persistance JSON locale
 * 
 * Cette implémentation utilise fs/promises pour gérer :
 * - Les applications et leurs métadonnées
 * - Les sessions actives et leur état XState
 * - L'historique des conversations
 * - L'enregistrement des agents directeurs
 * - Les métadonnées de la base de données
 */
export class JsonDatabaseService implements IDatabaseService {
  private readonly dataDir: string;
  private readonly dbFile: string;
  private initialized = false;
  private data: DatabaseSchema;

  /**
   * Constructeur du service de base de données JSON simple
   * @param dataDir Répertoire où stocker les fichiers de données (défaut: './data')
   */
  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'directive.json');
    this.data = this.getDefaultData();
  }

  /**
   * Initialise la base de données et crée les fichiers si nécessaire
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Créer le répertoire data si il n'existe pas
      await this.ensureDataDir();

      // Lire les données existantes ou utiliser les données par défaut
      await this.loadData();

      // Mettre à jour les métadonnées
      this.data.metadata.last_modified = new Date().toISOString();
      await this.saveData();

      this.initialized = true;
      
      // Ne pas logger pendant les tests
      if (process.env.NODE_ENV !== 'test') {
        console.log(`JSON Database initialized: ${this.dbFile}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize JSON Database: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Ferme proprement la connexion à la base de données
   */
  async close(): Promise<void> {
    if (this.initialized) {
      await this.saveData();
      this.initialized = false;
    }
  }

  /**
   * Retourne la structure de données par défaut
   */
  private getDefaultData(): DatabaseSchema {
    return {
      applications: {},
      sessions: {},
      agents: {},
      conversation_history: [],
      metadata: {
        version: '1.0.0',
        created_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      }
    };
  }

  /**
   * Assure l'existence du répertoire de données
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Le répertoire existe déjà ou erreur de permission
      if (error instanceof Error && !error.message.includes('EEXIST')) {
        throw error;
      }
    }
  }

  /**
   * Charge les données depuis le fichier
   */
  private async loadData(): Promise<void> {
    try {
      const content = await fs.readFile(this.dbFile, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      // Si le fichier n'existe pas, utiliser les données par défaut
      this.data = this.getDefaultData();
    }
  }

  /**
   * Sauvegarde les données dans le fichier
   */
  private async saveData(): Promise<void> {
    this.data.metadata.last_modified = new Date().toISOString();
    await fs.writeFile(this.dbFile, JSON.stringify(this.data, null, 2));
  }

  /**
   * Assure que la base de données est initialisée avant toute opération
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Génère un ID unique
   */
  private generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  // ==========================================
  // Gestion des Applications
  // ==========================================

  async createApplication(application: CreateApplicationRequest): Promise<Application> {
    await this.ensureInitialized();
    
    const appId = this.generateId('app');
    const now = new Date().toISOString();
    
    const newApplication: Application = {
      id: appId,
      name: application.name,
      description: application.description || '',
      version: application.version || '1.0.0',
      author: application.author || '',
      created_at: now,
      updated_at: now,
      agents_count: 0,
      metadata: application.metadata || {}
    };

    this.data.applications[appId] = newApplication;
    await this.saveData();

    return newApplication;
  }

  async getApplication(applicationId: string): Promise<Application | null> {
    await this.ensureInitialized();
    return this.data.applications[applicationId] || null;
  }

  async getApplicationByName(name: string): Promise<Application | null> {
    await this.ensureInitialized();
    
    const applications = Object.values(this.data.applications);
    return applications.find(app => app.name === name) || null;
  }

  async getApplications(): Promise<Application[]> {
    await this.ensureInitialized();
    return Object.values(this.data.applications);
  }

  async updateApplication(applicationId: string, updates: UpdateApplicationRequest): Promise<void> {
    await this.ensureInitialized();
    
    const application = this.data.applications[applicationId];
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    Object.assign(application, updates, {
      updated_at: new Date().toISOString()
    });

    await this.saveData();
  }

  async deleteApplication(applicationId: string): Promise<void> {
    await this.ensureInitialized();
    
    // Supprimer l'application
    delete this.data.applications[applicationId];
    
    // Supprimer tous les agents de cette application
    Object.keys(this.data.agents).forEach(agentId => {
      if (this.data.agents[agentId].application_id === applicationId) {
        delete this.data.agents[agentId];
      }
    });

    // Supprimer toutes les sessions des agents de cette application
    Object.keys(this.data.sessions).forEach(sessionId => {
      const agentType = this.data.sessions[sessionId].agent_directeur_type;
      if (agentType.startsWith(`${applicationId}/`)) {
        delete this.data.sessions[sessionId];
        
        // Supprimer l'historique des conversations
        this.data.conversation_history = this.data.conversation_history
          .filter(entry => entry.session_id !== sessionId);
      }
    });

    await this.saveData();
  }

  async getApplicationAgents(applicationId: string): Promise<AgentRegistration[]> {
    await this.ensureInitialized();
    
    return Object.values(this.data.agents)
      .filter(agent => agent.application_id === applicationId);
  }

  // ==========================================
  // Gestion des Sessions
  // ==========================================

  async createSession(session: Omit<Session, 'session_id' | 'created_at'>): Promise<Session> {
    await this.ensureInitialized();
    
    // Générer un ID unique pour la session
    const sessionId = this.generateSessionId(session.agent_directeur_type);
    
    const newSession: Session = {
      ...session,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    };

    this.data.sessions[sessionId] = newSession;
    await this.saveData();

    return newSession;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    await this.ensureInitialized();
    return this.data.sessions[sessionId] || null;
  }

  async updateSessionState(sessionId: string, state: Session['current_state']): Promise<void> {
    await this.ensureInitialized();
    
    const session = this.data.sessions[sessionId];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.current_state = state;
    await this.saveData();
  }

  async updateSessionStatus(sessionId: string, status: Session['status']): Promise<void> {
    await this.ensureInitialized();
    
    const session = this.data.sessions[sessionId];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = status;
    await this.saveData();
  }

  async addConversationEntry(sessionId: string, entry: Omit<ConversationEntry, 'timestamp'>): Promise<void> {
    await this.ensureInitialized();
    
    // Vérifier que la session existe
    const session = this.data.sessions[sessionId];
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const conversationEntry = {
      ...entry,
      session_id: sessionId,
      timestamp: new Date().toISOString()
    };

    this.data.conversation_history.push(conversationEntry);
    await this.saveData();
  }

  async getSessionHistory(sessionId: string): Promise<ConversationEntry[]> {
    await this.ensureInitialized();
    
    return this.data.conversation_history
      .filter(entry => entry.session_id === sessionId)
      .map(({ session_id, ...entry }) => entry)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    
    delete this.data.sessions[sessionId];
    
    // Supprimer l'historique des conversations
    this.data.conversation_history = this.data.conversation_history
      .filter(entry => entry.session_id !== sessionId);

    await this.saveData();
  }

  async getActiveSessions(): Promise<Session[]> {
    await this.ensureInitialized();
    
    return Object.values(this.data.sessions)
      .filter(session => session.status === 'active');
  }

  async cleanupExpiredSessions(maxAge: number): Promise<number> {
    await this.ensureInitialized();
    
    const cutoffTime = new Date(Date.now() - maxAge);
    let removedCount = 0;

    const expiredSessionIds: string[] = [];
    Object.keys(this.data.sessions).forEach(sessionId => {
      const session = this.data.sessions[sessionId];
      if (new Date(session.created_at) < cutoffTime && 
          (session.status === 'completed' || session.status === 'timeout')) {
        expiredSessionIds.push(sessionId);
      }
    });

    expiredSessionIds.forEach(sessionId => {
      delete this.data.sessions[sessionId];
      removedCount++;
    });

    this.data.conversation_history = this.data.conversation_history
      .filter(entry => !expiredSessionIds.includes(entry.session_id));

    if (removedCount > 0) {
      this.data.metadata.last_cleanup = new Date().toISOString();
      await this.saveData();
    }

    return removedCount;
  }

  // ==========================================
  // Gestion des Agents Directeurs
  // ==========================================

  async createAgent(agent: {
    type: string;
    application_id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    file_path?: string;
  }): Promise<AgentRegistration> {
    await this.ensureInitialized();
    
    // Vérifier si un agent avec ce type existe déjà
    const existingAgent = await this.getAgentByType(agent.type);
    if (existingAgent) {
      throw new Error(`Agent "${agent.type}" already exists in database`);
    }

    const agentId = this.generateId('agent');
    const now = new Date().toISOString();
    
    const newAgent: AgentRegistration = {
      id: agentId,
      type: agent.type,
      application_id: agent.application_id,
      name: agent.name,
      description: agent.description,
      version: agent.version,
      deployment_version: 0, // Pas encore déployé
      status: 'draft', // Statut draft - créé mais pas déployé
      machine_definition: undefined, // Pas de définition de machine pour le moment
      created_at: now,
      updated_at: now,
      deployed_at: '', // Sera renseigné lors du premier déploiement
      metadata: {
        file_path: agent.file_path,
        needs_deployment: true // Nécessite un déploiement
      }
    };

    this.data.agents[agentId] = newAgent;

    // Mettre à jour le compteur d'agents de l'application
    await this.updateApplicationAgentCount(agent.application_id);

    await this.saveData();
    return newAgent;
  }

  async registerAgent(agent: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'>): Promise<AgentRegistration> {
    await this.ensureInitialized();
    
    // Vérifier si un agent avec ce type existe déjà
    const existingAgent = await this.getAgentByType(agent.type);
    
    if (existingAgent) {
      if (existingAgent.status === 'draft') {
        // Premier déploiement d'un agent créé en draft
        return this.deployDraftAgent(existingAgent, agent);
      } else {
        // Mise à jour d'un agent existant déjà déployé (redéploiement)
        return this.deployExistingAgent(existingAgent, agent);
      }
    } else {
      // Nouvel agent (premier déploiement direct sans création préalable)
      return this.deployNewAgent(agent);
    }
  }

  /**
   * Déploie un agent créé en mode draft (premier déploiement)
   */
  private async deployDraftAgent(
    existingAgent: AgentRegistration,
    updates: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'>
  ): Promise<AgentRegistration> {
    const now = new Date().toISOString();
    
    const deployedAgent: AgentRegistration = {
      ...existingAgent,
      ...updates,
      id: existingAgent.id, // Garder l'ID original
      deployment_version: 1, // Premier déploiement
      status: 'active', // Passe de 'draft' à 'active'
      deployed_at: now, // Première date de déploiement
      updated_at: now,
      // created_at reste inchangé (date de création originale)
      metadata: {
        ...existingAgent.metadata,
        ...updates.metadata,
        needs_deployment: false // Vient d'être déployé
      }
    };

    this.data.agents[existingAgent.id] = deployedAgent;
    await this.saveData();
    return deployedAgent;
  }

  /**
   * Déploie un nouvel agent (première fois)
   */
  private async deployNewAgent(agent: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'>): Promise<AgentRegistration> {
    const agentId = this.generateId('agent');
    const now = new Date().toISOString();
    
    const newAgent: AgentRegistration = {
      ...agent,
      id: agentId,
      deployment_version: agent.deployment_version || 1, // Premier déploiement = version 1
      created_at: now,        // Date de première création
      updated_at: now,
      deployed_at: now,       // Date de déploiement
      metadata: {
        ...agent.metadata,
        needs_deployment: false // Nouvellement déployé
      }
    };

    this.data.agents[agentId] = newAgent;

    // Mettre à jour le compteur d'agents de l'application
    await this.updateApplicationAgentCount(agent.application_id);

    await this.saveData();
    return newAgent;
  }

  /**
   * Redéploie un agent existant (incrémente la version)
   */
  private async deployExistingAgent(
    existingAgent: AgentRegistration, 
    updates: Omit<AgentRegistration, 'id' | 'created_at' | 'updated_at' | 'deployed_at'>
  ): Promise<AgentRegistration> {
    const now = new Date().toISOString();
    
    const updatedAgent: AgentRegistration = {
      ...existingAgent,
      ...updates,
      deployment_version: (existingAgent.deployment_version || 1) + 1, // Incrémenter la version
      updated_at: now,
      deployed_at: now,       // Nouvelle date de déploiement
      // created_at reste inchangé (date du premier déploiement)
      metadata: {
        ...existingAgent.metadata,
        ...updates.metadata,
        needs_deployment: false // Vient d'être déployé
      }
    };

    this.data.agents[existingAgent.id] = updatedAgent;
    await this.saveData();
    return updatedAgent;
  }

  /**
   * Met à jour le compteur d'agents d'une application
   */
  private async updateApplicationAgentCount(applicationId: string): Promise<void> {
    const appAgents = await this.getApplicationAgents(applicationId);
    const application = this.data.applications[applicationId];
    if (application) {
      application.agents_count = appAgents.length;
    }
  }

  async getRegisteredAgents(filter?: { 
    status?: 'active' | 'inactive' | 'error' | 'reloading';
    application_id?: string;
  }): Promise<AgentRegistration[]> {
    await this.ensureInitialized();
    
    let agents = Object.values(this.data.agents);
    
    if (filter?.status) {
      agents = agents.filter(agent => agent.status === filter.status);
    }
    
    if (filter?.application_id) {
      agents = agents.filter(agent => agent.application_id === filter.application_id);
    }
    
    return agents;
  }

  async getAgent(agentId: string): Promise<AgentRegistration | null> {
    await this.ensureInitialized();
    return this.data.agents[agentId] || null;
  }

  async getAgentByType(agentType: string): Promise<AgentRegistration | null> {
    await this.ensureInitialized();
    
    const agents = Object.values(this.data.agents);
    return agents.find(agent => agent.type === agentType) || null;
  }

  async removeAgent(agentId: string): Promise<void> {
    await this.ensureInitialized();
    
    const agent = this.data.agents[agentId];
    if (!agent) return;

    delete this.data.agents[agentId];

    // Mettre à jour le compteur d'agents de l'application
    const appAgents = await this.getApplicationAgents(agent.application_id);
    const application = this.data.applications[agent.application_id];
    if (application) {
      application.agents_count = appAgents.length;
    }

    await this.saveData();
  }

  async updateAgentStatus(
    agentId: string, 
    status: 'active' | 'inactive' | 'error' | 'reloading',
    errorMessage?: string
  ): Promise<void> {
    await this.ensureInitialized();
    
    const agent = this.data.agents[agentId];
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = status;
    agent.updated_at = new Date().toISOString();
    
    if (errorMessage) {
      agent.error_message = errorMessage;
    } else {
      delete agent.error_message;
    }

    await this.saveData();
  }

  /**
   * Marque un agent comme ayant besoin d'être redéployé
   * (utilisé quand on détecte un changement dans le code source)
   */
  async markAgentForDeployment(agentType: string, sourceHash: string): Promise<void> {
    await this.ensureInitialized();
    
    const agent = await this.getAgentByType(agentType);
    if (!agent) {
      throw new Error(`Agent ${agentType} not found`);
    }

    // Mettre à jour le hash du code source en développement
    agent.metadata = {
      ...agent.metadata,
      dev_source_hash: sourceHash,
      needs_deployment: agent.metadata.source_hash !== sourceHash
    };
    agent.updated_at = new Date().toISOString();

    this.data.agents[agent.id] = agent;
    await this.saveData();
  }

  /**
   * Récupère les agents qui ont besoin d'être redéployés
   */
  async getAgentsNeedingDeployment(applicationId?: string): Promise<AgentRegistration[]> {
    await this.ensureInitialized();
    
    let agents = Object.values(this.data.agents);
    
    if (applicationId) {
      agents = agents.filter(agent => agent.application_id === applicationId);
    }
    
    return agents.filter(agent => agent.metadata.needs_deployment === true);
  }

  /**
   * Récupère le statut de déploiement d'un agent spécifique
   */
  async getAgentDeploymentStatus(agentType: string): Promise<{
    agent_type: string;
    current_version: number;
    current_git_commit_id?: string;
    needs_deployment: boolean;
    last_deployed_at: string;
    active_sessions: number;
  } | null> {
    await this.ensureInitialized();
    
    const agent = await this.getAgentByType(agentType);
    if (!agent) {
      return null;
    }

    // Compter les sessions actives pour cet agent
    const activeSessions = Object.values(this.data.sessions)
      .filter(session => 
        session.agent_directeur_type === agentType && 
        session.status === 'active'
      ).length;

    return {
      agent_type: agentType,
      current_version: agent.deployment_version || 1,
      current_git_commit_id: agent.git_commit_id,
      needs_deployment: agent.metadata.needs_deployment || false,
      last_deployed_at: agent.deployed_at,
      active_sessions: activeSessions
    };
  }

  // ==========================================
  // Méthodes utilitaires
  // ==========================================

  async getHealthStatus(): Promise<{
    status: 'ok' | 'error';
    total_applications: number;
    total_agents: number;
    active_agents: number;
    total_sessions: number;
    active_sessions: number;
    storage_size?: number;
    last_cleanup?: string;
  }> {
    await this.ensureInitialized();
    
    try {
      const stats = await fs.stat(this.dbFile);
      const storageSize = stats.size;
      
      const applications = Object.values(this.data.applications);
      const agents = Object.values(this.data.agents);
      const sessions = Object.values(this.data.sessions);
      
      return {
        status: 'ok',
        total_applications: applications.length,
        total_agents: agents.length,
        active_agents: agents.filter(agent => agent.status === 'active').length,
        total_sessions: sessions.length,
        active_sessions: sessions.filter(session => session.status === 'active').length,
        storage_size: storageSize,
        last_cleanup: this.data.metadata.last_cleanup
      };
    } catch (error) {
      return {
        status: 'error',
        total_applications: 0,
        total_agents: 0,
        active_agents: 0,
        total_sessions: 0,
        active_sessions: 0,
        last_cleanup: this.data.metadata.last_cleanup
      };
    }
  }

  // ====== MÉTHODES UTILITAIRES PRIVÉES ======

  /**
   * Génère un ID unique pour une session
   * Format: sess_{app}_{timestamp}_{random}
   */
  private generateSessionId(agentType: string): string {
    const app = agentType.split('/')[0] || 'unknown';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    
    return `sess_${app}_${timestamp}_${random}`;
  }
} 