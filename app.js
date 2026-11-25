
let MODEL=null, GROUPS=null, LAST=null;
const $=id=>document.getElementById(id);
const NFEAT=()=>MODEL?MODEL.features.length:0;
const validOdd=x=>Number.isFinite(x)&&x>=1.01;

const niceGroup=s=>s.replaceAll("_"," ")
  .replace(/\bOU\b/g,"O/U")
  .replace(/\bFT\b/g,"Full-time")
  .replace(/\bHT\b/g,"1st half");

async function init(){
  const [m,g]=await Promise.all([
    fetch("model.json").then(r=>r.json()),
    fetch("features.json").then(r=>r.json())
  ]);
  MODEL=m;
  GROUPS=g;
  renderMarkets();
  loadHistory();
}

function renderMarkets(){
  const root=$("markets");
  root.innerHTML="";

  Object.entries(GROUPS).forEach(([group,items],idx)=>{
    const d=document.createElement("details");
    d.className="market";
    d.open=idx<3;

    const s=document.createElement("summary");
    s.textContent=niceGroup(group)+" · "+items.length+" outcomes";
    d.appendChild(s);

    const body=document.createElement("div");
    body.className="marketbody";

    const grid=document.createElement("div");
    grid.className="fieldgrid";

    items.forEach(item=>{
      const wrap=document.createElement("div");
      wrap.className="field";

      const lab=document.createElement("label");
      lab.htmlFor="f_"+item.key;
      lab.textContent=item.label;

      const inp=document.createElement("input");
      inp.type="number";
      inp.step="0.01";
      inp.min="1.01";
      inp.inputMode="decimal";
      inp.placeholder="Odds";
      inp.id="f_"+item.key;
      inp.dataset.feature=item.key;

      wrap.append(lab,inp);
      grid.appendChild(wrap);
    });

    body.appendChild(grid);
    d.appendChild(body);
    root.appendChild(d);
  });
}

function values(){
  const out={};
  document.querySelectorAll("[data-feature]").forEach(el=>{
    const v=el.value.trim();
    out[el.dataset.feature]=v===""?null:Number(v);
  });
  return out;
}

function calculate(v){
  const x=MODEL.features.map((f,i)=>
    validOdd(v[f])?v[f]:MODEL.means[i]
  );

  const z=x.map((n,i)=>(n-MODEL.means[i])/MODEL.scales[i]);

  const dot=(coef,intercept)=>
    intercept+z.reduce((a,n,i)=>a+n*coef[i],0);

  const hr=dot(MODEL.home_coef,MODEL.home_intercept);
  const ar=dot(MODEL.away_coef,MODEL.away_intercept);

  const hg=Math.max(0,Math.round(Math.max(hr,0)));
  const ag=Math.max(0,Math.round(Math.max(ar,0)));

  const diffs=MODEL.features.map((f,i)=>({
    feature:f,
    impact:z[i]*(MODEL.home_coef[i]-MODEL.away_coef[i])
  }));

  diffs.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact));

  return {
    homeRaw:hr,
    awayRaw:ar,
    homeGoals:hg,
    awayGoals:ag,
    score:`${hg}-${ag}`,
    outcome:hg>ag?"Home win":hg===ag?"Draw":"Away win",
    missing:MODEL.features.filter(f=>!validOdd(v[f])).length,
    drivers:diffs.slice(0,8)
  };
}

function predict(){
  const v=values();
  const r=calculate(v);

  LAST={
    ...r,
    homeTeam:$("homeTeam").value.trim()||"Home",
    awayTeam:$("awayTeam").value.trim()||"Away",
    supplied:NFEAT()-r.missing,
    values:v,
    created:new Date().toISOString(),
    saved:false
  };

  $("matchName").textContent=LAST.homeTeam+" vs "+LAST.awayTeam;
  $("score").textContent=LAST.score;
  $("outcome").textContent=LAST.outcome;
  $("rawHome").textContent=LAST.homeRaw.toFixed(4);
  $("rawAway").textContent=LAST.awayRaw.toFixed(4);
  $("supplied").textContent=LAST.supplied+" / "+NFEAT();
  $("imputed").textContent=LAST.missing;

  $("drivers").innerHTML=
    "<b>Largest model contributions (not causal explanations)</b><br>"+
    r.drivers.map(d=>
      `${d.feature.replaceAll("__"," / ").replaceAll("_"," ")}: ${d.impact>=0?"+":""}${d.impact.toFixed(3)} toward home side`
    ).join("<br>");

  $("resultCard").style.display="block";
  $("resultCard").scrollIntoView({
    behavior:"smooth",
    block:"start"
  });
}

