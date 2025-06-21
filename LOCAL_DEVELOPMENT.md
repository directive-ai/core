# Développement Local avec Directive

Ce guide explique comment utiliser Directive en mode développement local avant la publication officielle sur npm.

## 🎯 Problème

Quand vous utilisez `directive init`, le template essaie d'installer `@directive/core` depuis npm, mais ce package n'est pas encore publié. L'installation échoue donc.

## ✅ Solution : Option `--local`

Une option `--local` a été ajoutée à `directive init` pour utiliser une version locale du package.

## 📋 Instructions

### 1. Préparer le tarball local

Dans le répertoire `/core` de Directive :

```bash
# Compiler le projet
npm run build:cli

# Créer le tarball local
npm pack
```

Cela génère `directive-core-1.0.0.tgz`.

### 2. Copier le tarball là où vous voulez créer votre projet

```bash
# Exemple : créer un projet dans /tmp
cd /tmp
cp /path/to/directive/core/directive-core-1.0.0.tgz ./
```

### 3. Utiliser directive init avec --local

```bash
# Créer un nouveau projet avec la version locale
node /path/to/directive/core/dist/cli/index.js init mon-projet --local --skip-install

# Ou avec les options complètes
node /path/to/directive/core/dist/cli/index.js init mon-projet \
  --local \
  --author "Votre Nom" \
  --description "Mon projet Directive" \
  --database json \
  --skip-install
```

### 4. Installer les dépendances

```bash
cd mon-projet
npm install
```

## 🔍 Vérification

Vérifiez que le package local est bien installé :

```bash
# Vérifier que @directive/core est installé
ls node_modules/@directive/core

# Vérifier que le CLI fonctionne
node node_modules/@directive/core/dist/cli/index.js --help

# Créer une application de test
node node_modules/@directive/core/dist/cli/index.js create app test-app \
  --author "Test" --description "Application de test"
```

## 🚀 Workflow complet de développement

```bash
# 1. Dans le répertoire directive/core
cd /path/to/directive/core
npm run build:cli
npm pack

# 2. Dans le répertoire où vous voulez développer
cd /path/to/development
cp /path/to/directive/core/directive-core-1.0.0.tgz ./

# 3. Créer le projet
node /path/to/directive/core/dist/cli/index.js init mon-projet-agents \
  --local \
  --author "Mon Nom" \
  --description "Mes agents Directive" \
  --skip-install

# 4. Installer et développer
cd mon-projet-agents
npm install
node node_modules/@directive/core/dist/cli/index.js create app myapp
node node_modules/@directive/core/dist/cli/index.js create agent --app myapp --name workflow

# 5. Compiler et déployer
npm run build:agent myapp/workflow
node node_modules/@directive/core/dist/cli/index.js deploy agent myapp/workflow
```

## ⚡ Alternatives plus simples

### Option A : npm link (lien symbolique global)

```bash
# Dans directive/core
npm link

# Dans votre projet
npm link @directive/core
```

### Option B : Installation directe depuis le répertoire

```bash
# Dans votre package.json
{
  "devDependencies": {
    "@directive/core": "file:../path/to/directive/core"
  }
}
```

## 🔧 Dépannage

### Erreur "Local tarball not found"
- Vérifiez que `directive-core-1.0.0.tgz` est dans le répertoire courant
- Recréez le tarball avec `npm pack` dans directive/core

### Erreur lors de l'installation
- Vérifiez que toutes les dépendances sont à jour dans directive/core
- Reconstruisez avec `npm run build:cli` avant `npm pack`

### Problèmes d'imports
- Notre resolver Jest gère automatiquement les imports `.js` vers `.ts`
- En cas de problème, recompilez avec `npm run build:cli`

## 📝 Notes importantes

- L'option `--local` n'est nécessaire qu'en développement
- Une fois Directive publié sur npm, utilisez `directive init` normalement
- Le tarball local contient la version compilée complète du package 