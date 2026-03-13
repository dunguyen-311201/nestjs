/**
 * Makes a type nullable (allows null)
 */
export type Nullable<T> = T | null

/**
 * Makes a type emptyable (allows null or empty string)
 * Use this sparingly - typically only for form inputs where empty string is valid
 */
export type Emptyable<T> = null | '' | T

/**
 * Generic metadata parameter object for third-party services (e.g., Stripe)
 */
export interface MetadataParam {
  [name: string]: string | number | null
}