function csvEscape(v){
  const s=String(v??"");
  return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}

function download(name,content,type="text/csv"){
  const a=document.createElement("a");
  const url=URL.createObjectURL(
    new Blob([content],{type})
  );
  a.href=url;
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportInputs(){
  const v=values();
  const rows=[
    ["Feature","Odds"],
    ...MODEL.features.map(f=>[f,v[f]??""])
  ];
  download(
    "16_market_odds.csv",
    rows.map(r=>r.map(csvEscape).join(",")).join("\n")
  );
}

function parseCSV(text){
  // Strip the byte-order mark Excel adds, otherwise "Feature" is not found.
  const lines=text.replace(/^﻿/,"").trim().split(/\r?\n/);

  const parse=line=>{
    let a=[],cur="",q=false;

    for(let i=0;i<line.length;i++){
      let c=line[i];

      if(c==='"'&&line[i+1]==='"'){
        cur+='"';
        i++;
      }else if(c==='"'){
        q=!q;
      }else if(c===","&&!q){
        a.push(cur);
        cur="";
      }else{
        cur+=c;
      }
    }

    a.push(cur);
    return a;
  };

  const header=parse(lines.shift()).map(x=>x.trim());
  const fi=header.indexOf("Feature");
  const oi=header.indexOf("Odds");

  if(fi<0||oi<0)
    throw Error("CSV must have Feature and Odds columns.");

  const map={};

  lines.forEach(l=>{
    const r=parse(l);
    if(r[fi])map[r[fi]]=r[oi];
  });

  return map;
}

$("predictBtn").onclick=predict;

$("clearBtn").onclick=()=>{
  document.querySelectorAll("[data-feature]").forEach(x=>x.value="");
  $("resultCard").style.display="none";
  LAST=null;
};

$("exportCsv").onclick=exportInputs;

$("importBtn").onclick=()=>$("csvFile").click();

$("csvFile").onchange=async e=>{
  try{
    const m=parseCSV(await e.target.files[0].text());

    document.querySelectorAll("[data-feature]").forEach(el=>{
      if(m[el.dataset.feature]!==undefined)
        el.value=m[el.dataset.feature];
    });

    alert("CSV imported. Check the odds, then calculate.");
  }catch(err){
    alert(err.message);
  }

  e.target.value="";
};

$("fillDemo").onclick=()=>{
  const demo={
    "FT_1X2__Home":1.8,
    "FT_1X2__Draw":4.1,
    "FT_1X2__Away":4.2
  };

  document.querySelectorAll("[data-feature]").forEach(el=>{
    el.value=demo[el.dataset.feature]??"";
  });

  alert("Only three example values filled. This is not a real match prediction until all available odds are entered.");
};

function getHistory(){
  return JSON.parse(localStorage.getItem("predHistory")||"[]");
}

function saveHistory(){
  if(!LAST)return;
  if(LAST.saved){
    alert("This prediction is already saved.");
    return;
  }

  let arr=getHistory();
  const {saved,...rec}=LAST;
  arr.unshift({...rec,actualScore:""});
  arr=arr.slice(0,100);

  localStorage.setItem("predHistory",JSON.stringify(arr));
  LAST.saved=true;
  loadHistory();
}

// "2 - 1", "2:1", " 2-1 " all become "2-1".
function normScore(score){
  const m=String(score||"").trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  return m?`${+m[1]}-${+m[2]}`:null;
}

function outcomeOf(score){
  const s=normScore(score);
  if(!s)return null;

  const [h,a]=s.split("-").map(Number);

  return h>a?"Home win":h===a?"Draw":"Away win";
}

function loadHistory(){
  const arr=getHistory();
  const root=$("history");
  root.innerHTML="";

  if(!arr.length){
    root.textContent="No saved predictions on this device yet.";
  }

  arr.forEach((x,i)=>{
    const d=document.createElement("div");
    d.className="historyitem";

    const title=document.createElement("div");
    title.style.fontWeight="700";
    title.textContent=
      `${x.homeTeam} ${x.score} ${x.awayTeam} · ${x.outcome}`;

    const date=document.createElement("div");
    date.className="small";
    date.textContent=new Date(x.created).toLocaleString();

    const row=document.createElement("div");
    row.className="row";
    row.style.marginTop="8px";

    const inp=document.createElement("input");
    inp.type="text";
    inp.placeholder="Actual score, e.g. 2-1";
    inp.value=x.actualScore||"";
    inp.setAttribute("aria-label","Actual score");

    const save=document.createElement("button");
    save.textContent="Save result";

    save.onclick=()=>{
      const actual=outcomeOf(inp.value);

      if(!actual){
        alert("Enter the actual score as 2-1.");
        return;
      }

      arr[i].actualScore=normScore(inp.value);
      localStorage.setItem("predHistory",JSON.stringify(arr));
      loadHistory();
    };

    const status=document.createElement("div");
    status.className="small";
    status.style.marginTop="6px";

    if(x.actualScore){
      const ao=outcomeOf(x.actualScore);
      const exact=normScore(x.actualScore)===x.score;

      status.textContent=
        `Actual: ${x.actualScore} · ${ao} · Outcome ${ao===x.outcome?"correct":"incorrect"} · Exact score ${exact?"correct":"incorrect"}`;
    }else{
      status.textContent="Awaiting actual result";
    }

    row.append(inp,save);
    d.append(title,date,row,status);
    root.appendChild(d);
  });

  const settled=arr.filter(x=>outcomeOf(x.actualScore));
  const correct=settled.filter(x=>
    outcomeOf(x.actualScore)===x.outcome
  );
  const exact=settled.filter(x=>
    normScore(x.actualScore)===x.score
  );

  $("nPred").textContent=arr.length;
  $("nSettled").textContent=settled.length;

  $("outAcc").textContent=settled.length?
    (100*correct.length/settled.length).toFixed(1)+"%":"—";

  $("scoreAcc").textContent=settled.length?
    (100*exact.length/settled.length).toFixed(1)+"%":"—";
}

$("saveResult").onclick=saveHistory;

$("clearHistory").onclick=()=>{
  if(confirm("Delete saved predictions on this device?")){
    localStorage.removeItem("predHistory");
    loadHistory();
  }
};

$("downloadResult").onclick=()=>{
  if(!LAST)return;

  const rows=[
    ["Home","Away","Raw home","Raw away","Score","Outcome","Inputs supplied","Mean imputed"],
    [LAST.homeTeam,LAST.awayTeam,LAST.homeRaw,LAST.awayRaw,LAST.score,LAST.outcome,LAST.supplied,LAST.missing]
  ];

  download(
    "prediction_result.csv",
    rows.map(r=>r.map(csvEscape).join(",")).join("\n")
  );
};

// ============================================
// IMPROVED OCR MARKET RECOGNITION ENGINE
// ============================================

let OCR_MATCHES={};

function cleanOcrLine(s){
  return String(s||"")
    .replace(/[|¦]/g," ")
    .replace(/[‐‑‒–—]/g,"-")
    .replace(/\s+/g," ")
    .trim();
}

function oddsIn(s){
  return [...String(s).matchAll(
    /(?<![\d.])(\d{1,3}[.,]\d{2})(?![\d.])/g
  )]
    .map(m=>({
      v:Number(m[1].replace(",",".")),
      i:m.index
    }))
    .filter(x=>
      Number.isFinite(x.v)&&x.v>=1.01&&x.v<=1000
    );
}

// Like oddsIn, but also recovers prices where OCR dropped the decimal
// point: "2290" -> 22.90, "153" -> 1.53. Marked rep:true.
function oddsLoose(s){
  const str=String(s);
  const good=oddsIn(str);
  const fixed=[...str.matchAll(/(?<![\d.,:\-])(\d{3,4})(?![\d.,:\-])/g)]
    .map(m=>({v:Number(m[1])/100,i:m.index,rep:true,raw:m[1]}))
    .filter(x=>x.v>=1.01&&x.v<=100);
  return [...good,...fixed].sort((a,b)=>a.i-b.i);
}

// Site grid order for Correct Score (row by row): 0:0 1:0 2:0 3:0 4:0 0:1 ...
const CS_ORDER=[0,1,2,3,4].flatMap(a=>[0,1,2,3,4].map(h=>`${h}-${a}`));

function putFrom(out,key,o,line){
  putMatch(out,key,o.v,line);
  if(o.rep&&out[key]&&!out[key].conflict){
    out[key].repaired=o.raw;
  }
}

function putMatch(out,key,odd,line){
  if(!key||!Number.isFinite(odd)||odd<1.01||odd>1000)return;

  if(out[key]&&Math.abs(out[key].odd-odd)>.001){
    out[key].conflict=true;
    out[key].alternatives=[out[key].odd,odd];
    return;
  }

  out[key]={odd,line};
}

// Unlabelled single value: recorded for review but never auto-filled.
function putUncertain(out,key,odd,line){
  if(out[key])return;
  out[key]={odd,line,uncertain:true};
}

// Markets the model does not use. Seeing one of these headers must stop
// the previous market from swallowing its odds.
const OTHER_MARKET=/odd\s*\/\s*even|highest scoring|ht\s*\/\s*ft|half\s*time\s*\/\s*full|clean sheet|win to nil|exact goals|multi\s*goals?|corner|card|booking|penalt|draw no bet|winning margin|\s(?:&|\+)\s|\band\b.*(?:o\s*\/\s*u|gg|1x2)/;

function parseMarketOCR(raw){
  const lines=String(raw||"")
    .split(/\r?\n/)
    .map(cleanOcrLine)
    .filter(Boolean);

  const out={};
  let active=null;
  const lastLine={};   // last O/U goal line seen per market
  let csPrev=-1;       // index of last correct-score cell assigned
  let half=false;

  for(const line of lines){
    const lo=line.toLowerCase();

    // Screenshots are consecutive scrolls, so the market at the bottom
    // of one usually continues at the top of the next (e.g. O/U 5.5).
    // Keep the active market; just skip the boundary marker.
    if(/next screenshot/.test(lo))continue;

    // Status bar / app header / footer lines repeated on every screenshot.
    if(/instant football|main goals|betslip|next round|\bngn\b|\bvs\b|^\d{1,2}:\d{2}\s+\S/.test(lo))continue;

    const lineOdds=oddsIn(line);

    // Must run BEFORE the 1X2 / O/U / Double Chance checks, otherwise
    // "2nd Half 1X2" or "1X2 & O/U" is read as the full-time market.
    if(/2nd\s*half|second half/.test(lo) ||
       (!lineOdds.length&&OTHER_MARKET.test(lo))){
      active=null;
      half=false;
      continue;
    }

    // FIRST HALF MARKETS

    if(/1st\s*half\s*1x2/.test(lo)){
      half=true;
      active="HT_1X2";
      continue;
    }

    if(/1st\s*half\s*(o\s*\/\s*u|0\s*\/\s*u|over\s*\/\s*under)/.test(lo)){
      half=true;
      active="HT_OU";
      continue;
    }

    if(/1st\s*half\s*double chance/.test(lo)){
      half=true;
      active="HT_Double_Chance";
      continue;
    }

    if(/1st\s*half.*first goal/.test(lo)){
      active="HT_First_Goal";
      continue;
    }

    // Any other 1st-half market (e.g. 1st Half Correct Score) is not a
    // model feature; stop it falling through to the full-time parsers.
    if(/1st\s*half|first half/.test(lo)&&!lineOdds.length){
      active=null;
      half=true;
      continue;
    }

    // FULL TIME 1X2 SPECIAL MARKETS

    if(/1x2.*1up/.test(lo)){
      half=false;
      active="FT_1X2_1UP";
      continue;
    }

    if(/1x2.*2up/.test(lo)){
      half=false;
      active="FT_1X2_2UP";
      continue;
    }

    // CORRECT SCORE

    if(/incorrect score/.test(lo)){
      active="Incorrect_Score_proxy";
      half=false;
      continue;
    }

    if(/correct score/.test(lo)){
      active="Correct_Score";
      csPrev=-1;
      half=false;
      continue;
    }

    // TEAM GOALS

    if(/home team\s*(o\s*\/\s*u|0\s*\/\s*u|over|under)/.test(lo)){
      active="Home_Team_OU";
      half=false;
      continue;
    }

    if(/away team\s*(o\s*\/\s*u|0\s*\/\s*u|over|under)/.test(lo)){
      active="Away_Team_OU";
      half=false;
      continue;
    }

    if(/teams? to score/.test(lo)){
      active="Teams_to_Score";
      half=false;
      continue;
    }

    if(/gg\s*\/\s*ng/.test(lo)){
      active="GG_NG";
      half=false;
      continue;
    }

    if(/handicap/.test(lo)){
      active="HANDICAP";
      half=false;
      continue;
    }

    if(/double chance/.test(lo)){
      active="FT_Double_Chance";
      half=false;
      continue;
    }

    if(/first goal/.test(lo)){
      active="HT_First_Goal";
      continue;
    }

    // FULL TIME 1X2
    // Now accepts preceding OCR symbols such as "v 1X2".

    if(/\b1x2\b/.test(lo)){
      active="FT_1X2";
      half=false;
      continue;
    }

    // FULL TIME O/U
    // Accepts O/U, 0/U and Over/Under.

    if(/\b(?:o|0)\s*\/\s*u\b/.test(lo) ||
       /\bover\s*\/\s*under\b/.test(lo)){
      active=half?"HT_OU":"FT_OU";
      continue;
    }

    const odds=lineOdds;

    if(!odds.length||!active)continue;

    // 1X2 MARKETS

    if([
      "FT_1X2",
      "FT_1X2_1UP",
      "FT_1X2_2UP",
      "HT_1X2"
    ].includes(active)){

      const labels=[
        ...lo.matchAll(/\b(home|draw|away)\b/g)
      ].map(m=>m[1]);

      if(labels.length>=3&&odds.length>=3){
        labels.slice(0,3).forEach((lab,j)=>{
          putMatch(
            out,
            `${active}__${lab[0].toUpperCase()+lab.slice(1)}`,
            odds[j].v,
            line
          );
        });
      }else if(labels.length===0&&odds.length===3){
        // OCR often puts "Home Draw Away" on its own line and the
        // three prices on the next; take them in screen order.
        ["Home","Draw","Away"].forEach((k,j)=>{
          putMatch(out,`${active}__${k}`,odds[j].v,line);
        });
      }

      continue;
    }

    // DOUBLE CHANCE

    if([
      "FT_Double_Chance",
      "HT_Double_Chance"
    ].includes(active)){
      const dc=odds.length>=3?odds:oddsLoose(line);
      if(dc.length>=3){
        ["1X","12","X2"].forEach((k,j)=>{
          putFrom(out,`${active}__${k}`,dc[j],line);
        });
      }
      continue;
    }

    // GG / NG

    if(active==="GG_NG"){
      if(odds.length>=2){
        putMatch(out,"GG_NG__GG_Yes",odds[0].v,line);
        putMatch(out,"GG_NG__NG_No",odds[1].v,line);
      }
      continue;
    }

    // TEAMS TO SCORE

    if(active==="Teams_to_Score"){
      const rules=[
        [/\bnone\b/i,"None"],
        [/only\s*home/i,"Only_Home"],
        [/only\s*away/i,"Only_Away"],
        [/both\s*teams|both\b/i,"Both"]
      ];

      let found=false;

      for(const [re,k] of rules){
        const hit=re.exec(line);

        if(hit){
          const val=odds.find(x=>x.i>=hit.index);

          if(val){
            putMatch(out,`Teams_to_Score__${k}`,val.v,line);
            found=true;
          }
        }
      }

      if(!found&&odds.length>=4){
        ["None","Only_Home","Only_Away","Both"].forEach((k,j)=>{
          putMatch(out,`Teams_to_Score__${k}`,odds[j].v,line);
        });
      }

      continue;
    }

    // FIRST HALF FIRST GOAL

    if(active==="HT_First_Goal"){
      if(odds.length>=3){
        ["Home","None","Away"].forEach((k,j)=>{
          putMatch(out,`HT_First_Goal__${k}`,odds[j].v,line);
        });
      }
      continue;
    }

    // HANDICAP MARKETS

    if(active==="HANDICAP"){
      const h=line.match(
        /\b(0\s*[:\-]\s*1|0\s*[:\-]\s*2|1\s*[:\-]\s*0|2\s*[:\-]\s*0)\b/
      );

      const ho=odds.length>=3?odds:oddsLoose(line).filter(x=>!h||x.i>h.index+h[0].length);
      if(h&&ho.length>=3){
        const key={
          "0-1":"Handicap_0_1",
          "0-2":"Handicap_0_2",
          "1-0":"Handicap_1_0",
          "2-0":"Handicap_2_0"
        }[
          h[1].replace(/\s/g,"").replace(":","-")
        ];

        if(key){
          ["Home","Draw","Away"].forEach((k,j)=>{
            putFrom(out,`${key}__${k}`,ho[j],line);
          });
        }
      }

      continue;
    }

    // OVER / UNDER MARKETS
    // Allows a single visible odds value.
    // A locked opposite selection must not erase
    // the available selection.

    if([
      "FT_OU",
      "HT_OU",
      "Home_Team_OU",
      "Away_Team_OU"
    ].includes(active)){

      const head=line.slice(0,odds[0].i).trim();

      // Goal line: "2.5", "2,5", "2:5", "25", and slips like "225".
      const m=head.match(
        /^(?:(?:over|under)\s*)?([0-5])(?:\s*[.,:]\s*|\d?)5\)?$/i
      );

      let n=m?Number(m[1])+0.5:null;
      let byOrder=false;

      // Unreadable goal line (e.g. "2.9", "Ly") on a normal two-price
      // row: rows always run 0.5, 1.5, 2.5 ... so take the next one.
      if(n===null&&odds.length===2&&lastLine[active]!=null&&
         head.length<=5&&/\d/.test(head)){
        n=lastLine[active]+1;
        byOrder=true;
      }

      if(n!==null&&odds.length){

        if(n>=0.5&&n<=5.5){
          lastLine[active]=n;

          if(byOrder){
            putMatch(out,`${active}__Over_${n}`,odds[0].v,line);
            putMatch(out,`${active}__Under_${n}`,odds[1].v,line);
            [`${active}__Over_${n}`,`${active}__Under_${n}`].forEach(k=>{
              if(out[k]&&!out[k].conflict){
                out[k].repaired=head;
                out[k].why="goal line unreadable, taken from row order";
              }
            });
          }else

          if(odds.length>=2){
            // Two visible columns: Over then Under.
            putMatch(out,`${active}__Over_${n}`,odds[0].v,line);
            putMatch(out,`${active}__Under_${n}`,odds[1].v,line);
          }else{
            // One price (other side locked). Only trust it if the
            // line says which side it is; otherwise flag for review
            // instead of assuming it is Over.
            const hasOver=/\bover\b/.test(lo),hasUnder=/\bunder\b/.test(lo);
            if(hasOver&&!hasUnder){
              putMatch(out,`${active}__Over_${n}`,odds[0].v,line);
            }else if(hasUnder&&!hasOver){
              putMatch(out,`${active}__Under_${n}`,odds[0].v,line);
            }else{
              putUncertain(out,`${active}__Over_${n}`,odds[0].v,line);
            }
          }
        }
      }

      continue;
    }

    // CORRECT SCORE

    if([
      "Correct_Score",
      "Incorrect_Score_proxy"
    ].includes(active)){

      const loose=oddsLoose(line);
      const scores=[...line.matchAll(/\b([0-4])\s*[:\-]\s*([0-4])\b/g)]
        .map(x=>({k:`${x[1]}-${x[2]}`,i:x.index,end:x.index+x[0].length}));
      const other=/\bother\b/i.exec(line);
      const otherAt=other?other.index:Infinity;

      let prevPriceAt=-1;

      loose.filter(o=>o.i<otherAt).forEach(o=>{
        // The label for a price is the score written between the
        // previous price and this one. Previously "3:0 2290 4:0 62.27"
        // gave 3-0 the 4-0 price.
        const lab=[...scores].reverse()
          .find(sc=>sc.end<=o.i&&sc.i>prevPriceAt);
        prevPriceAt=o.i;

        if(lab){
          putFrom(out,`${active}__${lab.k}`,o,line);
          csPrev=CS_ORDER.indexOf(lab.k);
          return;
        }

        // Garbled label (e.g. "4 Ie 9.92"): Correct Score cells are
        // always in grid order, so infer it from the previous cell, but
        // only fill when the NEXT label on the line confirms the guess.
        if(active!=="Correct_Score"||csPrev<0)return;
        const guess=csPrev+1;
        if(guess>=CS_ORDER.length)return;
        const next=scores.find(sc=>sc.i>o.i);
        const key=`${active}__${CS_ORDER[guess]}`;
        if(next&&CS_ORDER.indexOf(next.k)===guess+1){
          putFrom(out,key,o,line);
          if(out[key]&&!out[key].conflict){
            out[key].repaired=out[key].repaired||line.slice(Math.max(0,o.i-6),o.i).trim();
            out[key].why="score label unreadable, taken from grid order";
          }
        }else{
          putUncertain(out,key,o.v,line);
        }
        csPrev=guess;
      });

      if(active==="Correct_Score"&&other){
        const odd=loose.find(x=>x.i>other.index);
        if(odd)putFrom(out,"Correct_Score__Other",odd,line);
      }

      continue;
    }
  }

  return out;
}

