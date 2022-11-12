import { newLineRegex, pathDelim } from "./constants/regexp";

export const contentToLines = (content: string) => {
  return content.split(newLineRegex);
};

export const linesToText = (lines: string[] = []) => {
  return lines.join('\n');
};

export const transformPath = (path: string) => {
  return path.replace(pathDelim, '/');
};
