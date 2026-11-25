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
let OCR_MATCHES={};
function cleanOcrLine(s){return String(s||"").replace(/[|¦]/g," ").replace(/[‐‑‒–—]/g,"-").replace(/\s+/g," ").trim()}
function oddsIn(s){return [...String(s).matchAll(/(?<![\d.])(\d{1,3}[.,]\d{2})(?![\d.])/g)].map(m=>({v:Number(m[1].replace(",",".")),i:m.index})).filter(x=>Number.isFinite(x.v)&&x.v>=1.01&&x.v<=1000)}
function putMatch(out,key,odd,line){if(!key||!Number.isFinite(odd)||odd<1.01||odd>1000)return;if(out[key]&&Math.abs(out[key].odd-odd)>.001){out[key].conflict=true;out[key].alternatives=[out[key].odd,odd];return;}out[key]={odd,line};}
function parseMarketOCR(raw){
 const lines=String(raw||"").split(/\r?\n/).map(cleanOcrLine).filter(Boolean),out={};let active=null,half=false;
 for(const line of lines){const lo=line.toLowerCase();
  if(/next screenshot/.test(lo)){active=null;continue;}
  if(/1st\s*half\s*1x2/.test(lo)){half=true;active="HT_1X2";continue;}
  if(/1st\s*half\s*(o\s*\/\s*u|over\s*\/\s*under)/.test(lo)){half=true;active="HT_OU";continue;}
  if(/1st\s*half\s*double chance/.test(lo)){half=true;active="HT_Double_Chance";continue;}
  if(/1st\s*half.*first goal/.test(lo)){active="HT_First_Goal";continue;}
  if(/1x2.*1up/.test(lo)){half=false;active="FT_1X2_1UP";continue;}
  if(/1x2.*2up/.test(lo)){half=false;active="FT_1X2_2UP";continue;}
  if(/incorrect score/.test(lo)){active="Incorrect_Score_proxy";continue;}
  if(/correct score/.test(lo)){active="Correct_Score";continue;}
  if(/home team\s*(o\s*\/\s*u|over|under)/.test(lo)){active="Home_Team_OU";continue;}
  if(/away team\s*(o\s*\/\s*u|over|under)/.test(lo)){active="Away_Team_OU";continue;}
  if(/teams? to score/.test(lo)){active="Teams_to_Score";continue;}
  if(/gg\s*\/\s*ng/.test(lo)){active="GG_NG";continue;}
  if(/handicap/.test(lo)){active="HANDICAP";continue;}
  if(/double chance/.test(lo)){active="FT_Double_Chance";continue;}
  if(/first goal/.test(lo)){active="HT_First_Goal";continue;}
  if(/^1x2\b/.test(lo)){active="FT_1X2";half=false;continue;}
  if(/^(o\s*\/\s*u|over\s*\/\s*under)\b/.test(lo)){active=half?"HT_OU":"FT_OU";continue;}
  if(/2nd half/.test(lo)){active=null;continue;}
  const odds=oddsIn(line);if(!odds.length||!active)continue;
  if(["FT_1X2","FT_1X2_1UP","FT_1X2_2UP","HT_1X2"].includes(active)){
   const labels=[...lo.matchAll(/\b(home|draw|away)\b/g)].map(m=>m[1]);if(labels.length>=3&&odds.length>=3)labels.slice(0,3).forEach((lab,j)=>putMatch(out,`${active}__${lab[0].toUpperCase()+lab.slice(1)}`,odds[j].v,line));continue;
  }
  if(["FT_Double_Chance","HT_Double_Chance"].includes(active)){if(odds.length>=3)["1X","12","X2"].forEach((k,j)=>putMatch(out,`${active}__${k}`,odds[j].v,line));continue;}
  if(active==="GG_NG"){if(odds.length>=2){putMatch(out,"GG_NG__GG_Yes",odds[0].v,line);putMatch(out,"GG_NG__NG_No",odds[1].v,line);}continue;}
  if(active==="Teams_to_Score"){
   const rules=[[/\bnone\b/i,"None"],[/only\s*home/i,"Only_Home"],[/only\s*away/i,"Only_Away"],[/both\s*teams|both\b/i,"Both"]];
   let found=false;for(const [re,k] of rules){const hit=re.exec(line);if(hit){const val=odds.find(x=>x.i>=hit.index);if(val){putMatch(out,`Teams_to_Score__${k}`,val.v,line);found=true;}}}
   if(!found&&odds.length>=4)["None","Only_Home","Only_Away","Both"].forEach((k,j)=>putMatch(out,`Teams_to_Score__${k}`,odds[j].v,line));continue;
  }
  if(active==="HT_First_Goal"){if(odds.length>=3)["Home","None","Away"].forEach((k,j)=>putMatch(out,`HT_First_Goal__${k}`,odds[j].v,line));continue;}
  if(active==="HANDICAP"){
   const h=line.match(/\b(0\s*[:\-]\s*1|0\s*[:\-]\s*2|1\s*[:\-]\s*0|2\s*[:\-]\s*0)\b/);
   if(h&&odds.length>=3){const key={"0-1":"Handicap_0_1","0-2":"Handicap_0_2","1-0":"Handicap_1_0","2-0":"Handicap_2_0"}[h[1].replace(/\s/g,"").replace(":","-")];if(key)["Home","Draw","Away"].forEach((k,j)=>putMatch(out,`${key}__${k}`,odds[j].v,line));}continue;
  }
  if(["FT_OU","HT_OU","Home_Team_OU","Away_Team_OU"].includes(active)){
   const head=line.slice(0,odds[0].i).trim(),m=head.match(/^(0?\.5|1\.5|2\.5|3\.5|4\.5|5\.5|05|15|25|35|45|55)\b/);
   if(m&&odds.length>=2){let t=m[1].replace(/^0(?=\.5)/,"");if(!t.includes("."))t=String(Number(t)/10);const n=Number(t);if(n>=.5&&n<=5.5){putMatch(out,`${active}__Over_${n}`,odds[0].v,line);putMatch(out,`${active}__Under_${n}`,odds[1].v,line);}}continue;
  }
  if(["Correct_Score","Incorrect_Score_proxy"].includes(active)){
   const re=/\b([0-4])\s*[:\-]\s*([0-4])\b/g;let m;while((m=re.exec(line))){const odd=odds.find(x=>x.i>=m.index+m[0].length);if(odd){const k=`${m[1]}-${m[2]}`;putMatch(out,`${active}__${k}`,odd.v,line);}}
   if(active==="Correct_Score"&&/\bother\b/i.test(line))putMatch(out,"Correct_Score__Other",odds[odds.length-1].v,line);continue;
  }
 }
 return out;
}
function showOcrReport(){const entries=Object.entries(OCR_MATCHES),conflicts=entries.filter(([,v])=>v.conflict),missing=MODEL.features.filter(k=>!OCR_MATCHES[k]);
 const names=entries.map(([k,v])=>`${k.replaceAll("__"," / ")}: ${v.odd.toFixed(2)}${v.conflict?" ⚠ conflict":""}`);
 $("ocrOdds").textContent=`Matched ${entries.length}/105 features. Conflicts: ${conflicts.length}. Not found: ${missing.length}.\n`+names.join("\n")+(missing.length?`\n\nNot found: ${missing.slice(0,18).join(", ")}${missing.length>18?" …":""}`:"");
}
$("runOcr").onclick=async()=>{
 const files=[...($("ocrFiles").files||[])];if(!files.length){alert("Choose at least one screenshot.");return;}
 if(!window.Tesseract){$("ocrStatus").textContent="OCR engine did not load. Connect to the internet and reload the app.";return;}
 $("ocrStatus").textContent="Reading screenshots…";let texts=[];
 try{for(let i=0;i<files.length;i++){$("ocrStatus").textContent=`Reading screenshot ${i+1} of ${files.length}…`;
  const result=await Tesseract.recognize(files[i],"eng",{logger:m=>{if(m.status==="recognizing text")$("ocrStatus").textContent=`OCR ${i+1}/${files.length}: ${Math.round((m.progress||0)*100)}%`;}});
  texts.push((result.data.lines||[]).map(x=>x.text).join("\n")||result.data.text);
 }
 const all=texts.join("\n\n--- NEXT SCREENSHOT ---\n\n");$("ocrText").value=all;OCR_MATCHES=parseMarketOCR(all);showOcrReport();
 $("ocrStatus").textContent=`OCR complete. Identified ${Object.keys(OCR_MATCHES).length} market-feature matches. Review the mapping report before filling.`;
 }catch(e){$("ocrStatus").textContent="OCR failed: "+e.message;}
};
$("copyOcr").onclick=()=>{if(!$("ocrText").value)return;navigator.clipboard?.writeText($("ocrText").value).then(()=>alert("OCR text copied."),()=>alert("Copy not available in this browser."));};
$("fillOcr").onclick=()=>{
 const entries=Object.entries(OCR_MATCHES).filter(([,v])=>!v.conflict);if(!entries.length){alert("No reliable market-to-feature matches were found. Check the OCR text and screenshots.");return;}
 const conflicts=Object.entries(OCR_MATCHES).filter(([,v])=>v.conflict).length;
 if(!confirm(`Fill ${entries.length} recognised odds into their matching market fields? This does not use sequence order. ${conflicts} conflicting fields will be skipped. Existing values will be replaced where a match is found.`))return;
 entries.forEach(([key,v])=>{const el=document.querySelector(`[data-feature="${CSS.escape(key)}"]`);if(el)el.value=v.odd.toFixed(2);});
 $("ocrStatus").textContent=`Filled ${entries.length} market-matched fields. ${conflicts} conflicts skipped. Review any fields not found before predicting.`;
};
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
init().catch(e=>{document.querySelector("main").innerHTML="<section class=card>Could not load model data. Make sure all app files are in the same folder and open through a web server.</section>";console.error(e)});
