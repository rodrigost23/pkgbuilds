import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { VarResolver } from '../model/pkgconfig'
import { gitEnv } from './git'

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
 * Reads files of a git repository at a tag. The repository is fetched
 * (shallow, without file contents) once, the first time a file is read.
 */
class TagFiles {
  private dir?: string

  constructor(
    private readonly url: string,
    private readonly tag: string
  ) {}

  async read(file: string): Promise<string> {
    if (/(^|\/)\.\.(\/|$)/.test(file)) {
      throw new Error(`Invalid file path ${file}`)
    }

    if (!this.dir) {
      this.dir = await mkdtemp(join(tmpdir(), 'pkgupdate-'))
      await simpleGit()
        .env(gitEnv())
        .clone(this.url, this.dir, [
          '--depth=1',
          '--filter=blob:none',
          '--no-checkout',
          '--quiet',
          '--branch',
          this.tag
        ])
    }

    return simpleGit(this.dir)
      .env(gitEnv())
      .show([`HEAD:${file}`])
  }

  async cleanup(): Promise<void> {
    if (this.dir) {
      await rm(this.dir, { recursive: true, force: true })
    }
  }
}

/**
 * Resolves PKGBUILD variables that are derived from the upstream repository
 * at the new version, in the order they are declared. Each resolver can use
 * the previously resolved variables.
 *
 * @param url - Git URL of the upstream repository
 * @param tag - Upstream git tag of the new version
 * @param pkgver - The new PKGBUILD version
 * @param resolvers - Resolvers keyed by PKGBUILD variable name
 * @returns The resolved values keyed by PKGBUILD variable name
 */
export async function resolveVars(
  url: string,
  tag: string,
  pkgver: string,
  resolvers: Record<string, VarResolver>
): Promise<Record<string, string>> {
  const context: Record<string, string> = { pkgver, tag }
  const resolved: Record<string, string> = {}
  const files = new TagFiles(url, tag)

  try {
    for (const [name, resolver] of Object.entries(resolvers)) {
      let value: string
      try {
        switch (resolver.type) {
          case 'upstream_file':
            value = await resolveUpstreamFile(files, resolver, context)
            break
          case 'template':
            value = expandTemplate(resolver.value, context)
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
  } finally {
    await files.cleanup()
  }

  return resolved
}

async function resolveUpstreamFile(
  files: TagFiles,
  resolver: Extract<VarResolver, { type: 'upstream_file' }>,
  context: Record<string, string>
): Promise<string> {
  const file = expandTemplate(resolver.file, context)
  const match = new RegExp(expandTemplate(resolver.regex, context, true)).exec(
    await files.read(file)
  )
  if (!match?.[1]) {
    throw new Error(`No match for /${resolver.regex}/ in ${file}`)
  }

  return resolver.decode === 'url' ? decodeURIComponent(match[1]) : match[1]
}
