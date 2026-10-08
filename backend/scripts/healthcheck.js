fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health', {
  signal: AbortSignal.timeout(2000)
}).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));
