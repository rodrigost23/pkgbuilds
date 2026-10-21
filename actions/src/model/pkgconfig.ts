import { isObject } from '../util'

const githubType = 'github'
type PkgType = typeof githubType

/**
 * Reads a file from the upstream repository at the new version's tag and
 * returns the first capture group of `regex`.
 */
export interface UpstreamFileVar {
  type: 'upstream_file'
  file: string
  regex: string
}

/**
 * Finds an asset of a release of the upstream repository and returns its
 * name, minus `strip` when given.
 */
export interface ReleaseAssetVar {
  type: 'release_asset'
  tag: string
  asset_regex: string
  strip?: string
}

/**
 * Resolver for a PKGBUILD variable derived from the upstream repository.
 * Strings can reference `{pkgver}`, `{tag}` and previously resolved variables
 * as `{name}`.
 */
export type VarResolver = UpstreamFileVar | ReleaseAssetVar

export interface GitHubPkg {
  type: typeof githubType
  repo: string
  tag_regex?: string
  use_tags?: boolean
  vars?: Record<string, VarResolver>
}

export type IPackageConfig = GitHubPkg

export class PackageConfig implements IPackageConfig {
  private constructor(
    readonly type: PkgType,
    readonly repo: string,
    readonly tag_regex?: string,
    readonly use_tags?: boolean,
    readonly vars?: Record<string, VarResolver>
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
      (obj?.use_tags === undefined || typeof obj?.use_tags === 'boolean') &&
      (obj?.vars === undefined || PackageConfig.isValidVars(obj.vars))
    )
  }

  private static isValidVars(
    vars: unknown
  ): vars is Record<string, VarResolver> {
    if (!isObject(vars)) {
      return false
    }

    return Object.values(vars).every(resolver => {
      if (!isObject(resolver)) {
        return false
      }
      switch (resolver.type) {
        case 'upstream_file':
          return (
            typeof resolver.file === 'string' &&
            typeof resolver.regex === 'string'
          )
        case 'release_asset':
          return (
            typeof resolver.tag === 'string' &&
            typeof resolver.asset_regex === 'string' &&
            (resolver.strip === undefined || typeof resolver.strip === 'string')
          )
        default:
          return false
      }
    })
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
        config.use_tags,
        config.vars
      )
    }

    throw new Error('Invalid config')
  }
}
