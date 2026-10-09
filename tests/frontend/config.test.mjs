import assert from 'node:assert/strict';
import test from 'node:test';
import { readPublicConfig, route } from '../../apps/site/config.mjs';
import { readEditorConfig } from '../../apps/editor/config.mjs';

test('the same two addresses wire both apps on separate domains', () => {
  const env = { SITE_URL: 'https://evir.example/', STUDIO_URL: 'https://studio.evir.example/' };
  const site = readPublicConfig(env), editor = readEditorConfig(env);
  assert.equal(site.siteUrl, 'https://evir.example');
  assert.equal(route(site, 'editor/'), '/editor/');
  assert.equal(route(site, 'editor-app/'), 'https://studio.evir.example');
  assert.deepEqual(editor, { basePath: '', publicSiteUrl: 'https://evir.example/' });
});

test('full URL paths drive public assets and mounted Studio without extra settings', () => {
  const env = { SITE_URL: 'https://evir.example/Evir/', STUDIO_URL: 'https://evir.example/editor/studio/' };
  const site = readPublicConfig(env), editor = readEditorConfig(env);
  assert.equal(site.siteUrl + route(site, 'editor/'), 'https://evir.example/Evir/editor/');
  assert.equal(route(site, 'assets/app.mjs'), '/Evir/assets/app.mjs');
  assert.equal(site.editorUrl, 'https://evir.example/editor/studio');
  assert.deepEqual(editor, { basePath: '/editor/studio', publicSiteUrl: 'https://evir.example/Evir/' });
  assert.deepEqual(readEditorConfig({ ...env, STUDIO_URL: 'https://evir.example/editor/studio' }), editor);
});

test('local builds retain working defaults without publishing localhost metadata', () => {
  const site = readPublicConfig({});
  assert.equal(site.siteUrl, '');
  assert.equal(site.basePath, '');
  assert.equal(site.editorUrl, 'http://127.0.0.1:8788');
  assert.deepEqual(readEditorConfig({}), { basePath: '', publicSiteUrl: 'http://127.0.0.1:8787/' });
});

test('existing deployments and optional PUBLIC links remain compatible', () => {
  const modernSite = { SITE_URL: 'https://evir.example/Evir/', STUDIO_URL: 'https://studio.evir.example/studio/', COMMUNITY_URL: 'https://chat.example/join' };
  assert.deepEqual(readPublicConfig({ PUBLIC_SITE_URL: 'https://evir.example/', PUBLIC_BASE_PATH: '/Evir/', PUBLIC_EDITOR_URL: modernSite.STUDIO_URL, PUBLIC_COMMUNITY_URL: modernSite.COMMUNITY_URL }), readPublicConfig(modernSite));
  assert.deepEqual(readEditorConfig({ EDITOR_PUBLIC_SITE_URL: modernSite.SITE_URL, EDITOR_BASE_PATH: '/studio/' }), readEditorConfig(modernSite));
  assert.equal(readPublicConfig({ CONTACT_URL: 'mailto:hello@evir.example' }).contact, 'mailto:hello@evir.example');
  assert.equal(readPublicConfig({ PUBLIC_EDITOR_URL: 'https://studio.evir.example/index.html?demo=1' }).editorUrl, 'https://studio.evir.example/index.html?demo=1');
  assert.equal(readEditorConfig({ EDITOR_PUBLIC_SITE_URL: 'https://evir.example/?from=studio' }).publicSiteUrl, 'https://evir.example/?from=studio');
});

test('new addresses override obsolete settings in both deployment environments', () => {
  const env = { SITE_URL: 'https://evir.example/', STUDIO_URL: 'https://studio.evir.example/', PUBLIC_SITE_URL: 'bad', PUBLIC_BASE_PATH: '/old/', PUBLIC_EDITOR_URL: 'bad', EDITOR_PUBLIC_SITE_URL: 'bad', EDITOR_BASE_PATH: '/old/', COMMUNITY_URL: 'https://new.example/', PUBLIC_COMMUNITY_URL: 'https://old.example/' };
  assert.equal(readPublicConfig(env).basePath, '');
  assert.equal(readPublicConfig(env).community, 'https://new.example');
  assert.deepEqual(readEditorConfig(env), { basePath: '', publicSiteUrl: 'https://evir.example/' });
});

test('invalid public addresses fail before a build emits broken paths', () => {
  for (const value of ['javascript:alert(1)', '/editor/studio/', 'https://u:p@evir.example/', 'https://evir.example/a/../b/', 'https://evir.example/a//b/', 'https://evir.example/%2f/', 'https://evir.example/?x=1', 'https://evir.example/#section']) {
    for (const key of ['SITE_URL', 'STUDIO_URL']) {
      assert.throws(() => readPublicConfig({ [key]: value }), undefined, `${key}: ${value}`);
      assert.throws(() => readEditorConfig({ [key]: value }), undefined, `${key}: ${value}`);
    }
  }
  assert.throws(() => readPublicConfig({ COMMUNITY_URL: 'https://u:p@evir.example' }));
  assert.throws(() => readPublicConfig({ PUBLIC_BASE_PATH: '/../' }));
  assert.throws(() => readEditorConfig({ EDITOR_BASE_PATH: '/../' }));
});
