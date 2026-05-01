// ── Known claim sets ─────────────────────────────────────────────────────────

/** Claims whose numeric value is a Unix timestamp (seconds). */
export const TIMESTAMP_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at']);

/** Claims whose string value is a space-separated list of OAuth 2.0 scopes. */
export const SCOPE_CLAIMS = new Set(['scope', 'scp']);

/**
 * Human-readable descriptions for well-known JWT / OIDC / OAuth claims.
 * Sources: RFC 7519, RFC 7515, OpenID Connect Core 1.0, OAuth 2.0 common practice.
 */
export const CLAIM_DESCRIPTIONS = {
  // ── RFC 7519 — JWT registered claims ─────────────────────────────────────
  iss: 'Issuer — identifies who issued the token',
  sub: 'Subject — the user or entity this token represents',
  aud: 'Audience — intended recipients of this token',
  exp: 'Expiration Time — token is invalid after this time',
  nbf: 'Not Before — token is invalid before this time',
  iat: 'Issued At — when the token was created',
  jti: 'JWT ID — unique identifier to prevent token replay',

  // ── JOSE header parameters (RFC 7515 / 7516) ─────────────────────────────
  alg: 'Algorithm — cryptographic algorithm used to sign or encrypt (e.g. RS256, HS256)',
  typ: 'Type — media type of the token, usually "JWT"',
  cty: 'Content Type — media type of the secured content',
  kid: 'Key ID — identifies which key was used to sign this token',
  x5t: 'X.509 Thumbprint — SHA-1 thumbprint of the signing certificate',
  jku: 'JWK Set URL — URL pointing to the public keys for verification',

  // ── OpenID Connect Core 1.0 ───────────────────────────────────────────────
  nonce:      'Nonce — value to tie the token to a client session and prevent replay attacks',
  at_hash:    'Access Token Hash — hash of the access token; used to bind it to this ID token',
  c_hash:     'Code Hash — hash of the authorization code; used to bind it to this ID token',
  acr:        'Authentication Context Class — level of assurance of the authentication performed',
  amr:        'Authentication Methods — list of methods used to authenticate (e.g. "pwd", "otp", "mfa")',
  auth_time:  'Authentication Time — when the end-user last actively authenticated',
  azp:        'Authorized Party — client the token was issued to (when audience has one entry)',
  sid:        'Session ID — identifier for the provider-side authentication session',
  updated_at: 'Updated At — time the user\'s information was last updated',

  // ── OIDC Standard Claims (profile, email, phone, address) ────────────────
  name:            'Full display name of the user',
  given_name:      'Given (first) name of the user',
  family_name:     'Family (last) name of the user',
  middle_name:     'Middle name of the user',
  nickname:        'Casual name or username of the user',
  preferred_username: 'Shorthand name the user prefers (may differ from sub)',
  profile:         'URL of the user\'s profile page',
  picture:         'URL of the user\'s profile picture',
  website:         'URL of the user\'s personal website',
  email:           'Email address of the user',
  email_verified:  'Whether the email address has been verified by the provider',
  gender:          'Gender of the user',
  birthdate:       'Birthday of the user (YYYY-MM-DD or YYYY)',
  zoneinfo:        'User\'s time zone, e.g. "America/New_York"',
  locale:          'User\'s locale, e.g. "en-US"',
  phone_number:    'Phone number of the user in E.164 format',
  phone_number_verified: 'Whether the phone number has been verified by the provider',
  address:         'Physical mailing address of the user',

  // ── OAuth 2.0 / common extension claims ──────────────────────────────────
  scope:       'Scopes — space-separated list of OAuth 2.0 permissions granted to this token',
  scp:         'Scopes — list of OAuth 2.0 permissions granted to this token',
  roles:       'Roles assigned to the user within the application or tenant',
  groups:      'Groups the user belongs to',
  permissions: 'Permissions explicitly granted to this token',
  client_id:   'OAuth 2.0 client (application) that requested this token',
  tenant_id:   'Tenant or organization identifier (common in multi-tenant systems)',
};
