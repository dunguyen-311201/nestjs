export const uncapitalize = <T extends string = string>(
  str: T,
): Uncapitalize<T> => {
  return (
    str.length ? str.charAt(0).toLowerCase() + str.slice(1) : str
  ) as Uncapitalize<T>
}
