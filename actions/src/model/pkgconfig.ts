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

  private static isValidConfig(obj: unknown): obj is IPkgConfig {
    if (!isObject(obj)) {
      return false
    }

    return obj?.type === githubType && typeof obj?.repo === 'string'
  }

  static read(input: string): GitHubPkg {
    const config = JSON.parse(input)
    if (this.isValidConfig(config)) {
      return config
    }

    throw new Error('Invalid config')
  }
}
