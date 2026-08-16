import { isIP } from 'node:net';

function privateIpv4(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function privateIpv6(value) {
  const normalized = value.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  // Unique-local (fc00::/7), link-local (fe80::/10), and IPv4-mapped
  // addresses are not valid public egress destinations.
  if (/^(fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/::ffff:(\d+(?:\.\d+){3})$/);
  if (mapped) return privateIpv4(mapped[1]);
  const hexMapped = normalized.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hexMapped) return false;
  const high = Number.parseInt(hexMapped[1], 16);
  const low = Number.parseInt(hexMapped[2], 16);
  return privateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}

export function isPrivateNetworkAddress(hostname) {
  const value = String(hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!value || value === 'localhost' || value.endsWith('.local') || value.endsWith('.internal'))
    return true;
  const version = isIP(value);
  if (version === 4) return privateIpv4(value);
  if (version === 6) return privateIpv6(value);
  return false;
}
