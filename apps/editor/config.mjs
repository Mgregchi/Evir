import { readDeploymentConfig } from '../../tools/build-support.mjs';

export function readEditorConfig(env = process.env) {
  const { site, studio } = readDeploymentConfig(env, 'editor');
  return { basePath: studio.basePath, publicSiteUrl: site.url };
}
