import { isObject } from '../util'

const githubType = 'github'
type PkgType = typeof githubType

export interface GitHubPkg {
  type: typeof githubType
  repo: string
}

type IPkgConfig = GitHubPkg

export class PkgConfig implements IPkgConfig {
  private constructor(
    readonly type: PkgType,
    readonly repo: string
  ) {}

  /**
   * Checks if the given object is a valid {@link IPkgConfig}.
   *
   * @param obj - The object to check
   * @returns True if obj is a valid {@link IPkgConfig}, `false` otherwise
   */
  private static isValidConfig(obj: unknown): obj is IPkgConfig {
    if (!isObject(obj)) {
      return false
    }

    return obj?.type === githubType && typeof obj?.repo === 'string'
  }

  /**
   * Parses the given JSON string as a {@link PkgConfig} config object.
   *
   * @param input - The JSON string to parse
   * @returns The parsed {@link PkgConfig} object if valid, throws if invalid
   */
  static read(input: string): PkgConfig {
    const config = JSON.parse(input)
    if (this.isValidConfig(config)) {
      return config
    }

    throw new Error('Invalid config')
  }
}
