import { describe, expect, it } from 'vitest'
import { HostedProxyError, parseJsonResponse } from './hosted-proxy-client'

describe('parseJsonResponse', () => {
  it('throws a HostedProxyError with bad_content_type when HTML is returned', async () => {
    const response = new Response('<!doctype html><html><body>nope</body></html>', {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    })

    await expect(parseJsonResponse(response)).rejects.toEqual(
      expect.objectContaining({
        name: 'HostedProxyError',
        reason: 'bad_content_type',
      }),
    )
  })

  it('throws a HostedProxyError with invalid_json when body looks like json but is invalid', async () => {
    const response = new Response('{"oops":', {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    })

    let thrown: unknown = null
    try {
      await parseJsonResponse(response)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(HostedProxyError)
    expect((thrown as HostedProxyError).reason).toBe('invalid_json')
  })
})
