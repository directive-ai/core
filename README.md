# @directive/core

Orchestrateur d'agents IA pour gérer les conversations structurées et les sessions d'agents directeurs.

## Installation

### Installation globale (utilisateur final)
```bash
npm install -g @directive/core
directive --version
```

### Installation depuis les sources (développement)
```bash
git clone <repository>
cd core
npm install
npm run dev:cli
directive --version
```

## Développement

### 🛠 Workflow de développement CLI

Après avoir modifié le code dans `src/cli/`, vous avez **3 méthodes** pour tester sans réinstallation :

#### ⚡ **Méthode rapide** (test immédiat)
```bash
npm run cli -- --version
npm run cli -- test
npm run cli -- --help
```

#### 🚀 **Méthode recommandée** (test comme utilisateur final)
```bash
npm run dev:cli          # Rebuild + link automatiquement
directive --version      # Tester globalement
directive test          # Tester les commandes
```

#### 📦 **Méthode de distribution** (avant publication)
```bash
npm run package:global   # Package complet + installation globale
directive --version      # Test final
```

### 📋 Scripts NPM disponibles

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run cli` | Test direct sans installation | Développement rapide |
| `npm run dev:cli` | Rebuild + link global | Test d'intégration |
| `npm run build:cli` | Compilation CLI uniquement | Build manuel |
| `npm run package` | Création du .tgz | Packaging |
| `npm run package:global` | Package + installation globale | Distribution |
| `npm run unlink` | Supprimer le lien global | Nettoyage |
| `npm run test:cli` | Tests de la CLI uniquement | Validation CLI |

### 🔄 Workflow recommandé

1. **Modifier** le code dans `src/cli/`
2. **Tester rapidement** : `npm run cli -- test`
3. **Si OK, mettre à jour globalement** : `npm run dev:cli`
4. **Tester comme utilisateur final** : `directive test`

## Structure du projet

```
src/
├── core/                 # Noyau Directive
│   ├── session-broker/   # Orchestrateur de sessions
│   ├── agent-factory/    # Factory des agents directeurs
│   └── agent-engine/     # Moteur XState
├── interfaces/           # Interfaces abstraites
├── implementations/      # Implémentations concrètes
├── api/                  # Contrôleurs REST
├── dto/                  # Data Transfer Objects
└── cli/                  # Interface en ligne de commande
    ├── commands/         # Commandes CLI
    ├── templates/        # Templates de génération
    └── utils/            # Utilitaires CLI
```

## CLI

La CLI Directive permet de gérer les projets et agents :

```bash
directive --version       # Version
directive --help         # Aide
directive test           # Test de fonctionnement
```

*Note : Plus de commandes seront ajoutées dans les phases suivantes du développement.*

## Développement serveur

```bash
npm run dev              # Serveur en mode développement
npm run build           # Build production
npm run start           # Démarrer en production
npm test                # Tests
```

## Tests

### 🧪 Tests disponibles

```bash
npm test                 # Tous les tests
npm run test:cli         # Tests CLI uniquement
npm run test:watch       # Tests en mode watch
npm run test:cov         # Tests avec couverture de code
```

### Tests CLI

Le projet inclut des tests automatisés pour la CLI :

- ✅ **`directive --version`** : Vérifie que la version est retournée correctement
- ✅ **`directive --help`** : Vérifie que l'aide s'affiche avec les bonnes informations
- ✅ **`directive test`** : Vérifie que la commande de test fonctionne
- ✅ **Codes de sortie** : Vérifie que les commandes se terminent avec le bon exit code

**Fallback automatique** : Si la commande globale `directive` n'est pas disponible, les tests utilisent automatiquement `npm run cli` comme fallback.

## Configuration

- **TypeScript** : Configuration avec chemins absolus (@/core, @/interfaces, etc.)
- **Nest.js** : Framework backend avec support CLI
- **Commander.js** : Interface en ligne de commande
- **Chalk** : Messages colorés dans la CLI
