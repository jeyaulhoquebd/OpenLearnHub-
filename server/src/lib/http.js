export function apiError(res, status, code, message, details) {
  return res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}

export function notFoundHandler(req, res) {
  return apiError(res, 404, 'not_found', `No API route matches ${req.method} ${req.originalUrl}`);
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[api] Unhandled error:', error?.stack || error?.message || error);
  if (res.headersSent) return;

  // Malformed JSON bodies arrive here as a SyntaxError from body-parser.
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return apiError(res, 400, 'invalid_json', 'The request body was not valid JSON.');
  }

  if (error?.type === 'entity.too.large') {
    return apiError(res, 413, 'payload_too_large', 'The request body was too large.');
  }

  return apiError(res, 500, 'internal_error', 'The server could not complete this request.');
}
