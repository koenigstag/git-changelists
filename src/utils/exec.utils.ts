import { exec, execSync } from 'child_process';
import { logger } from '../core/logger';

export const childExecAsync = (
  command: string,
  options: { cwd?: string; encoding?: BufferEncoding } = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd: options.cwd, encoding: options.encoding || 'utf-8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          logger.appendLine(`[ERR] Error when executing command '${command}':  ${stderr.toString()}`);
        } else {
          resolve(stdout.toString());
        }
      }
    );
  });
};

export const childExecSync = (
  command: string,
  options: {
    cwd?: string;
    encoding?: BufferEncoding;
  } = {}
): string => {
  const stdout = execSync(command, {
    cwd: options.cwd,
    encoding: options.encoding || 'utf-8',
  });

  return stdout.toString();
};
