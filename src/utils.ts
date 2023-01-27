import { exec } from 'child_process';

import { newLineRegex, pathDelim } from "./constants/regexp";

export const getRelativeExcludePath = (prefix: string) => {
  return `${prefix}/info/exclude`;
};

export const contentToLines = (content: string) => {
  return content.split(newLineRegex);
};

export const linesToText = (lines: string[] = []) => {
  return lines.join('\n');
};

export const transformPath = (path: string) => {
  return path.replace(pathDelim, '/');
};

export const childExecAsync = (command: string, cwd?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, { cwd, encoding: 'utf-8' }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        console.error(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
};
