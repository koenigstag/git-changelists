import { WorkspaceManager } from './WorkspaceManager';
import { addGitToPath } from '../utils/string.utils';
import { GitApiService } from './GitApiService';

export class GitManager {
  static isGitInitialized(path?: string): boolean {
    return GitApiService.hasRepository(path);
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
