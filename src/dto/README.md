# DTO - Data Transfer Objects

Ce répertoire contient tous les types TypeScript utilisés pour les échanges de données dans Directive.

## Types principaux

### 📝 AgentResponse (`agent-response.dto.ts`)

Types pour la communication Agent Directeur → Agent Exécutant :

- **`AgentResponse`** : Réponse structurée de l'agent directeur
- **`ResponseFormat`** : Format attendu pour la réponse de l'agent exécutant
- **`AgentContext`** : Contexte et documents fournis avec la réponse
- **`AgentDocument`** : Document attaché (reference/template/validation/data)

```typescript
import { AgentResponse, ResponseFormat } from '@/dto';

const response: AgentResponse = {
  type: 'prompt',
  instruction: "Choisissez la direction pour le processus.",
  format: { type: 'choice', options: ['left', 'right'] },
  context: { documents: [], metadata: { step: 'direction' } }
};
```

### 🎯 Session (`session.dto.ts`)

Types pour la gestion des sessions :

- **`Session`** : Session complète avec historique et état
- **`SessionState`** : État actuel de la machine XState
- **`ConversationEntry`** : Entrée dans l'historique de conversation
- **`SessionStatus`** : Enum des statuts (active/completed/timeout/error)

```typescript
import { Session, SessionStatus } from '@/dto';

const session: Session = {
  session_id: "sess_testapp_001",
  agent_directeur_type: "testapp/simple-agent",
  created_at: "2024-01-15T10:30:00Z",
  status: SessionStatus.ACTIVE,
  current_state: {
    xstate_state: "initial",
    context: {},
    history: []
  },
  conversation_history: []
};
```

### 🌐 API (`api.dto.ts`)

Types pour les échanges REST API :

- **`CreateSessionRequest/Response`** : Création de sessions
- **`SessionEvent/Response`** : Envoi d'événements à une session
- **`RegisteredAgent`** : Informations d'agent directeur enregistré
- **`AgentMetadata`** : Métadonnées d'un agent
- **`HealthStatus`** : Statut de santé du serveur

```typescript
import { CreateSessionRequest, SessionEvent } from '@/dto';

// Création de session
const createRequest: CreateSessionRequest = {
  agent_type: "testapp/simple-agent",
  metadata: { source: "test" }
};

// Envoi d'événement
const event: SessionEvent = {
  event: "CHOOSE_LEFT",
  data: { reason: "Analyse préférentielle" }
};
```

## Usage dans le projet

### Imports centralisés

```typescript
// Import depuis l'index central
import { 
  AgentResponse, 
  Session, 
  SessionStatus,
  CreateSessionRequest 
} from '@/dto';
```

### Utilisation avec les interfaces

Ces types sont utilisés par :
- **Session Broker** : Gestion des sessions et historiques
- **Agent Factory** : Enregistrement et métadonnées des agents
- **API Controllers** : Validation des requêtes/réponses REST
- **Agent Engine** : Communication avec les machines XState

### Validation TypeScript

Tous les types sont strictement typés pour :
- ✅ **Type safety** : Détection d'erreurs à la compilation
- ✅ **IntelliSense** : Autocomplétion dans l'IDE
- ✅ **Documentation** : Types auto-documentés
- ✅ **Refactoring** : Modifications sûres du code

## Évolution

Ces types évolueront avec les phases du projet :
- **Phase 1** : Types de base (actuel)
- **Phase 2** : Types frontend et WebSocket
- **Phase 3** : Types RAG et IA
- **Phase 4** : Types A2A et orchestration 