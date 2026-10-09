export function readPublicConfig(env = process.env) {
  const url = (key, fallback = '', allowMail = false) => {
    const value = (env[key] || fallback).trim();
    if (!value) return '';
    let parsed;
    try { parsed = new URL(value); } catch { throw Error(`${key} must be an absolute URL`); }
    if (!['https:', 'http:', ...(allowMail ? ['mailto:'] : [])].includes(parsed.protocol) || parsed.username || parsed.password)
      throw Error(`${key} must be a public HTTP(S) URL${allowMail ? ' or mailto link' : ''}, without credentials`);
    return parsed.href.replace(/\/$/, '');
  };
  const repository = url('PUBLIC_REPOSITORY_URL', 'https://github.com/Mgregchi/Evir');
  const rawBase = (env.PUBLIC_BASE_PATH || '').trim();
  if (rawBase && rawBase !== '/' && !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/.test(rawBase))
    throw Error('PUBLIC_BASE_PATH must be a path such as /Evir/, without traversal or query parameters');
  const basePath = rawBase.replace(/\/$/, '') || '';
  const siteUrl = url('PUBLIC_SITE_URL');
  if (siteUrl && new URL(siteUrl).origin !== siteUrl)
    throw Error('PUBLIC_SITE_URL must be an origin such as https://example.org; use PUBLIC_BASE_PATH for a subdirectory');
  return {
    siteUrl, basePath, repository,
    docs: url('PUBLIC_DOCS_URL', `${repository}/blob/main/research/README.md`),
    community: url('PUBLIC_COMMUNITY_URL'),
    feedback: url('PUBLIC_FEEDBACK_URL', `${repository}/issues/new`),
    newsletter: url('PUBLIC_NEWSLETTER_URL'),
    socialX: url('PUBLIC_SOCIAL_X_URL'), socialLinkedIn: url('PUBLIC_SOCIAL_LINKEDIN_URL'),
    socialMastodon: url('PUBLIC_SOCIAL_MASTODON_URL'), contact: url('PUBLIC_CONTACT_URL', '', true),
  };
}

export const route = (config, path = '') => `${config.basePath}/${path.replace(/^\//, '')}`;
