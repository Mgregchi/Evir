import {fileURLToPath} from 'node:url';
import {serveBuild} from '../../tools/static-server.mjs';
await serveBuild(fileURLToPath(new URL('./dist/',import.meta.url)),8788);
