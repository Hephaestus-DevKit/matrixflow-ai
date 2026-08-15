const baseUrl = (process.env.MATRIXFLOW_PRODUCTION_URL || 'https://matrixflow-ai.vercel.app').replace(
  /\/+$/,
  '',
);

const routes = ['/', '/login', '/register', '/pricing', '/privacy', '/terms'];
const failures = [];

for (const route of routes) {
  const url = `${baseUrl}${route}`;
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'matrixflow-production-smoke/1.0' },
      redirect: 'manual',
    });
    const body = await response.text();

    if (response.status !== 200) {
      failures.push(`${route}: expected 200, received ${response.status}`);
      continue;
    }
    if (!body.includes('MatrixFlow')) {
      failures.push(`${route}: MatrixFlow brand marker is missing`);
    }

    if (route === '/') {
      const csp = response.headers.get('content-security-policy') || '';
      const hsts = response.headers.get('strict-transport-security') || '';
      const framePolicy = response.headers.get('x-frame-options') || '';
      if (!csp.includes("default-src 'self'")) {
        failures.push('home: content-security-policy is missing the default-src boundary');
      }
      if (!/max-age=\d+/i.test(hsts)) {
        failures.push('home: strict-transport-security is missing');
      }
      if (framePolicy.toLowerCase() !== 'deny') {
        failures.push(`home: x-frame-options should be DENY, received ${framePolicy || '<empty>'}`);
      }
    }

    process.stdout.write(`ok ${route} (${response.status})\n`);
  } catch (error) {
    failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Production smoke failed for ${baseUrl}\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Production smoke passed for ${baseUrl}\n`);
}
