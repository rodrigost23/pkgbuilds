import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  findLatestGitTag,
  listGitTags,
  selectLatestTag
} from '../src/parser/git'

describe('selectLatestTag', () => {
  const tags = ['v1.9.0', 'v1.10.0', 'v1.10.0-beta1', 'v0.5.0', 'cef-1.0']

  it('should pick the highest version', () => {
    expect(selectLatestTag(['0.9.0', '0.10.0', '0.2.0'])).toEqual({
      tag: '0.10.0',
      version: '0.10.0'
    })
  })

  it('should only consider tags matching tag_regex', () => {
    expect(selectLatestTag(tags, '^v\\d+\\.\\d+\\.\\d+$')).toEqual({
      tag: 'v1.10.0',
      version: '1.10.0'
    })
  })

  it('should extract the version with version_regex and break ties by tag', () => {
    const alt = ['0.1.0-alt1', '0.1.0-alt2', '0.0.9-alt5', '0.1.0', 'junk']

    expect(
      selectLatestTag(alt, undefined, '^(\\d+\\.\\d+\\.\\d+)-alt\\d+$')
    ).toEqual({ tag: '0.1.0-alt2', version: '0.1.0' })
  })

  it('should convert dashes to underscores in the version', () => {
    expect(selectLatestTag(['v1.5.1-beta6'])).toEqual({
      tag: 'v1.5.1-beta6',
      version: '1.5.1_beta6'
    })
  })

  it('should throw when no tag matches', () => {
    expect(() => selectLatestTag(['a', 'b'], '^v')).toThrow('No tags matching')
    expect(() => selectLatestTag([])).toThrow('No tags matching')
  })
})

describe('with a git repository', () => {
  let dir: string
  let url: string

  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'))
    url = `file://${dir}`
    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')

    fs.writeFileSync(path.join(dir, 'info.txt'), 'version 1')
    git('add', '.')
    git('commit', '-q', '-m', 'one')
    git('tag', 'v1.0.0')

    fs.writeFileSync(path.join(dir, 'info.txt'), 'version 2')
    git('commit', '-q', '-am', 'two')
    git('tag', 'v1.1.0')
    git('tag', '-a', 'v1.2.0', '-m', 'annotated')
    git('tag', 'unrelated')
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('should list tags, including annotated ones', async () => {
    expect((await listGitTags(url)).sort()).toEqual([
      'unrelated',
      'v1.0.0',
      'v1.1.0',
      'v1.2.0'
    ])
  })

  it('should find the latest tag', async () => {
    expect(await findLatestGitTag(url, '^v\\d')).toEqual({
      tag: 'v1.2.0',
      version: '1.2.0'
    })
  })

  it('should explain which repository failed', async () => {
    await expect(findLatestGitTag(`file://${dir}/missing`)).rejects.toThrow(
      'Failed to find the latest tag'
    )
    await expect(findLatestGitTag(url, '^nothing$')).rejects.toThrow(
      'No tags matching'
    )
  })
})
