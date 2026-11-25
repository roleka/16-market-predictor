let MODEL=null, GROUPS=null, LAST=null;
const $=id=>document.getElementById(id);
const niceGroup=s=>s.replaceAll("_"," ").replace(/\bOU\b/g,"O/U").replace(/\bFT\b/g,"Full-time").replace(/\bHT\b/g,"1st half");
async function init(){
  const [m,g]=await Promise.all([fetch("model.json").then(r=>r.json()),fetch("features.json").then(r=>r.json())]);
  MODEL=m;GROUPS=g;renderMarkets();loadHistory();
}
function renderMarkets(){
  const root=$("markets");root.innerHTML="";
  Object.entries(GROUPS).forEach(([group,items],idx)=>{
    const d=document.createElement("details");d.className="market";d.open=idx<3;
    const s=document.createElement("summary");s.textContent=niceGroup(group)+" · "+items.length+" outcomes";d.appendChild(s);
    const body=document.createElement("div");body.className="marketbody";
    const grid=document.createElement("div");grid.className="fieldgrid";
    items.forEach(item=>{
      const wrap=document.createElement("div");wrap.className="field";
      const lab=document.createElement("label");lab.htmlFor="f_"+item.key;lab.textContent=item.label;
      const inp=document.createElement("input");inp.type="number";inp.step="0.01";inp.min="1.01";inp.inputMode="decimal";inp.placeholder="Odds";inp.id="f_"+item.key;inp.dataset.feature=item.key;
      wrap.append(lab,inp);grid.appendChild(wrap);
    });
    body.appendChild(grid);d.appendChild(body);root.appendChild(d);
  });
}
function values(){
  const out={};document.querySelectorAll("[data-feature]").forEach(el=>{const v=el.value.trim();out[el.dataset.feature]=v===""?null:Number(v)});
  return out;
}
function calculate(v){
  const x=MODEL.features.map((f,i)=>Number.isFinite(v[f])&&v[f]>0?v[f]:MODEL.means[i]);
  const z=x.map((n,i)=>(n-MODEL.means[i])/MODEL.scales[i]);
  const dot=(coef,intercept)=>intercept+z.reduce((a,n,i)=>a+n*coef[i],0);
  const hr=dot(MODEL.home_coef,MODEL.home_intercept), ar=dot(MODEL.away_coef,MODEL.away_intercept);
  const hg=Math.max(0,Math.round(Math.max(hr,0))),ag=Math.max(0,Math.round(Math.max(ar,0)));
  const diffs=MODEL.features.map((f,i)=>({feature:f,impact:z[i]*(MODEL.home_coef[i]-MODEL.away_coef[i])}));
  diffs.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));
  return {homeRaw:hr,awayRaw:ar,homeGoals:hg,awayGoals:ag,score:`${hg}-${ag}`,outcome:hg>ag?"Home win":hg===ag?"Draw":"Away win",missing:MODEL.features.filter(f=>!(Number.isFinite(v[f])&&v[f]>0)).length,drivers:diffs.slice(0,8)};
}
function predict(){
  const v=values();const r=calculate(v);LAST={...r,homeTeam:$("homeTeam").value.trim()||"Home",awayTeam:$("awayTeam").value.trim()||"Away",supplied:105-r.missing,values:v,created:new Date().toISOString()};
  $("matchName").textContent=LAST.homeTeam+" vs "+LAST.awayTeam;
  $("score").textContent=LAST.score;$("outcome").textContent=LAST.outcome;
  $("rawHome").textContent=LAST.homeRaw.toFixed(4);$("rawAway").textContent=LAST.awayRaw.toFixed(4);
  $("supplied").textContent=LAST.supplied+" / 105";$("imputed").textContent=LAST.missing;
  $("drivers").innerHTML="<b>Largest model contributions (not causal explanations)</b><br>"+r.drivers.map(d=>`${d.feature.replaceAll("__"," / ").replaceAll("_"," ")}: ${d.impact>=0?"+":""}${d.impact.toFixed(3)} toward home side`).join("<br>");
  $("resultCard").style.display="block";$("resultCard").scrollIntoView({behavior:"smooth",block:"start"});
}
function csvEscape(v){const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
function download(name,content,type="text/csv"){
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportInputs(){
 const rows=[["Feature","Odds"],...MODEL.features.map(f=>[f,values()[f]??""])];
 download("16_market_odds.csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"));
}
function parseCSV(text){
 const lines=text.trim().split(/\r?\n/);const parse=line=>{let a=[],cur="",q=false;for(let i=0;i<line.length;i++){let c=line[i];if(c==='"'&&line[i+1]==='"'){cur+='"';i++}else if(c==='"')q=!q;else if(c===","&&!q){a.push(cur);cur=""}else cur+=c}a.push(cur);return a};
 const header=parse(lines.shift()).map(x=>x.trim());const fi=header.indexOf("Feature"),oi=header.indexOf("Odds");
 if(fi<0||oi<0)throw Error("CSV must have Feature and Odds columns.");
 const map={};lines.forEach(l=>{const r=parse(l);if(r[fi])map[r[fi]]=r[oi]});return map;
}
$("predictBtn").onclick=predict;
$("clearBtn").onclick=()=>{document.querySelectorAll("[data-feature]").forEach(x=>x.value="");$("resultCard").style.display="none"};
$("exportCsv").onclick=exportInputs;
$("importBtn").onclick=()=>$("csvFile").click();
$("csvFile").onchange=async e=>{try{const m=parseCSV(await e.target.files[0].text());document.querySelectorAll("[data-feature]").forEach(el=>{if(m[el.dataset.feature]!==undefined)el.value=m[el.dataset.feature]});alert("CSV imported. Check the odds, then calculate.");}catch(err){alert(err.message)}e.target.value=""};
$("fillDemo").onclick=()=>{const demo={"FT_1X2__Home":1.8,"FT_1X2__Draw":4.1,"FT_1X2__Away":4.2};document.querySelectorAll("[data-feature]").forEach(el=>el.value=demo[el.dataset.feature]??"");alert("Only three example values filled. This is not a real match prediction until all available odds are entered.")};
function getHistory(){return JSON.parse(localStorage.getItem("predHistory")||"[]")}
function saveHistory(){
 if(!LAST)return;
 let arr=getHistory();arr.unshift({...LAST,actualScore:""});arr=arr.slice(0,100);
 localStorage.setItem("predHistory",JSON.stringify(arr));loadHistory();
}
function outcomeOf(score){
 const m=String(score||"").trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);if(!m)return null;
 const h=+m[1],a=+m[2];return h>a?"Home win":h===a?"Draw":"Away win";
}
function loadHistory(){
 const arr=getHistory(),root=$("history");root.innerHTML="";
 if(!arr.length){root.textContent="No saved predictions on this device yet."}
 arr.forEach((x,i)=>{
  const d=document.createElement("div");d.className="historyitem";
  const title=document.createElement("div");title.style.fontWeight="700";title.textContent=`${x.homeTeam} ${x.score} ${x.awayTeam} · ${x.outcome}`;
  const date=document.createElement("div");date.className="small";date.textContent=new Date(x.created).toLocaleString();
  const row=document.createElement("div");row.className="row";row.style.marginTop="8px";
  const inp=document.createElement("input");inp.type="text";inp.placeholder="Actual score, e.g. 2-1";inp.value=x.actualScore||"";inp.setAttribute("aria-label","Actual score");
  const save=document.createElement("button");save.textContent="Save result";save.onclick=()=>{const actual=outcomeOf(inp.value);if(!actual){alert("Enter the actual score as 2-1.");return}arr[i].actualScore=inp.value.trim().replace(":","-");localStorage.setItem("predHistory",JSON.stringify(arr));loadHistory()};
  const status=document.createElement("div");status.className="small";status.style.marginTop="6px";
  if(x.actualScore){const ao=outcomeOf(x.actualScore);const exact=x.actualScore.replace(":","-")===x.score;status.textContent=`Actual: ${x.actualScore} · ${ao} · Outcome ${ao===x.outcome?"correct":"incorrect"} · Exact score ${exact?"correct":"incorrect"}`;}
  else status.textContent="Awaiting actual result";
  row.append(inp,save);d.append(title,date,row,status);root.appendChild(d);
 });
 const settled=arr.filter(x=>outcomeOf(x.actualScore)),correct=settled.filter(x=>outcomeOf(x.actualScore)===x.outcome),exact=settled.filter(x=>String(x.actualScore||"").replace(":","-")===x.score);
 $("nPred").textContent=arr.length;$("nSettled").textContent=settled.length;
 $("outAcc").textContent=settled.length?(100*correct.length/settled.length).toFixed(1)+"%":"—";
 $("scoreAcc").textContent=settled.length?(100*exact.length/settled.length).toFixed(1)+"%":"—";
}
$("saveResult").onclick=saveHistory;
$("clearHistory").onclick=()=>{if(confirm("Delete saved predictions on this device?")){localStorage.removeItem("predHistory");loadHistory()}};
$("downloadResult").onclick=()=>{if(!LAST)return;const rows=[["Home","Away","Raw home","Raw away","Score","Outcome","Inputs supplied","Mean imputed"],[LAST.homeTeam,LAST.awayTeam,LAST.homeRaw,LAST.awayRaw,LAST.score,LAST.outcome,LAST.supplied,LAST.missing]];download("prediction_result.csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"))};
let OCR_ODDS=[];
$("runOcr").onclick=async()=>{
 const files=[...($("ocrFiles").files||[])];if(!files.length){alert("Choose at least one screenshot.");return}
 if(!window.Tesseract){$("ocrStatus").textContent="OCR engine did not load. Connect to the internet and reload the app.";return}
 $("ocrStatus").textContent="Reading screenshots…";
 let texts=[];
 try{
  for(let i=0;i<files.length;i++){
   $("ocrStatus").textContent=`Reading screenshot ${i+1} of ${files.length}…`;
   const result=await Tesseract.recognize(files[i],"eng",{logger:m=>{if(m.status==="recognizing text")$("ocrStatus").textContent=`OCR ${i+1}/${files.length}: ${Math.round((m.progress||0)*100)}%`}});
   texts.push(result.data.text);
  }
  const all=texts.join("\\n\\n--- NEXT SCREENSHOT ---\\n\\n");$("ocrText").value=all;
  OCR_ODDS=[...all.matchAll(/(?<![\d.])(\d{1,3}\.\d{2})(?![\d.])/g)].map(m=>Number(m[1])).filter(n=>n>=1.01&&n<=1000);
  $("ocrOdds").textContent=`Detected ${OCR_ODDS.length} possible decimal odds. Review the recognized text and the sequence before importing.`;
  $("ocrStatus").textContent="OCR complete. Check the extracted text for recognition errors.";
 }catch(e){$("ocrStatus").textContent="OCR failed: "+e.message}
};
$("copyOcr").onclick=()=>{if(!$("ocrText").value)return; navigator.clipboard?.writeText($("ocrText").value).then(()=>alert("OCR text copied."),()=>alert("Copy not available in this browser."))};
$("fillOcr").onclick=()=>{
 if(!OCR_ODDS.length){alert("Run OCR first.");return}
 if(!confirm(`Fill the first ${Math.min(OCR_ODDS.length,MODEL.features.length)} detected odds into the first ${Math.min(OCR_ODDS.length,MODEL.features.length)} model fields in feature order? This is only safe if the screenshots show markets in exactly that order. Continue only after reviewing the OCR text.`))return;
 const inputs=[...document.querySelectorAll("[data-feature]")];
 OCR_ODDS.slice(0,inputs.length).forEach((v,i)=>inputs[i].value=v.toFixed(2));
 alert(`Filled ${Math.min(OCR_ODDS.length,inputs.length)} fields. Verify every market/odds pairing before calculating.`);
};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
init().catch(e=>{document.querySelector("main").innerHTML="<section class=card>Could not load model data. Make sure all app files are in the same folder and open through a web server.</section>";console.error(e)});