// ============================================
// OCR REPORT
// ============================================

function showOcrReport(){
  const entries=Object.entries(OCR_MATCHES);

  const conflicts=entries.filter(([,v])=>v.conflict);

  const uncertain=entries.filter(([,v])=>v.uncertain);
  const repaired=entries.filter(([,v])=>v.repaired);

  const missing=MODEL.features.filter(k=>!OCR_MATCHES[k]);

  // Keys the parser produced that the model has no field for:
  // usually a naming mismatch with features.json.
  const unknown=entries.filter(([k])=>!MODEL.features.includes(k));

  const names=entries.map(([k,v])=>
    `${k.replaceAll("__"," / ")}: ${v.odd.toFixed(2)}${v.conflict?" ⚠ conflict "+v.alternatives.map(x=>x.toFixed(2)).join(" vs "):""}${v.uncertain?" ? side unclear, not filled":""}${v.repaired?` ⚙ ${v.why||"decimal point restored"} (read "${v.repaired}"), check`:""}${MODEL.features.includes(k)?"":" ✗ no such model field"}`
  );

  $("ocrOdds").textContent=
    `Matched ${entries.length}/${NFEAT()} features. Conflicts: ${conflicts.length}. Unclear: ${uncertain.length}. Repaired: ${repaired.length}. Unknown keys: ${unknown.length}. Not found: ${missing.length}.\n`+
    (repaired.length?
      `\nREPAIRED (OCR text was damaged; check these against the screenshot):\n`+
      repaired.map(([k,v])=>`  ${k.replaceAll("__"," / ")}: ${v.odd.toFixed(2)}  (${v.why||"decimal point restored"}; OCR read "${v.repaired}")`).join("\n")+"\n"
      :"")+
    (missing.length?
      `\nNOT FOUND (enter manually or add a screenshot):\n  ${missing.join("\n  ")}\n\n`
      :"\n")+
    names.join("\n");
}

