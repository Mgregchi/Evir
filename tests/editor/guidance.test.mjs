import test from 'node:test';
import assert from 'node:assert/strict';
import {explainImport,mcpConfiguration} from '../../packages/studio/guidance.mjs';
test('editable import feedback identifies unsupported behavior without claiming corruption',()=>{
 const d=explainImport(Error('DataConverterSystemNormalizer at byte 163: outside editable import subset; original file remains unchanged'));
 assert.equal(d.type,'DataConverterSystemNormalizer');assert.equal(d.offset,163);assert.match(d.message,/data converters/);assert.match(d.message,/Viewing the original/);assert(!/corrupt/.test(d.message));
 assert.match(explainImport(Error('ViewModel at byte 100: unsupported')).message,/data binding/);assert.match(explainImport(Error('Truncated Rive file')).message,/could not convert/);
});
test('MCP setup uses absolute local paths, supports Windows and excludes fixed session IDs',()=>{
 assert.deepEqual(mcpConfiguration('/home/you/Evir/').mcpServers['evir-local'].args,['/home/you/Evir/tools/mcp-local.mjs','--project','/home/you/Evir/apps/web/assets/examples/compass.evir-project']);
 assert.equal(mcpConfiguration('C:\\Projects\\Evir').mcpServers['evir-local'].args[0],'C:/Projects/Evir/tools/mcp-local.mjs');
 for(const p of ['','~/Evir','relative/Evir','/path/to/Evir','/a/../b','/a\nsecret'])assert.throws(()=>mcpConfiguration(p));
});
