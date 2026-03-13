class Utils {
  constructor() { }

  public static sum(a: number, b: number): number {
    return a + b;
  }

  public static substract(a: number, b: number): number {
    return a - b;
  }

  public static omit<T extends object, K extends keyof T>(
    obj: T,
    ...keys: K[]
  ): Omit<T, K> {
    return Object.fromEntries(
      Object.entries(obj).filter(([k]) => !keys.includes(k as K))
    ) as Omit<T, K>;
  }
}

export default Utils;
