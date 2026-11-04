function createUploadRateLimiter({ limit, windowMs }) {
  const clients = new Map();

  return function uploadRateLimiter(req, res, next) {
    const now = Date.now();
    const clientId = req.ip || req.socket.remoteAddress || 'unknown';
    let client = clients.get(clientId);

    if (!client || now >= client.resetAt) {
      client = { count: 0, resetAt: now + windowMs };
      clients.set(clientId, client);
    }

    if (client.count >= limit) {
      return res.status(429).json({
        error: { code: 'UPLOAD_RATE_LIMITED', message: 'Muitas tentativas de upload. Tente novamente em breve.' },
      });
    }

    client.count += 1;
    if (clients.size > 10_000) {
      for (const [id, entry] of clients) {
        if (now >= entry.resetAt) clients.delete(id);
      }
    }
    return next();
  };
}

module.exports = { createUploadRateLimiter };