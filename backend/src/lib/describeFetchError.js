function describeFetchError(err) {
  const code = err?.cause?.code || err?.code || '';
  const causeMessage = err?.cause?.message || '';

  switch (code) {
    case 'ENOTFOUND':
      return 'DNS lookup failed — the backend pod cannot resolve the Nexus hostname';
    case 'ECONNREFUSED':
      return 'connection refused — the Nexus host is reachable, but nothing accepted the connection on that port';
    case 'ETIMEDOUT':
      return 'connection timed out — the Nexus host or port may be blocked from the cluster';
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return 'network unreachable — the backend pod has no route to the Nexus host';
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return 'TLS certificate validation failed — the Nexus HA certificate is not trusted in the backend container';
    case 'CERT_HAS_EXPIRED':
      return 'TLS certificate validation failed — the Nexus HA certificate is expired';
    default:
      break;
  }

  if (causeMessage && causeMessage !== 'fetch failed') {
    return causeMessage;
  }

  return err?.message || 'fetch failed';
}

module.exports = { describeFetchError };
