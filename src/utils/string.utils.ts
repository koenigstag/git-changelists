import { resolve, basename, join } from 'path';
import { newLineRegex, pathDelim } from '../constants/regexp';

export const getUnixPath = (path: string): string => {
  return path.replace(/\\/g, '/');
};

export const getRelativeExcludePath = (prefix: string): string => {
  return getUnixPath(join(prefix, './info/exclude'));
};

export const contentToLines = (content: string): string[] => {
  return content.split(newLineRegex);
};

export const linesToText = (lines: string[] = []): string => {
  return lines.join('\n');
};

export const transformPath = (path: string): string => {
  return path.replace(pathDelim, '/');
};

export const addGitToPath = (path?: string): string => {
  return resolve(path ?? '', '.git');
};

export const removeGitFromPath = (path: string): string => {
  if (!path) {
    return path;
  }

  const base = basename(path);

  if (!base.includes('.git')) {
    return path;
  }

  return resolve(path, '..');
};
