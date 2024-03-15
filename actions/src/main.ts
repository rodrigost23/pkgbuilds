import * as core from '@actions/core'
import * as fs from 'fs'
import { PkgBuild } from './model/pkgbuild'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // const configFile = core.getInput('config-file', { required: true })
    const packagesPath = core.getInput('packages-path', { required: true })

    const pkgbuildFiles = await getPkgbuildFiles(packagesPath)

    for (const pkgbuildFile of pkgbuildFiles) {
      const string = fs.readFileSync(pkgbuildFile, 'utf8')

      const pkgbuild = await PkgBuild.read(string)

      fs.writeFileSync(pkgbuildFile, pkgbuild.stringify())
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
