import { Octokit } from 'octokit'
import { VarResolver } from '../model/pkgconfig'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replaces `{name}` placeholders with the matching value of `context`.
 *
 * @param template - The string containing placeholders
 * @param context - Values available to the template
 * @param escape - Escape values for use inside a regular expression
 * @throws {Error} If the template references an unknown name
 */
export function expandTemplate(
  template: string,
  context: Record<string, string>,
  escape = false
): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
    if (!(name in context)) {
      throw new Error(`Unknown variable {${name}} in "${template}"`)
    }
    return escape ? escapeRegExp(context[name]) : context[name]
  })
}

/**
 * Resolves PKGBUILD variables that are derived from the upstream repository
 * at the new version, in the order they are declared. Each resolver can use
 * the previously resolved variables.
 *
 * @param repo - Upstream repository, as `owner/repo`
 * @param tag - Upstream git tag of the new version
 * @param pkgver - The new PKGBUILD version
 * @param resolvers - Resolvers keyed by PKGBUILD variable name
 * @returns The resolved values keyed by PKGBUILD variable name
 */
export async function resolveVars(
  repo: string,
  tag: string,
  pkgver: string,
  resolvers: Record<string, VarResolver>
): Promise<Record<string, string>> {
  const context: Record<string, string> = { pkgver, tag }
  const resolved: Record<string, string> = {}

  for (const [name, resolver] of Object.entries(resolvers)) {
    let value: string
    try {
      switch (resolver.type) {
        case 'upstream_file':
          value = await resolveUpstreamFile(repo, tag, resolver, context)
          break
        case 'release_asset':
          value = await resolveReleaseAsset(repo, resolver, context)
          break
      }
    } catch (error) {
      throw new Error(
        `Failed to resolve ${name}: ${error instanceof Error ? error.message : error}`
      )
    }
    context[name] = value
    resolved[name] = value
  }

  return resolved
}

async function resolveUpstreamFile(
  repo: string,
  tag: string,
  resolver: Extract<VarResolver, { type: 'upstream_file' }>,
  context: Record<string, string>
): Promise<string> {
  const file = expandTemplate(resolver.file, context)
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/${file}`
  const response = await _fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`)
  }

  const match = new RegExp(expandTemplate(resolver.regex, context, true)).exec(
    await response.text()
  )
  if (!match?.[1]) {
    throw new Error(`No match for /${resolver.regex}/ in ${file}`)
  }
  return match[1]
}

async function resolveReleaseAsset(
  repo: string,
  resolver: Extract<VarResolver, { type: 'release_asset' }>,
  context: Record<string, string>
): Promise<string> {
  const [owner, name] = repo.split('/')
  const releaseTag = expandTemplate(resolver.tag, context)
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: { fetch: _fetch }
  })

  const { data: release } = await octokit.rest.repos.getReleaseByTag({
    owner,
    repo: name,
    tag: releaseTag
  })

  const regex = new RegExp(expandTemplate(resolver.asset_regex, context, true))
  const assets = release.assets.filter(asset => regex.test(asset.name))
  if (assets.length !== 1) {
    throw new Error(
      `Expected exactly one asset matching /${regex.source}/ in release ${releaseTag}, found ${assets.length}`
    )
  }

  const assetName = assets[0].name
  const strip = resolver.strip
  return strip && assetName.endsWith(strip)
    ? assetName.slice(0, -strip.length)
    : assetName
}
