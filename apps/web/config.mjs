import { readSiteAddress } from '../../tools/build-support.mjs';

export function readWebConfig(env = process.env) {
  const url = (key, fallback = '', allowMail = false) => {
    const value = (env[key] || env[`PUBLIC_${key}`] || fallback).trim();
    if (!value) return '';
    let parsed;
    try { parsed = new URL(value); } catch { throw Error(`${key} must be an absolute URL`); }
    if (!['https:', 'http:', ...(allowMail ? ['mailto:'] : [])].includes(parsed.protocol) || parsed.username || parsed.password)
      throw Error(`${key} must be a public HTTP(S) URL${allowMail ? ' or mailto link' : ''}, without credentials`);
    return parsed.href.replace(/\/$/, '');
  };
  const repository = url('REPOSITORY_URL', 'https://github.com/Mgregchi/Evir');
  const site = readSiteAddress(env);
  return {
    siteUrl: site.configured ? site.origin : '', basePath: site.basePath, repository,
    editorUrl: `${site.basePath}/editor/studio/`,
    docs: url('DOCS_URL', `${repository}/blob/main/research/README.md`),
    community: url('COMMUNITY_URL'),
    feedback: url('FEEDBACK_URL', `${repository}/issues/new`),
    newsletter: url('NEWSLETTER_URL'),
    socialX: url('SOCIAL_X_URL'), socialLinkedIn: url('SOCIAL_LINKEDIN_URL'),
    socialMastodon: url('SOCIAL_MASTODON_URL'), contact: url('CONTACT_URL', '', true),
  };
}

export const route = (config, path = '') => path === 'editor-app/' ? config.editorUrl : `${config.basePath}/${path.replace(/^\//, '')}`;
