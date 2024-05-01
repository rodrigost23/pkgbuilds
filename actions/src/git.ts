import * as core from '@actions/core'
import * as path from 'path'
import { simpleGit, type CommitResult, type PushResult } from 'simple-git'

export class Git {
  git = simpleGit()
  constructor(
    readonly packagesPath: string,
    readonly packages: string[]
  ) {
    const {
      GITHUB_WORKSPACE,
      GITHUB_ACTOR,
      GITHUB_TOKEN,
      GITHUB_SERVER_URL,
      GITHUB_REPOSITORY
    } = process.env

    if (
      GITHUB_WORKSPACE === undefined ||
      GITHUB_ACTOR === undefined ||
      GITHUB_TOKEN === undefined ||
      GITHUB_SERVER_URL === undefined ||
      GITHUB_REPOSITORY === undefined
    ) {
      // TODO: Exit with error
      core.setFailed('Missing GitHub environment variable(s)')
      return
    }

    this.git.addConfig('safe.directory', GITHUB_WORKSPACE)
    const url = new URL(GITHUB_REPOSITORY, GITHUB_SERVER_URL)
    url.username = GITHUB_ACTOR
    url.password = GITHUB_TOKEN

    this.git.addRemote('origin', url.toString())
    this.git.addConfig('user.name', GITHUB_ACTOR)
    this.git.addConfig(
      'user.email',
      `${GITHUB_ACTOR}@users.noreply.${url.hostname}`
    )
  }

  async commit(): Promise<CommitResult> {
    for (const pkg of this.packages) {
      const filename = path.join(this.packagesPath, pkg, 'PKGBUILD')
      await this.git.add(filename)
    }

    const packages = (await this.git.diffSummary(['--cached'])).files.map(f =>
      path.basename(path.dirname(f.file))
    )

    const lf = new Intl.ListFormat('en')

    return await this.git.commit(`Update ${lf.format(packages)}`)
  }

  async push(): Promise<PushResult> {
    return await this.git.push()
  }
}
