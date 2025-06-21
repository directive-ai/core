import { execSync } from 'child_process';
import { GitCommitStrategy } from '../../dto/index';

/**
 * Récupère l'ID du commit Git actuel
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns ID du commit Git ou undefined si non disponible
 */
export function getCurrentGitCommitId(workingDirectory?: string): string | undefined {
  try {
    const cwd = workingDirectory || process.cwd();
    
    // Exécuter git rev-parse HEAD pour obtenir le commit actuel
    const commitId = execSync('git rev-parse HEAD', { 
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] // Ignorer stderr pour éviter les erreurs
    }).trim();
    
    // Vérifier que c'est bien un hash Git (40 caractères hexadécimaux)
    if (commitId && /^[a-f0-9]{40}$/i.test(commitId)) {
      return commitId;
    }
    
    return undefined;
  } catch (error) {
    // Git n'est pas disponible ou pas dans un repo Git
    return undefined;
  }
}

/**
 * Récupère l'ID du commit Git actuel (version courte)
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns ID du commit Git court (7 caractères) ou undefined si non disponible
 */
export function getCurrentGitCommitIdShort(workingDirectory?: string): string | undefined {
  try {
    const cwd = workingDirectory || process.cwd();
    
    // Exécuter git rev-parse --short HEAD pour obtenir le commit court
    const commitId = execSync('git rev-parse --short HEAD', { 
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    // Vérifier que c'est bien un hash Git court (7+ caractères hexadécimaux)
    if (commitId && /^[a-f0-9]{7,}$/i.test(commitId)) {
      return commitId;
    }
    
    return undefined;
  } catch (error) {
    // Git n'est pas disponible ou pas dans un repo Git
    return undefined;
  }
}

/**
 * Vérifie si on est dans un repository Git
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns true si on est dans un repo Git
 */
export function isGitRepository(workingDirectory?: string): boolean {
  try {
    const cwd = workingDirectory || process.cwd();
    
    execSync('git rev-parse --git-dir', { 
      cwd,
      stdio: ['ignore', 'ignore', 'ignore']
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Récupère des informations complètes sur le commit Git actuel
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns Informations sur le commit ou undefined si non disponible
 */
export function getCurrentGitCommitInfo(workingDirectory?: string): {
  full_id: string;
  short_id: string;
  author: string;
  date: string;
  message: string;
} | undefined {
  try {
    const cwd = workingDirectory || process.cwd();
    
    // Format: full_hash|short_hash|author|date|message
    const commitInfo = execSync('git log -1 --format="%H|%h|%an|%ai|%s"', { 
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    const [full_id, short_id, author, date, message] = commitInfo.split('|');
    
    return {
      full_id,
      short_id,
      author,
      date,
      message
    };
  } catch (error) {
    return undefined;
  }
}

/**
 * Vérifie s'il y a des modifications non commitées dans le répertoire de travail
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns true s'il y a des modifications non commitées
 */
export function hasUncommittedChanges(workingDirectory?: string): boolean {
  try {
    const cwd = workingDirectory || process.cwd();
    
    // git status --porcelain retourne une ligne par fichier modifié
    const status = execSync('git status --porcelain', { 
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    return status.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Récupère le statut détaillé du répertoire de travail Git
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns Statut détaillé ou undefined si non disponible
 */
export function getWorkingDirectoryStatus(workingDirectory?: string): {
  is_clean: boolean;
  modified_files: string[];
  staged_files: string[];
  untracked_files: string[];
} | undefined {
  try {
    const cwd = workingDirectory || process.cwd();
    
    const status = execSync('git status --porcelain', { 
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    const modified_files: string[] = [];
    const staged_files: string[] = [];
    const untracked_files: string[] = [];
    
    if (status) {
      const lines = status.split('\n');
      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const filename = line.substring(3);
        
        if (statusCode.startsWith('M') || statusCode.endsWith('M')) {
          modified_files.push(filename);
        }
        if (statusCode.startsWith('A') || statusCode.startsWith('M') || statusCode.startsWith('D')) {
          staged_files.push(filename);
        }
        if (statusCode.startsWith('??')) {
          untracked_files.push(filename);
        }
      }
    }
    
    return {
      is_clean: status.length === 0,
      modified_files,
      staged_files,
      untracked_files
    };
  } catch (error) {
    return undefined;
  }
}

/**
 * Fait un commit automatique des modifications en cours
 * @param message Message de commit
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @param addAll Si true, ajoute tous les fichiers modifiés (défaut: false)
 * @returns ID du commit créé ou undefined si échec
 */
export function commitChanges(
  message: string,
  workingDirectory?: string,
  addAll: boolean = false
): string | undefined {
  try {
    const cwd = workingDirectory || process.cwd();
    
    // Optionnellement ajouter tous les fichiers modifiés
    if (addAll) {
      execSync('git add -A', { 
        cwd,
        stdio: ['ignore', 'ignore', 'ignore']
      });
    }
    
    // Faire le commit
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { 
      cwd,
      stdio: ['ignore', 'ignore', 'ignore']
    });
    
    // Récupérer l'ID du commit créé
    return getCurrentGitCommitId(workingDirectory);
  } catch (error) {
    return undefined;
  }
}



/**
 * Interface pour le résultat de la vérification Git
 */
export interface GitCommitResult {
  success: boolean;
  commit_id?: string;
  strategy_used: GitCommitStrategy;
  was_dirty: boolean;
  committed_files?: string[];
  message?: string;
  error?: string;
}

/**
 * S'assure que le code est committé selon la stratégie choisie
 * @param strategy Stratégie à utiliser pour gérer les modifications non commitées
 * @param commitMessage Message de commit si auto-commit (défaut: généré automatiquement)
 * @param workingDirectory Répertoire de travail (défaut: process.cwd())
 * @returns Résultat avec l'ID du commit correspondant au code
 */
export function ensureCommitted(
  strategy: GitCommitStrategy = 'strict',
  commitMessage?: string,
  workingDirectory?: string
): GitCommitResult {
  const cwd = workingDirectory || process.cwd();
  
  // Vérifier si on est dans un repo Git
  if (!isGitRepository(cwd)) {
    return {
      success: true,
      strategy_used: strategy,
      was_dirty: false,
      message: 'Not in a Git repository'
    };
  }
  
  // Vérifier le statut du répertoire de travail
  const status = getWorkingDirectoryStatus(cwd);
  if (!status) {
    return {
      success: false,
      strategy_used: strategy,
      was_dirty: false,
      error: 'Could not get working directory status'
    };
  }
  
  const isDirty = !status.is_clean;
  
  // Si le répertoire est propre, récupérer simplement le commit actuel
  if (!isDirty) {
    const commitId = getCurrentGitCommitId(cwd);
    return {
      success: true,
      commit_id: commitId,
      strategy_used: strategy,
      was_dirty: false,
      message: 'Working directory is clean'
    };
  }
  
  // Gérer selon la stratégie choisie
  switch (strategy) {
    case 'strict':
      return {
        success: false,
        strategy_used: strategy,
        was_dirty: true,
        error: `Working directory has uncommitted changes. Please commit or stash them before deployment. Modified files: ${status.modified_files.join(', ')}`
      };
      
    case 'auto-commit':
      const autoCommitMessage = commitMessage || `Auto-commit for agent deployment at ${new Date().toISOString()}`;
      const commitId = commitChanges(autoCommitMessage, cwd, true);
      
      if (commitId) {
        return {
          success: true,
          commit_id: commitId,
          strategy_used: strategy,
          was_dirty: true,
          committed_files: [...status.modified_files, ...status.untracked_files],
          message: `Auto-committed ${status.modified_files.length + status.untracked_files.length} files`
        };
      } else {
        return {
          success: false,
          strategy_used: strategy,
          was_dirty: true,
          error: 'Failed to auto-commit changes'
        };
      }
      
    case 'warn':
      const warnCommitId = getCurrentGitCommitId(cwd);
      return {
        success: true,
        commit_id: warnCommitId,
        strategy_used: strategy,
        was_dirty: true,
        message: `Warning: Working directory has uncommitted changes. Deployed commit may not match exact code. Modified files: ${status.modified_files.join(', ')}`
      };
      
    case 'ignore':
      const ignoreCommitId = getCurrentGitCommitId(cwd);
      return {
        success: true,
        commit_id: ignoreCommitId,
        strategy_used: strategy,
        was_dirty: true,
        message: 'Uncommitted changes ignored'
      };
      
    default:
      return {
        success: false,
        strategy_used: strategy,
        was_dirty: true,
        error: `Unknown strategy: ${strategy}`
      };
  }
} 