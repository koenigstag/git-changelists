import { IOptions, glob } from 'glob';

export const globAsync = async (
  pattern: string,
  options: IOptions
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (err, matches) => {
      if (err) {
        reject(err);
      }

      resolve(matches);
    });
  });
};
