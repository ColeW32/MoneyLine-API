const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://mlapi.bet'

async function proxyRequest(
  request: Request,
  path: string[]
) {
  const url = new URL(`/manage/${path.join('/')}`, API_URL)
  url.search = new URL(request.url).search

  const headers = new Headers()
  const authorization = request.headers.get('authorization')

  if (authorization) headers.set('authorization', authorization)

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text()
    if (body) {
      init.body = body
      const contentType = request.headers.get('content-type')
      if (contentType) headers.set('content-type', contentType)
    }
  }

  const upstream = await fetch(url, init)
  const body = await upstream.text()

  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    },
  })
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyRequest(request, path)
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  return proxyRequest(request, path)
}
