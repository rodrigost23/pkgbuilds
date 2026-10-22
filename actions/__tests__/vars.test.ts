import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { expandTemplate, resolveVars } from '../src/parser/vars'

describe('expandTemplate', () => {
  it('should replace known placeholders', () => {
    expect(expandTemplate('cef-{ver}-x', { ver: '1.2' })).toBe('cef-1.2-x')
  })

  it('should escape values for regular expressions', () => {
    expect(expandTemplate('^{ver}$', { ver: '1.2' }, true)).toBe('^1\\.2$')
  })

  it('should throw for unknown placeholders', () => {
    expect(() => expandTemplate('{nope}', {})).toThrow('Unknown variable')
  })
})

describe('resolveVars', () => {
  let dir: string
  let url: string

  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vars-test-'))
    url = `file://${dir}`
    git('init', '-q')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')

    fs.mkdirSync(path.join(dir, 'packaging'))
    const manifest = (cef: string): string =>
      `sources:
  - url: https://example.com/releases/download/cef-${cef}-proprietary-codecs/cef_binary_${cef}%2Bgabc%2Bchromium-1.2.3_linux64_minimal.zip
  - url: https://example.com/releases/download/cef-${cef}-proprietary-codecs/cef_binary_${cef}%2Bgabc%2Bchromium-1.2.3_linuxarm64_minimal.zip
`
    fs.writeFileSync(
      path.join(dir, 'packaging', 'app.yml'),
      manifest('150.0.1')
    )
    git('add', '.')
    git('commit', '-q', '-m', 'one')
    git('tag', 'v1.0.0')

    fs.writeFileSync(
      path.join(dir, 'packaging', 'app.yml'),
      manifest('152.0.6')
    )
    git('commit', '-q', '-am', 'two')
    git('tag', 'v1.1.0')
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const cefVars = {
    _cefver: {
      type: 'upstream_file',
      file: 'packaging/app.yml',
      regex: 'releases/download/cef-([0-9.]+)-proprietary-codecs/'
    },
    _cefdir: {
      type: 'upstream_file',
      file: 'packaging/app.yml',
      decode: 'url',
      regex: '/(cef_binary_{_cefver}[^/\\s]*_linux64_minimal)\\.zip'
    },
    _tag: { type: 'template', value: 'v{pkgver}' }
  } as const

  it('should resolve chained variables from the files at the tag', async () => {
    expect(await resolveVars(url, 'v1.1.0', '1.1.0', cefVars)).toEqual({
      _cefver: '152.0.6',
      _cefdir: 'cef_binary_152.0.6+gabc+chromium-1.2.3_linux64_minimal',
      _tag: 'v1.1.0'
    })
  })

  it('should read the file as it was at the tag', async () => {
    const resolved = await resolveVars(url, 'v1.0.0', '1.0.0', cefVars)

    expect(resolved._cefver).toBe('150.0.1')
  })

  it('should expose the tag to templates', async () => {
    expect(
      await resolveVars(url, 'v1.1.0', '1.1.0', {
        _tag: { type: 'template', value: '{tag}-{pkgver}' }
      })
    ).toEqual({ _tag: 'v1.1.0-1.1.0' })
  })

  it('should not need the repository for templates only', async () => {
    expect(
      await resolveVars('file:///does/not/exist', 'v1', '1', {
        a: { type: 'template', value: 'x{pkgver}' }
      })
    ).toEqual({ a: 'x1' })
  })

  it('should name the variable that could not be resolved', async () => {
    await expect(
      resolveVars(url, 'v1.1.0', '1.1.0', {
        a: {
          type: 'upstream_file',
          file: 'packaging/app.yml',
          regex: 'nomatch(\\d)'
        }
      })
    ).rejects.toThrow('Failed to resolve a')
    await expect(
      resolveVars(url, 'v1.1.0', '1.1.0', {
        a: { type: 'upstream_file', file: 'missing.yml', regex: '(x)' }
      })
    ).rejects.toThrow('Failed to resolve a')
    await expect(
      resolveVars(url, 'v9.9.9', '9.9.9', {
        a: { type: 'upstream_file', file: 'packaging/app.yml', regex: '(x)' }
      })
    ).rejects.toThrow('Failed to resolve a')
  })

  it('should refuse paths outside the repository', async () => {
    await expect(
      resolveVars(url, 'v1.1.0', '1.1.0', {
        a: { type: 'upstream_file', file: '../etc/passwd', regex: '(.)' }
      })
    ).rejects.toThrow('Invalid file path')
  })
})
