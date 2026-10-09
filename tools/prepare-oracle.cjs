const path=require('node:path');
exports.prepare=async()=>{
  await require('esbuild').build({entryPoints:[path.join(__dirname,'runtime-oracle.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(__dirname,'.test-build/oracle.mjs')});
};
