import { describe, test, expect } from '@jest/globals';
import { 
  getCurrentGitCommitId, 
  isGitRepository,
  ensureCommitted
} from '../src/core/agent-factory/git-utils';

describe('Git Utils', () => {
  describe('Basic Git Operations', () => {
    test('should detect if we are in a git repository', () => {
      // Ce test s'exécute dans le répertoire core/ qui est un repo Git
      const isRepo = isGitRepository();
      expect(typeof isRepo).toBe('boolean');
      
      // Si on est dans un repo Git, on devrait pouvoir récupérer le commit ID
      if (isRepo) {
        const commitId = getCurrentGitCommitId();
        expect(commitId).toBeDefined();
        expect(commitId).toMatch(/^[a-f0-9]{40}$/i);
      }
    });
  });

  describe('Ensure Committed - Strict Strategy', () => {
    test('should succeed or fail based on working directory state', () => {
      const result = ensureCommitted('strict');
      
      expect(result).toBeDefined();
      expect(result.strategy_used).toBe('strict');
      expect(typeof result.was_dirty).toBe('boolean');
      
      if (result.success) {
        // Répertoire Git propre ou pas de Git
        expect(result.was_dirty).toBe(false);
        expect(result.commit_id).toBeDefined();
        expect(result.message).toMatch(/Working directory is clean|Not in a Git repository/);
      } else {
        // Répertoire Git avec des modifications non commitées
        expect(result.was_dirty).toBe(true);
        expect(result.error).toContain('Working directory has uncommitted changes');
        expect(result.error).toContain('Please commit or stash them before deployment');
      }
    });

    test('should handle non-git directory gracefully', () => {
      // Tester avec un répertoire qui n'est certainement pas un repo Git
      const result = ensureCommitted('strict', undefined, '/tmp');
      
      expect(result.success).toBe(true);
      expect(result.strategy_used).toBe('strict');
      expect(result.was_dirty).toBe(false);
      expect(result.message).toBe('Not in a Git repository');
    });

    test('should provide detailed error message for dirty directory', () => {
      const result = ensureCommitted('strict');
      
      // Ce test ne peut être déterministe car il dépend de l'état réel du repo
      // Mais on peut au moins vérifier la structure de la réponse
      expect(result).toBeDefined();
      expect(result.strategy_used).toBe('strict');
      
      if (!result.success && result.was_dirty) {
        expect(result.error).toContain('Working directory has uncommitted changes');
        expect(result.error).toContain('Modified files:');
      }
    });
  });
}); 