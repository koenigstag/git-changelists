import * as vscode from 'vscode';
import * as path from 'path';
import { API, GitExtension, Repository, Status } from '../api/git';
import { logger } from '../core/logger';

// bounded wait so activation never blocks forever when no repo has opened yet
const REPO_READY_TIMEOUT_MS = 5000;

export class GitApiService {
  private static api: API | null = null;

  static async initialize(): Promise<boolean> {
    try {
      const extension =
        vscode.extensions.getExtension<GitExtension>('vscode.git');
      if (!extension) {
        logger.appendLine('[GitApi] vscode.git extension not found');
        return false;
      }

      const gitExtension = extension.isActive
        ? extension.exports
        : await extension.activate();

      if (!gitExtension.enabled) {
        logger.appendLine('[GitApi] git integration is disabled');
        return false;
      }

      this.api = gitExtension.getAPI(1);

      if (this.api.repositories.length === 0) {
        await this.waitForRepository(this.api);
      }

      return true;
    } catch (error) {
      logger.appendLine(`[GitApi] initialization failed: ${(error as Error).message}`);
      return false;
    }
  }

  private static waitForRepository(api: API): Promise<void> {
    return new Promise<void>((resolve) => {
      const disposable = api.onDidOpenRepository(() => {
        disposable.dispose();
        clearTimeout(timer);
        resolve();
      });
      const timer = setTimeout(() => {
        disposable.dispose();
        resolve();
      }, REPO_READY_TIMEOUT_MS);
    });
  }

  static getRepository(target?: vscode.Uri | string): Repository | null {
    if (!this.api) {
      return null;
    }
    if (target) {
      const uri = typeof target === 'string' ? vscode.Uri.file(target) : target;
      const repository = this.api.getRepository(uri);
      if (repository) {
        return repository;
      }
    }
    return this.api.repositories[0] ?? null;
  }

  static hasRepository(target?: vscode.Uri | string): boolean {
    return !!this.getRepository(target);
  }

  static isUntracked(filePath: string, target?: vscode.Uri | string): boolean {
    const repository = this.getRepository(target);
    if (!repository) {
      return false;
    }

    const normalized = filePath.split(path.sep).join('/').replace(/^\/+/, '');

    return repository.state.workingTreeChanges.some((change) => {
      if (change.status !== Status.UNTRACKED) {
        return false;
      }
      const relative = path
        .relative(repository.rootUri.fsPath, change.uri.fsPath)
        .split(path.sep)
        .join('/');
      return relative === normalized;
    });
  }
}
