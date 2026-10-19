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
  return apiError(res, 500, 'internal_error', 'The server could not complete this request.');
}
