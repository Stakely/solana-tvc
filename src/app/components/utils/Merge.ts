export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  const output = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object'
    ) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== undefined) {
      output[key] = sourceValue as T[Extract<keyof T, string>];
    }
  }

  return output;
}