// ============================================
// OCR SCREENSHOT PROCESSING
// ============================================

// Enlarge small images (e.g. WhatsApp copies) and convert to grayscale.
// In testing this raised correct reads from 68 to 102 of 103 odds.
async function prepareForOcr(file){
  try{
    const bmp=await createImageBitmap(file);
    const scale=bmp.width<1000?2:1;
    const c=document.createElement("canvas");
    c.width=Math.round(bmp.width*scale);
    c.height=Math.round(bmp.height*scale);
    const ctx=c.getContext("2d");
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    if("filter" in ctx)ctx.filter="grayscale(1)";
    ctx.drawImage(bmp,0,0,c.width,c.height);
    bmp.close?.();
    return c;
  }catch(e){
    return file; // older browsers: use the original image
  }
}

$("runOcr").onclick=async()=>{
  const files=[...($("ocrFiles").files||[])];

  if(!files.length){
    alert("Choose at least one screenshot.");
    return;
  }

  if(!window.Tesseract){
    $("ocrStatus").textContent=
      "OCR engine did not load. Connect to the internet and reload the app.";
    return;
  }

  $("ocrStatus").textContent="Starting OCR engine…";

  let texts=[];
  let current=0;
  let worker=null;

  try{
    worker=await Tesseract.createWorker("eng",1,{
      logger:m=>{
        if(m.status==="recognizing text"){
          $("ocrStatus").textContent=
            `OCR ${current+1}/${files.length}: ${Math.round((m.progress||0)*100)}%`;
        }
      }
    });

    // Mode 6 = one uniform block: reads the odds grid row by row.
    // The default mode read the Correct Score grid column by column.
    await worker.setParameters({tessedit_pageseg_mode:"6"});

    for(let i=0;i<files.length;i++){
      current=i;
      $("ocrStatus").textContent=
        `Reading screenshot ${i+1} of ${files.length}…`;

      const img=await prepareForOcr(files[i]);
      const result=await worker.recognize(img);

      texts.push(result.data.text||"");
    }

    const all=texts.join(
      "\n\n--- NEXT SCREENSHOT ---\n\n"
    );

    $("ocrText").value=all;

    OCR_MATCHES=parseMarketOCR(all);

    showOcrReport();

    $("ocrStatus").textContent=
      `OCR complete. Identified ${Object.keys(OCR_MATCHES).length} market-feature matches. Review the mapping report before filling.`;

  }catch(e){
    $("ocrStatus").textContent="OCR failed: "+e.message;
  }finally{
    if(worker)worker.terminate().catch(()=>{});
  }
};

