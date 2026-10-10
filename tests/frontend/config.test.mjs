import assert from 'node:assert/strict';
import test from 'node:test';
import { readWebConfig, route } from '../../apps/web/config.mjs';
import { buildStudio } from '@evir/studio/build';

test('one address configures public metadata and an internal Studio route', () => {
  const config = readWebConfig({SITE_URL:'https://evir.example/'});
  assert.equal(config.siteUrl,'https://evir.example');
  assert.equal(route(config,'editor/'),'/editor/');
  assert.equal(route(config,'editor-app/'),'/editor/studio/');
  assert.equal(route(config),'/');
  assert.equal(typeof buildStudio,'function');
});

test('web and Studio paths follow a prefixed SITE_URL without a second address', () => {
  const config=readWebConfig({SITE_URL:'https://evir.example/Evir/'});
  assert.equal(config.siteUrl+route(config,'editor/'),'https://evir.example/Evir/editor/');
  assert.equal(route(config,'assets/app.mjs'),'/Evir/assets/app.mjs');
  assert.equal(route(config,'editor-app/'),'/Evir/editor/studio/');
  assert.equal(route(config),'/Evir/');
});

test('local and preview builds use their own web origin', () => {
  const config=readWebConfig({});
  assert.equal(config.siteUrl,'');
  assert.equal(config.basePath,'');
  assert.equal(config.editorUrl,'/editor/studio/');
});

test('legacy site addresses and public optional links remain compatible', () => {
  assert.deepEqual(readWebConfig({PUBLIC_SITE_URL:'https://evir.example/',PUBLIC_BASE_PATH:'/Evir/',PUBLIC_COMMUNITY_URL:'https://chat.example/join'}),readWebConfig({SITE_URL:'https://evir.example/Evir/',COMMUNITY_URL:'https://chat.example/join'}));
  assert.equal(readWebConfig({CONTACT_URL:'mailto:hello@evir.example'}).contact,'mailto:hello@evir.example');
});

test('obsolete Studio settings cannot redirect the unified app to another origin', () => {
  const config=readWebConfig({SITE_URL:'https://evir.example/',STUDIO_URL:'https://old.example/studio/',PUBLIC_EDITOR_URL:'https://old.example/',EDITOR_BASE_PATH:'/old/',EDITOR_PUBLIC_SITE_URL:'https://old.example/',PUBLIC_SITE_URL:'bad',PUBLIC_BASE_PATH:'/old/'});
  assert.equal(config.editorUrl,'/editor/studio/');
  assert.equal(config.basePath,'');
  assert.equal(config.siteUrl,'https://evir.example');
});

test('invalid site addresses and unsafe external links fail early', () => {
  for(const value of ['javascript:alert(1)','/editor/studio/','https://u:p@evir.example/','https://evir.example/a/../b/','https://evir.example/a//b/','https://evir.example/%2f/','https://evir.example/?x=1','https://evir.example/#section']) assert.throws(()=>readWebConfig({SITE_URL:value}),undefined,value);
  assert.throws(()=>readWebConfig({COMMUNITY_URL:'https://u:p@evir.example'}));
  assert.throws(()=>readWebConfig({PUBLIC_BASE_PATH:'/../'}));
});
