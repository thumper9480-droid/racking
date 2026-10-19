from pathlib import Path
import shutil
root=Path(__file__).resolve().parent.parent
assets=root/'app/src/main/assets'
assets.mkdir(parents=True,exist_ok=True)
for name in ['index.html','app.js','engine.js','excel.js','views.js','style.css','icon.svg','raval-template.xlsx']:
 shutil.copyfile(root/'desktop'/name,assets/name)
shutil.copytree(root/'desktop/vendor',assets/'vendor',dirs_exist_ok=True)
shutil.copyfile(root/'app/src/main/web/native-mobile.js',assets/'native-mobile.js')
p=assets/'index.html'
s=p.read_text().replace('<script defer src="app.js', '<script defer src="native-mobile.js"></script>\n    <script defer src="app.js')
s=s.replace('نسخهٔ وب ۳.۰','نسخهٔ اندروید ۳.۰')
p.write_text(s)
p=assets/'app.js';s=p.read_text().replace('    localStorage.setItem(storageKey, JSON.stringify(state));','    localStorage.setItem(storageKey, JSON.stringify(state));\n    mobileSync();').replace('  fn();\n  updateClock();','  fn();\n  mobileDecorate();\n  updateClock();').replace('function tick() {','function tick() {\n  return mobileTick();\n}\nfunction webTick() {').replace('function exportFile(content, type, name) {','function exportFile(content, type, name) {\n  AndroidNative.saveFile(name,type,content);\n}\nfunction webExportFile(content, type, name) {')
s=s.replace('E.startSeries(state, selected, id, +f.get("rest"));', 'state.mobileRestMinutes=+f.get("rest"); const next=E.blocks(state,selected).find(b=>b.id===id&&!state.completions[b.key]);if(next)E.startBlock(state,next);')
p.write_text(s)
p=assets/'style.css' ;p.write_text(p.read_text()+'''\nbody{font-size:15px}.mobile-stage-icon{text-align:center;font-size:56px;color:var(--green)}.mobile-stage-choices{display:grid;gap:12px}.mobile-stage-choices button{min-height:54px;font-size:16px}.mobile-interrupt{margin-top:14px}.mobile-interrupt button{width:100%}@media(max-width:700px){.app-main{padding-bottom:92px}.focus-column{order:-1}.sidebar{position:fixed;top:auto;bottom:0;left:0;right:0;z-index:40;background:#fff;border-top:1px solid #e0ebe8;padding:6px}.sidebar .brand,.sidebar-bottom{display:none!important}#nav{display:grid;grid-template-columns:repeat(6,1fr);overflow:visible}#nav button{display:flex;flex-direction:column;gap:2px;padding:7px 2px;font-size:10px;min-width:0}.app-main{margin:0}.focus-panel{position:relative}.timer-value{font-size:34px}.day-control{gap:4px}.day-control input{width:116px}.activity-row .part{min-width:42px;min-height:42px}.activity-row{padding:14px 3px}.summary-grid .kpi-value{font-size:19px}.timer-ring{width:210px;height:210px}}''')
print('Packaged local web UI and native integration')