// ============================================
// COPY OCR TEXT
// ============================================

$("copyOcr").onclick=()=>{
  if(!$("ocrText").value)return;

  navigator.clipboard?.writeText($("ocrText").value).then(
    ()=>alert("OCR text copied."),
    ()=>alert("Copy not available in this browser.")
  );
};

// ============================================
// FILL MATCHED ODDS
// ============================================

$("fillOcr").onclick=()=>{
  const entries=Object.entries(OCR_MATCHES)
    .filter(([,v])=>!v.conflict&&!v.uncertain);

  if(!entries.length){
    alert(
      "No reliable market-to-feature matches were found. Check the OCR text and screenshots."
    );
    return;
  }

  const conflicts=Object.entries(OCR_MATCHES)
    .filter(([,v])=>v.conflict||v.uncertain).length;

  if(!confirm(
    `Fill ${entries.length} recognised odds into their matching market fields? ${conflicts} conflicting or unclear fields will be skipped. Existing values will be replaced where a match is found.`
  )){
    return;
  }

  // Without this, odds left over from the previous match stay in the
  // fields that this OCR run did not find, and feed the prediction.
  if(confirm("Also clear every field NOT found in these screenshots? (Recommended when switching to a new match.)")){
    document.querySelectorAll("[data-feature]").forEach(el=>el.value="");
  }

  entries.forEach(([key,v])=>{
    const el=document.querySelector(
      `[data-feature="${CSS.escape(key)}"]`
    );

    if(el){
      el.value=v.odd.toFixed(2);
    }
  });

  $("ocrStatus").textContent=
    `Filled ${entries.length} market-matched fields. ${conflicts} conflicting/unclear skipped. Review any fields not found before predicting.`;
};

// ============================================
// SERVICE WORKER
// ============================================

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  });
}

// ============================================
// INITIALISE APPLICATION
// ============================================

init().catch(e=>{
  document.querySelector("main").innerHTML=
    "<section class=card>Could not load model data. Make sure all app files are in the same folder and open through a web server.</section>";

  console.error(e);
});
