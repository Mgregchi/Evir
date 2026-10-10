// Exercise the same disclosures a creator uses; never force-click hidden commands.
exports.press = async (page, name) => {
  if (['New','Open project','Export .riv'].includes(name)) await page.getByRole('button',{name:'Project menu',exact:true}).click();
  if (['Rectangle','Group','Path','Bone'].includes(name)) await page.locator('#create-toggle').click();
  await page.getByRole('button',{name,exact:true}).click();
};
