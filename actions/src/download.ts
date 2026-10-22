import { createHash } from 'crypto'

// Saving fetch on another variable because bash-language-server deletes it from global
const _fetch = fetch

/** Longest a single download may take, so a stalled host can't hang the run. */
export const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Downloads a file and calculates its sha256 sum.
 *
 * @param url - The URL to download
 * @param timeoutMs - Give up when the whole download takes longer than this
 * @returns The hex encoded sha256 sum
 * @throws {Error} If the download fails, times out, or the file is empty
 */
export async function sha256OfUrl(
  url: string,
  timeoutMs = DOWNLOAD_TIMEOUT_MS
): Promise<string> {
  let data: Uint8Array
  try {
    const response = await _fetch(url, {
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim())
    }
    data = new Uint8Array(await response.arrayBuffer())
  } catch (error) {
    // The abort error is a DOMException, which isn't always an `Error` instance
    const { name, message } = error as { name?: string; message?: string }
    const reason =
      name === 'TimeoutError'
        ? `timed out after ${Math.round(timeoutMs / 1000)}s`
        : message ?? String(error)
    throw new Error(`Failed to download ${url}: ${reason}`)
  }

  if (data.length === 0) {
    throw new Error(`Could not calculate checksum for ${url}: empty file`)
  }
  return createHash('sha256').update(data).digest('hex')
}
