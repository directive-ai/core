# CLI - Interface en Ligne de Commande

Ce répertoire contient l'implémentation de la CLI Directive utilisant Commander.js.

## Structure

- **index.ts** : Point d'entrée principal de la CLI
- **commands/** : Implémentations des commandes CLI
  - `init.ts` : Commande `directive init`
  - `create.ts` : Commande `directive create app`
  - `agent.ts` : Commandes agent (create, register, reload, list, status, remove)
  - `start.ts` : Commande `directive start`
- **templates/** : Templates pour la génération de code
- **utils/** : Utilitaires CLI
  - `project-scanner.ts` : Scan automatique des agents
  - `file-generator.ts` : Génération de fichiers

## Commandes disponibles

```bash
directive init <project-name>           # Initialise un nouveau projet
directive create app <app-name>         # Crée une nouvelle application
directive agent create <name>           # Crée un nouvel agent
directive agent list                    # Liste les agents
directive start                         # Lance le serveur
```

## Fonctionnalités

- Génération de projets et d'agents
- Scan automatique des agents en mode production
- Interface interactive avec inquirer
- Messages colorés avec chalk 