// Functional suites explicitly reveal the content they exercise; the compact layout
// itself is validated independently by compact-today.cjs.
async function openTodayPanels(page, ids=['journey','chart','project-tasks']) {
 for (const id of ids) {
  const toggle=page.locator(`[data-toggle-section="${id}"]`);
  if(await toggle.count()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 }
}
module.exports={openTodayPanels};
