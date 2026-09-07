import { draftMode } from 'next/headers'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  draftMode().disable()
  return new Response('Draft mode is disabled')
}
