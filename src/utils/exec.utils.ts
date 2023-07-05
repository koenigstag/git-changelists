import { ExecException, exec, execSync } from 'child_process';

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
          console.error(stderr.toString());
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
