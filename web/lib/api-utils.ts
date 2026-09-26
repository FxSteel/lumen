import { NextResponse } from 'next/server'

type ErrorDetails = unknown

export function createErrorResponse(
  code: string,
  message: string,
  details?: ErrorDetails,
  status = 400
) {
  const body: { code: string; message: string; details?: ErrorDetails } = {
    code,
    message,
  }

  if (details !== undefined) {
    body.details = details
  }

  return NextResponse.json(body, { status })
}

