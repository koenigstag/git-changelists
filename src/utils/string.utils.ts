import { resolve } from 'path';
import { newLineRegex, pathDelim } from '../constants/regexp';

export const randomString = (length: number) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

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

export const addGitToPath = (path?: string) => {
  return resolve(path ?? '', '.git');
};
