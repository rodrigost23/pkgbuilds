import { isObject } from '../util'

const githubType = 'github'
type PkgType = typeof githubType

export interface GitHubPkg {
  type: typeof githubType
  repo: string
  tag_regex?: string
  use_tags?: boolean
}

export type IPackageConfig = GitHubPkg

export class PackageConfig implements IPackageConfig {
  private constructor(
    readonly type: PkgType,
    readonly repo: string,
    readonly tag_regex?: string,
    readonly use_tags?: boolean
  ) {}

  /**
   * Checks if the given object is a valid {@link IPackageConfig}.
   *
   * @param obj - The object to check
   * @returns True if obj is a valid {@link IPackageConfig}, `false` otherwise
   */
  static isValidConfig(obj: unknown): obj is IPackageConfig {
    if (!isObject(obj)) {
      return false
    }

    return (
      obj?.type === githubType &&
      typeof obj?.repo === 'string' &&
      (obj?.use_tags === undefined || typeof obj?.use_tags === 'boolean')
    )
  }

  /**
   * Parses the given JSON string as a {@link PackageConfig} config object.
   *
   * @param input - The JSON string to parse
   * @returns The parsed {@link PackageConfig} object if valid, throws if invalid
   */
  static read(input: string): PackageConfig {
    const config = JSON.parse(input)
    if (this.isValidConfig(config)) {
      return new PackageConfig(
        config.type,
        config.repo,
        config.tag_regex,
        config.use_tags
      )
    }

    throw new Error('Invalid config')
  }
}
