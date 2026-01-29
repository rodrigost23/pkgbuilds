import * as core from '@actions/core'
import { createHash } from 'crypto'
import * as fs from 'fs'
import { Git } from './git'
import { Config } from './model/config'
import { PkgBuild } from './model/pkgbuild'
import { findLatestGitHub } from './parser/github'

const _fetch = fetch

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configFile = core.getInput('config-file', { required: true })
    const packagesPath = core.getInput('packages-path', { required: true })
    core.debug(`Config file: ${configFile}`)
    core.debug(`Packages path: ${packagesPath}`)

    const config = await Config.readFile(configFile)
    core.debug(`Config: ${JSON.stringify(config)}`)
    const pkgbuildFiles = await getPkgbuildFiles(packagesPath)
    core.debug(`Found PKGBUILD files: ${pkgbuildFiles.join(', ')}`)

    const git = new Git(packagesPath, Object.keys(config.packages))

    for (const [id, pkg] of Object.entries(config.packages)) {
      core.startGroup(id)
      core.debug(`Processing package ${id}`)
      const pkgbuildFile = pkgbuildFiles.find(file => file.includes(id))

      if (!pkgbuildFile) {
        core.warning(`No PKGBUILD found for package ${id}`)
        continue
      }
      core.debug(`Found PKGBUILD file: ${pkgbuildFile}`)

      if (pkg.type === 'github') {
        let pkgbuild = await PkgBuild.readFile(pkgbuildFile)
        core.debug(`Original pkgbuild:\n${pkgbuild.stringify()}`)

        // Keep original checksums so SKIP entries are respected
        const originalChecksums = Array.isArray(pkgbuild.checksums)
          ? [...pkgbuild.checksums]
          : []

        pkgbuild.pkgVer = await findLatestGitHub(pkg.repo)
        core.debug(`Latest version: ${pkgbuild.pkgVer}`)
        pkgbuild = await PkgBuild.read(pkgbuild.stringify())
        pkgbuild.checksums = []

        for (let i = 0; i < pkgbuild.sources.length; i++) {
          const source = pkgbuild.sources[i]
          const origChecksum = originalChecksums[i]

          // If the original checksum is SKIP, keep SKIP and don't download
          if (
            typeof origChecksum === 'string' &&
            origChecksum.trim().toUpperCase() === 'SKIP'
          ) {
            core.info(`Skipping checksum for source ${source} (SKIP)`)
            pkgbuild.checksums.push('SKIP')
            continue
          }

          // If the source is not a URL, preserve the original checksum
          const urlMatch = source.match(/(?:.*?::)?(https?:\/\/.*$)/)
          if (!urlMatch) {
            core.info(`Preserving original checksum for local source ${source}`)
            pkgbuild.checksums.push(origChecksum || '')
            continue
          }

          core.info(`Downloading source ${source} to calculate checksum`)
          const response = await _fetch(urlMatch[1])

          if (!response.ok) {
            throw new Error(
              `Failed to download ${urlMatch[1]}: ${response.statusText}`
            )
          }

          const data = new Uint8Array(await response.arrayBuffer())
          if (data.length > 0) {
            const checksum = createHash('sha256').update(data).digest('hex')
            core.info(`Calculated sha256 sum: ${checksum}`)
            pkgbuild.checksums.push(checksum)
          } else {
            throw new Error(`Could not calculate checksum for source ${source}`)
          }
        }
        core.debug(`New checksums: ${pkgbuild.checksums.join(', ')}`)
        fs.writeFileSync(pkgbuildFile, pkgbuild.stringify())
        core.debug(`New pkgbuild:\n${pkgbuild.stringify()}`)
      }
      core.endGroup()
    }

    core.info('Creating commit...')
    const commit = await git.commit()
    if (commit.commit.trim().length > 0) {
      core.info(`Pushing commit ${commit.commit}...`)
      await git.push()
    } else {
      core.info('No change.')
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function getPkgbuildFiles(packagesPath: fs.PathLike): Promise<string[]> {
  // return list of all PKGBUILD files under packagesPath
  const pkgbuildFiles = []
  const dirents = await fs.promises.readdir(packagesPath, {
    withFileTypes: true
  })
  for (const dirent of dirents) {
    if (dirent.isDirectory()) {
      const files = await fs.promises.readdir(`${packagesPath}/${dirent.name}`)
      for (const file of files) {
        if (file === 'PKGBUILD') {
          pkgbuildFiles.push(`${packagesPath}/${dirent.name}/PKGBUILD`)
        }
      }
    }
  }
  return pkgbuildFiles
}
