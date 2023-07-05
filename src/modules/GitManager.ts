import { execSync } from 'child_process';
import { WorkspaceManager } from './WorkspaceManager';
import { addGitToPath } from '../utils/string.utils';

export class GitManager {
  static isGitInitialized(path?: string) {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        encoding: 'utf-8',
        cwd: path,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  static getLegacyGitRepoPath(workspaceRootPath?: string): string {
    if (workspaceRootPath && WorkspaceManager.isWorkspaceTrusted) {
      return addGitToPath(workspaceRootPath);
    }

    return addGitToPath('');
  }

  static findGitRepoFoldersRecursively(path: string, depth = 3): string[] {
    return [];
  }

  static findGitRepos(path: string): string[] {
    const probablyGitRepos = this.findGitRepoFoldersRecursively(path);

    const gitRepos = probablyGitRepos.filter((repo) =>
      this.isGitInitialized(repo)
    );

    return gitRepos;
  }
}
