import {webkit} from 'playwright';
import {startServers} from './server.mjs';
// Inspect focus order without changing app markup or the user's system preferences.
const servers=await startServers();const browser=await webkit.launch({headless:true});
const result=[];
try{
 const page=await browser.newPage();
 for(const kind of ['native-control','demo'])for(const key of ['Tab','Alt+Tab']){
  if(kind==='native-control')await page.setContent('<a href="#">Link</a><button id="first">First</button><button id="second">Second</button><input id="input">');
  else await page.goto(servers.url);
  await page.evaluate(()=>document.activeElement.blur());const focus=[];
  for(let i=0;i<9;i++){await page.keyboard.press(key);focus.push(await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent.slice(0,40)})));}
  result.push({kind,key,focus});
 }
}finally{await browser.close();await servers.close();}
console.log(JSON.stringify(result,null,2));
