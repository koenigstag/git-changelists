import { exec } from 'child_process';
import {
  GitCommandNamesEnum,
  GitCommandsEnum,
} from '../enum/git-commands.enum';
import { childExecAsync, childExecSync } from '../utils/exec.utils';
import { logger } from '../core/logger';

export class GitCommandsManager {
  static [GitCommandNamesEnum.add](...files: string[]) {
    return `${GitCommandsEnum[GitCommandNamesEnum.add]} ${files.join(' ')}`;
  }

  static [GitCommandNamesEnum.addForce](...files: string[]) {
    return `${GitCommandsEnum[GitCommandNamesEnum.addForce]} ${files.join(
      ' '
    )}`;
  }

  static [GitCommandNamesEnum.assumeUnchanged](...files: string[]) {
    return `${
      GitCommandsEnum[GitCommandNamesEnum.assumeUnchanged]
    } ${files.join(' ')}`;
  }

  static [GitCommandNamesEnum.noAssumeUnchanged](...files: string[]) {
    return `${
      GitCommandsEnum[GitCommandNamesEnum.noAssumeUnchanged]
    } ${files.join(' ')}`;
  }

  static [GitCommandNamesEnum.checkInitialized]() {
    return GitCommandsEnum[GitCommandNamesEnum.checkInitialized];
  }

  static [GitCommandNamesEnum.status]() {
    return GitCommandsEnum[GitCommandNamesEnum.status];
  }

  static async execAsync(
    command: GitCommandNamesEnum,
    cwd?: string,
    ...args: string[]
  ) {
    return childExecAsync(this.gitCommand(command, ...args), { cwd });
  }

  static exec(command: GitCommandNamesEnum, cwd?: string, ...args: string[]) {
    return childExecSync(this.gitCommand(command, ...args), { cwd });
  }

  static async tryExecAsyncGitCommand(
    command: GitCommandNamesEnum,
    cwd: string | undefined,
    ...args: string[]
  ) {
    logger.appendLine(
      'Executing command: ' + this.gitCommand(command, ...args)
    );

    try {
      const stdout = await this.execAsync(command, cwd, ...args);

      logger.appendLine(command + ' success: true; ' + stdout);

      return { succeeded: true, result: stdout };
    } catch (error: unknown) {
      logger.appendLine(
        command + ' success: false; ' + (error as Error).message
      );

      return { succeeded: false, error };
    }
  }

  private static gitCommand(
    command: GitCommandNamesEnum,
    ...args: string[]
  ): string {
    if (!(this as any)[command]) {
      throw new Error(`Git command ${command} not found`);
    }

    return `git ${(this as any)[command]?.(...args)}`;
  }
}
