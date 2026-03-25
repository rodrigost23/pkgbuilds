import * as core from '@actions/core'
import * as path from 'path'
import { simpleGit, type CommitResult, type PushResult } from 'simple-git'

export class Git {
  git = simpleGit()
  constructor(
    readonly packagesPath: string,
    readonly packageVersions: Map<string, string>
  ) {
    const {
      GITHUB_WORKSPACE,
      GITHUB_ACTOR,
      GITHUB_SERVER_URL,
      GITHUB_REPOSITORY
    } = process.env

    if (
      GITHUB_WORKSPACE === undefined ||
      GITHUB_ACTOR === undefined ||
      GITHUB_SERVER_URL === undefined ||
      GITHUB_REPOSITORY === undefined
    ) {
      throw new Error('Missing GitHub environment variable(s)')
    }

    this.git.addConfig('safe.directory', GITHUB_WORKSPACE)
    const url = new URL(GITHUB_REPOSITORY, GITHUB_SERVER_URL)
    url.username = GITHUB_ACTOR
    url.password = core.getInput('github-token', { required: true })

    this.git.addRemote('origin', url.toString())
    this.git.addConfig('user.name', GITHUB_ACTOR)
    this.git.addConfig(
      'user.email',
      `${GITHUB_ACTOR}@users.noreply.${url.hostname}`
    )
  }

  async commit(): Promise<CommitResult> {
    for (const [pkgName] of this.packageVersions) {
      const filename = path.join(this.packagesPath, pkgName, 'PKGBUILD')
      await this.git.add(filename)
    }

    const packages = (await this.git.diffSummary(['--cached'])).files.map(f =>
      path.basename(path.dirname(f.file))
    )

    const commitMessage = this.generateCommitMessage(packages)

    return await this.git.commit(commitMessage)
  }

  private generateCommitMessage(packages: string[]): string {
    const packageVersions: string[] = []

    for (const pkg of packages) {
      const version = this.packageVersions.get(pkg)
      if (version) {
        packageVersions.push(`${pkg} to ${version}`)
      }
    }

    if (packageVersions.length === 0) {
      return 'Update packages'
    }

    const lf = new Intl.ListFormat('en')
    return `Update ${lf.format(packageVersions)}`
  }

  async push(): Promise<PushResult> {
    return await this.git.push()
  }
}
