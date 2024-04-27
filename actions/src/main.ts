import * as core from '@actions/core'
import * as fs from 'fs'
import { Config } from './model/config'
import { PkgBuild } from './model/pkgbuild'
import { findLatestGitHub } from './parser/github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configFile = core.getInput('config-file', { required: true })
    const packagesPath = core.getInput('packages-path', { required: true })

    const config = await Config.readFile(configFile)
    const pkgbuildFiles = await getPkgbuildFiles(packagesPath)

    for (const [id, pkg] of Object.entries(config.packages)) {
      const pkgbuildFile = pkgbuildFiles.find(file => file.includes(id))

      if (!pkgbuildFile) {
        core.warning(`No PKGBUILD found for package ${id}`)
        continue
      }

      if (pkg.type === 'github') {
        const pkgbuild = await PkgBuild.readFile(pkgbuildFile)
        pkgbuild.pkgVer = await findLatestGitHub(pkg.repo)
        fs.writeFileSync(pkgbuildFile, pkgbuild.stringify())
      }
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
