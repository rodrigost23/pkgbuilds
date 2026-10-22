import { createHash } from 'crypto'
import * as http from 'http'
import { AddressInfo } from 'net'
import { sha256OfUrl } from '../src/download'

describe('sha256OfUrl', () => {
  let server: http.Server
  let base: string

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      switch (req.url) {
        case '/file':
          res.end('hello')
          break
        case '/empty':
          res.end()
          break
        case '/restricted':
          res.writeHead(503, { 'Retry-After': '3600' })
          res.end('Access temporarily restricted')
          break
        case '/stall':
          // Never answers
          break
        default:
          res.writeHead(404)
          res.end()
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  it('should return the sha256 sum of the file', async () => {
    expect(await sha256OfUrl(`${base}/file`)).toBe(
      createHash('sha256').update('hello').digest('hex')
    )
  })

  it('should fail with the status when the server refuses', async () => {
    await expect(sha256OfUrl(`${base}/restricted`)).rejects.toThrow(
      `Failed to download ${base}/restricted: 503`
    )
    await expect(sha256OfUrl(`${base}/missing`)).rejects.toThrow(
      `Failed to download ${base}/missing: 404`
    )
  })

  it('should give up on a server that never answers', async () => {
    const started = Date.now()

    await expect(sha256OfUrl(`${base}/stall`, 300)).rejects.toThrow(
      `Failed to download ${base}/stall: timed out after`
    )
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it('should fail for an empty file', async () => {
    await expect(sha256OfUrl(`${base}/empty`)).rejects.toThrow('empty file')
  })

  it('should fail for an unreachable server', async () => {
    await expect(sha256OfUrl('http://127.0.0.1:1/x')).rejects.toThrow(
      'Failed to download http://127.0.0.1:1/x'
    )
  })
})
