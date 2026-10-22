import { isObject } from '../util'

/**
 * Reads a file from the upstream repository at the new version's tag and
 * returns the first capture group of `regex`.
 */
export interface UpstreamFileVar {
  type: 'upstream_file'
  file: string
  regex: string
  /** Decode the captured value (e.g. `%2B` -> `+`) */
  decode?: 'url'
}

/** Expands a template string, e.g. `{tag}` to the upstream tag. */
export interface TemplateVar {
  type: 'template'
  value: string
}

/**
 * Resolver for a PKGBUILD variable derived from the upstream repository.
 * Strings can reference `{pkgver}`, `{tag}` and previously resolved variables
 * as `{name}`.
 */
export type VarResolver = UpstreamFileVar | TemplateVar

interface BasePkg {
  /** Only consider tags/releases matching this regex */
  tag_regex?: string
  /** PKGBUILD variables derived from the upstream repository */
  vars?: Record<string, VarResolver>
}

/** Versions come from the latest GitHub release (falling back to tags) */
export interface GitHubPkg extends BasePkg {
  type: 'github'
  repo: string
}

/** Versions come from the git tags of any repository */
export interface GitPkg extends BasePkg {
  type: 'git'
  url: string
  /** Regex whose first capture group is the version within a tag */
  version_regex?: string
}

export type IPackageConfig = GitHubPkg | GitPkg

function isRegex(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  try {
    new RegExp(value)
    return true
  } catch {
    return false
  }
}

function isOptionalRegex(value: unknown): boolean {
  return value === undefined || isRegex(value)
}

function isValidResolver(resolver: unknown): resolver is VarResolver {
  if (!isObject(resolver)) {
    return false
  }

  switch (resolver.type) {
    case 'upstream_file':
      return (
        typeof resolver.file === 'string' &&
        isRegex(resolver.regex) &&
        (resolver.decode === undefined || resolver.decode === 'url')
      )
    case 'template':
      return typeof resolver.value === 'string'
    default:
      return false
  }
}

function isValidVars(vars: unknown): vars is Record<string, VarResolver> {
  return isObject(vars) && Object.values(vars).every(isValidResolver)
}

/**
 * Checks if the given object is a valid {@link IPackageConfig}.
 *
 * @param obj - The object to check
 * @returns True if obj is a valid {@link IPackageConfig}, `false` otherwise
 */
function isValidConfig(obj: unknown): obj is IPackageConfig {
  if (!isObject(obj)) {
    return false
  }

  if (
    !isOptionalRegex(obj.tag_regex) ||
    (obj.vars !== undefined && !isValidVars(obj.vars))
  ) {
    return false
  }

  switch (obj.type) {
    case 'github':
      return typeof obj.repo === 'string'
    case 'git':
      return typeof obj.url === 'string' && isOptionalRegex(obj.version_regex)
    default:
      return false
  }
}

/**
 * Parses the given JSON string as a package config object.
 *
 * @param input - The JSON string to parse
 * @returns The parsed {@link IPackageConfig} if valid, throws if invalid
 */
function read(input: string): IPackageConfig {
  const config = JSON.parse(input)
  if (!isValidConfig(config)) {
    throw new Error('Invalid config')
  }

  // Only keep known properties
  const common = { tag_regex: config.tag_regex, vars: config.vars }
  if (config.type === 'git') {
    return {
      type: 'git',
      url: config.url,
      version_regex: config.version_regex,
      ...common
    }
  }
  return { type: 'github', repo: config.repo, ...common }
}

export const PackageConfig = { isValidConfig, read }
