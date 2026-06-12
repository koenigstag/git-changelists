import {
  GitCommandNamesEnum,
  GitCommandsEnum,
} from '../enum/git-commands.enum';
import { childExecAsync, childExecSync } from '../utils/exec.utils';
import { logger } from '../core/logger';

export class GitCommandsManager {
  static [GitCommandNamesEnum.add](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.add].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.addForce](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.addForce].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.assumeUnchanged](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.assumeUnchanged].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.noAssumeUnchanged](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.noAssumeUnchanged].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.skipWorktree](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.skipWorktree].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.noSkipWorktree](...files: string[]): string[] {
    return [...GitCommandsEnum[GitCommandNamesEnum.noSkipWorktree].split(' '), '--', ...files];
  }

  static [GitCommandNamesEnum.checkInitialized](): string[] {
    return GitCommandsEnum[GitCommandNamesEnum.checkInitialized].split(' ');
  }

  static [GitCommandNamesEnum.status](): string[] {
    return GitCommandsEnum[GitCommandNamesEnum.status].split(' ');
  }

  static async execAsync(
    command: GitCommandNamesEnum,
    cwd?: string,
    ...args: string[]
  ) {
    return childExecAsync('git', this.gitCommand(command, ...args), { cwd });
  }

  static exec(command: GitCommandNamesEnum, cwd?: string, ...args: string[]) {
    return childExecSync('git', this.gitCommand(command, ...args), { cwd });
  }

  static async tryExecAsyncGitCommand(
    command: GitCommandNamesEnum,
    cwd: string | undefined,
    ...args: string[]
  ): Promise<{
    succeeded: boolean;
    result?: string;
    error?: Error;
  }> {
    const printableArgv = this.gitCommand(command, ...args)
      .map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
      .join(' ');
    logger.appendLine('Executing command: git ' + printableArgv);

    if (command === GitCommandNamesEnum.assumeUnchanged) {
      return {
        succeeded: false,
        result: 'deprecated',
      }
    }

    try {
      const stdout = await this.execAsync(command, cwd, ...args);

      logger.appendLine(command + ' success: true; ' + stdout);

      return { succeeded: true, result: stdout };
    } catch (err: unknown) {
      const error = err as Error;
      logger.appendLine(
        command + ' success: false; ' + error.message
      );

      return { succeeded: false, error };
    }
  }

  private static gitCommand(
    command: GitCommandNamesEnum,
    ...args: string[]
  ): string[] {
    if (!(this as any)[command]) {
      throw new Error(`Git command ${command} not found`);
    }

    return (this as any)[command]?.(...args);
  }
}
