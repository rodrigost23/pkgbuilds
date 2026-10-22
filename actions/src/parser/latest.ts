import { IPackageConfig } from '../model/pkgconfig'
import { findLatestGitTag, LatestTag } from './git'
import { findLatestGitHubTag, tagToVersion } from './github'

/**
 * Gets the git URL of the upstream repository of a package.
 *
 * @param pkg - The package config
 */
export function gitUrl(pkg: IPackageConfig): string {
  return pkg.type === 'github' ? `https://github.com/${pkg.repo}.git` : pkg.url
}

/**
 * Finds the latest upstream version of a package.
 *
 * @param pkg - The package config
 */
export async function findLatest(pkg: IPackageConfig): Promise<LatestTag> {
  if (pkg.type === 'git') {
    return findLatestGitTag(pkg.url, pkg.tag_regex, pkg.version_regex)
  }

  const tag = await findLatestGitHubTag(pkg.repo, pkg.tag_regex)
  return { tag, version: tagToVersion(tag) }
}
