import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  FlaskConical, CheckCircle2, Flag, BookOpen, ListChecks,
  Layers, ChevronLeft, ChevronRight, X, ClipboardCheck,
  Search, BarChart2, RotateCcw, AlertCircle, Clock, Shuffle,
  GraduationCap, Award, ArrowRight,
} from "lucide-react";

/* ====================================================================
   CORPUS I — MRCOG Part 1 (production / Supabase build)
   SBA-only. 14 basic-science modules. Mock = equal weighting, 2.5 hrs.
   Reads questions from its own Supabase project. Progress = localStorage.
   ==================================================================== */

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function transformRow(row) {
  return {
    id: row.id, type: "SBA", module: row.module, difficulty: row.difficulty,
    flags: row.flags || [], stem: row.stem, lead: row.lead, options: row.options,
    correct: row.correct, explanation: row.explanation,
    whyWrong: row.why_wrong, teaching: row.teaching, ref: row.ref,
  };
}

const PROG_KEY = "corpus1:progress:v1";
function loadProg() { try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); } catch { return {}; } }
function saveProg(p) { try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch {} }

const MODULES = [
  "Physiology", "Endocrinology", "Biochemistry",
  "Anatomy", "Embryology", "Genetics",
  "Biophysics", "Epidemiology & Statistics", "Data Interpretation", "Pharmacology",
  "Immunology", "Microbiology", "Pathology", "Clinical Management",
];
const DOMAIN = {
  "Physiology":"Cell Function","Endocrinology":"Cell Function","Biochemistry":"Cell Function",
  "Anatomy":"Human Structure","Embryology":"Human Structure","Genetics":"Human Structure",
  "Biophysics":"Measurement & Manipulation","Epidemiology & Statistics":"Measurement & Manipulation",
  "Data Interpretation":"Measurement & Manipulation","Pharmacology":"Measurement & Manipulation",
  "Immunology":"Illness","Microbiology":"Illness","Pathology":"Illness","Clinical Management":"Illness",
};

const MOCK_TOTAL = 100;
const MOCK_SECONDS = 2.5 * 60 * 60;
const PASS_MARK = 60;

const G = {
  blue: "#1e3a8a", blueMid: "#2563eb", blueSoft: "#e8eefc",
  paper: "#f4f6fa", ink: "#1a2233", muted: "#5f6675", line: "#d8dde8",
  green: "#0f6e56", greenSoft: "#e1f5ee",
  amber: "#854f0b", amberSoft: "#faeeda",
  red: "#a32d2d", redSoft: "#fceaea", white: "#ffffff",
};

function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function buildMock(bank){
  const target=Math.min(MOCK_TOTAL,bank.length);
  const byMod={};bank.forEach(q=>{(byMod[q.module]||=[]).push(q);});
  Object.keys(byMod).forEach(m=>{byMod[m]=shuffle(byMod[m]);});
  const perMod=Math.round(target/MODULES.length);
  const picked=[];const used=new Set();
  MODULES.forEach(m=>{(byMod[m]||[]).slice(0,perMod).forEach(q=>{picked.push(q);used.add(q.id);});});
  if(picked.length<target){for(const q of shuffle(bank.filter(q=>!used.has(q.id)))){if(picked.length>=target)break;picked.push(q);used.add(q.id);}}
  return shuffle(picked).slice(0,target);
}
function scoreCard(q,answers){return answers[q.id]===q.correct?1:0;}
function fmtTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;}

function Pill({children,tone="neutral"}){const t={neutral:{bg:"#e9ecf3",c:G.ink},hard:{bg:"#faece7",c:"#712b13"},mod:{bg:G.amberSoft,c:G.amber},type:{bg:G.blueSoft,c:G.blue}};const s=t[tone]||t.neutral;return <span style={{background:s.bg,color:s.c,padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:500}}>{children}</span>;}
function Ref({r}){if(!r)return null;return <p style={{fontSize:11,fontStyle:"italic",color:G.blue,margin:"5px 0 0",display:"flex",alignItems:"center",gap:4}}><BookOpen size={10}/>{r}</p>;}
function FlagBtn({onFlag,already}){
  const [open,setOpen]=useState(false);
  const reasons=["Answer key looks wrong","Fact may be out of date","Ambiguous — two correct answers","Typo or unclear stem"];
  if(already)return <span style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:G.redSoft,color:G.red,display:"flex",alignItems:"center",gap:4}}><Flag size={11}/>Flagged</span>;
  if(!open)return <button onClick={()=>setOpen(true)} style={{fontSize:12,padding:"4px 12px",borderRadius:99,border:`1px solid ${G.line}`,background:G.white,color:G.amber,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Flag size={12}/>Flag</button>;
  return <div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:10,padding:8,display:"flex",flexDirection:"column",gap:2}}>{reasons.map(r=><button key={r} onClick={()=>{onFlag(r);setOpen(false);}} style={{fontSize:12,textAlign:"left",padding:"5px 10px",borderRadius:6,background:"none",border:"none",cursor:"pointer",color:G.ink}}>{r}</button>)}<button onClick={()=>setOpen(false)} style={{fontSize:11,color:G.muted,background:"none",border:"none",cursor:"pointer",padding:"3px 10px",textAlign:"left"}}>Cancel</button></div>;
}
function SBABody({q,pick,onPick,reveal}){
  return (<>
    <p style={{fontSize:15,lineHeight:1.7,marginBottom:12}}>{q.stem}</p>
    <p style={{fontSize:14,fontStyle:"italic",color:G.muted,marginBottom:14}}>{q.lead}</p>
    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
      {(q.options||[]).map(o=>{let bg=G.white,bdr=G.line,lc=G.muted;if(reveal){if(o.l===q.correct){bg=G.greenSoft;bdr=G.green;lc=G.green;}else if(pick===o.l){bg=G.redSoft;bdr=G.red;lc=G.red;}}else if(pick===o.l){bg=G.blueSoft;bdr=G.blueMid;lc=G.blue;}
        return <button key={o.l} disabled={reveal} onClick={()=>!reveal&&onPick&&onPick(o.l)} style={{textAlign:"left",fontSize:14,padding:"10px 14px",borderRadius:9,border:`1px solid ${bdr}`,background:bg,cursor:reveal?"default":"pointer",display:"flex",gap:10,lineHeight:1.55}}><span style={{fontWeight:600,color:lc,minWidth:20}}>{o.l}.</span><span>{o.t}</span></button>;})}
    </div>
    {reveal&&<div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:10,padding:14,fontSize:13,lineHeight:1.7}}>
      <p style={{fontWeight:600,color:G.green,marginBottom:6,display:"flex",alignItems:"center",gap:6}}><CheckCircle2 size={14}/>Answer: {q.correct} — {(q.options||[]).find(o=>o.l===q.correct)?.t}</p>
      <p style={{marginBottom:8}}>{q.explanation}</p>
      <p style={{color:G.muted,marginBottom:8}}><strong>Why the distractors fail:</strong> {q.whyWrong}</p>
      <p style={{borderLeft:`2px solid ${G.blue}`,paddingLeft:10,color:G.muted,marginBottom:6}}><strong>What it&apos;s really testing:</strong> {q.teaching}</p>
      <Ref r={q.ref}/>
    </div>}
  </>);
}

function Practice({bank,flagQuestion,prog,persistProg}){
  const [mod,setMod]=useState("all");const [seed,setSeed]=useState(0);
  const [idx,setIdx]=useState(0);const [sbaAns,setSbaAns]=useState({});
  const pool=useMemo(()=>shuffle(bank.filter(q=>(mod==="all"||q.module===mod))),[bank,mod,seed]);
  useEffect(()=>setIdx(0),[mod,seed]);
  const q=pool[idx];
  if(!q)return <p style={{color:G.muted,fontSize:14}}>No questions match this filter.</p>;
  function pickSBA(l){if(sbaAns[q.id])return;setSbaAns({...sbaAns,[q.id]:l});persistProg({...prog,[q.id]:l===q.correct?"correct":"wrong"});}
  const c=Object.values(prog).filter(v=>v==="correct").length;const w=Object.values(prog).filter(v=>v==="wrong").length;
  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
      <select value={mod} onChange={e=>setMod(e.target.value)} style={{fontSize:13,padding:"6px 10px",borderRadius:7,border:`1px solid ${G.line}`,background:G.white}}><option value="all">All modules</option>{MODULES.map(m=><option key={m} value={m}>{m}</option>)}</select>
      <button onClick={()=>setSeed(s=>s+1)} style={{fontSize:12,padding:"6px 12px",borderRadius:7,border:`1px solid ${G.line}`,background:G.white,color:G.blue,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Shuffle size={13}/>Shuffle</button>
      <div style={{marginLeft:"auto",display:"flex",gap:14,alignItems:"center"}}><span style={{fontSize:13,color:G.green,display:"flex",alignItems:"center",gap:4}}><CheckCircle2 size={14}/>{c}</span><span style={{fontSize:13,color:G.red,display:"flex",alignItems:"center",gap:4}}><X size={14}/>{w}</span></div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><div style={{flex:1,height:5,borderRadius:99,background:"#e3e7f0",overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:G.blueMid,width:`${((idx+1)/pool.length)*100}%`,transition:"width 0.3s"}}/></div><span style={{fontSize:12,color:G.muted,whiteSpace:"nowrap"}}>{idx+1} / {pool.length}</span></div>
    <div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:14,padding:22}}>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}><Pill tone="type">SBA</Pill><Pill tone={q.difficulty==="Hard"?"hard":"mod"}>{q.difficulty}</Pill><Pill>{q.module}</Pill><div style={{marginLeft:"auto"}}><FlagBtn onFlag={r=>flagQuestion(q.id,r)} already={q.flags?.length>0}/></div></div>
      <SBABody q={q} pick={sbaAns[q.id]} onPick={pickSBA} reveal={!!sbaAns[q.id]}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}><button disabled={idx===0} onClick={()=>setIdx(idx-1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:idx===0?"not-allowed":"pointer",opacity:idx===0?0.4:1,display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Previous</button><button disabled={idx===pool.length-1} onClick={()=>setIdx(idx+1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:idx===pool.length-1?"not-allowed":"pointer",opacity:idx===pool.length-1?0.4:1,display:"flex",alignItems:"center",gap:6}}>Next<ChevronRight size={15}/></button></div>
  </div>);
}

function MockExam({bank}){
  const [phase,setPhase]=useState("idle");const [examQs,setExamQs]=useState([]);const [answers,setAnswers]=useState({});
  const [idx,setIdx]=useState(0);const [timeLeft,setTimeLeft]=useState(MOCK_SECONDS);const [reviewIdx,setReviewIdx]=useState(null);const timerRef=useRef(null);
  useEffect(()=>{if(phase!=="running")return;timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){clearInterval(timerRef.current);setPhase("results");return 0;}return t-1;});},1000);return ()=>clearInterval(timerRef.current);},[phase]);
  function start(){setExamQs(buildMock(bank));setAnswers({});setIdx(0);setTimeLeft(MOCK_SECONDS);setReviewIdx(null);setPhase("running");}
  function finish(){clearInterval(timerRef.current);setPhase("results");}
  if(phase==="idle"){
    const projected=Math.min(MOCK_TOTAL,bank.length);
    return(<div style={{textAlign:"center",padding:"30px 0"}}>
      <GraduationCap size={40} style={{color:G.blue,margin:"0 auto 14px"}}/>
      <h2 style={{fontSize:22,fontFamily:"Georgia,serif",margin:"0 0 8px"}}>Mock Examination</h2>
      <p style={{fontSize:14,color:G.muted,maxWidth:470,margin:"0 auto",lineHeight:1.6}}>{projected} SBAs · 2.5-hour timer · equal weighting across all 14 basic-science modules. No feedback until you finish — just like the real Paper.</p>
      {bank.length<MOCK_TOTAL&&<p style={{fontSize:12,color:G.amber,maxWidth:470,margin:"10px auto 0",lineHeight:1.5}}>Bank currently holds {bank.length} questions. Full 100-question papers unlock as the bank grows.</p>}
      <div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:12,padding:18,maxWidth:430,margin:"20px auto",textAlign:"left"}}><p style={{fontSize:13,fontWeight:600,marginBottom:8}}>Before you start</p><ul style={{fontSize:13,color:G.muted,lineHeight:1.7,margin:0,paddingLeft:18}}><li>The timer runs continuously — refreshing the page ends the exam</li><li>You can end early and still get a full breakdown</li><li>Unanswered questions count as incorrect (scored over all {projected})</li><li>Pass mark shown at {PASS_MARK}%</li></ul></div>
      <button onClick={start} disabled={bank.length===0} style={{padding:"11px 26px",fontSize:14,fontWeight:600,borderRadius:10,background:G.blue,color:"#fff",border:"none",cursor:bank.length?"pointer":"not-allowed",opacity:bank.length?1:0.5,display:"inline-flex",alignItems:"center",gap:8}}>Begin mock <ArrowRight size={16}/></button>
    </div>);
  }
  if(phase==="results"){
    const totalScore=examQs.reduce((s,q)=>s+scoreCard(q,answers),0);const pct=examQs.length?Math.round((totalScore/examQs.length)*100):0;const passed=pct>=PASS_MARK;
    const attempted=examQs.filter(q=>answers[q.id]).length;
    const doms={};examQs.forEach(q=>{const d=DOMAIN[q.module];(doms[d]||={n:0,s:0});doms[d].n++;doms[d].s+=scoreCard(q,answers);});
    if(reviewIdx!==null){const q=examQs[reviewIdx];
      return(<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><button onClick={()=>setReviewIdx(null)} style={{fontSize:13,padding:"7px 14px",borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Back to results</button><span style={{fontSize:13,color:G.muted}}>Review {reviewIdx+1} / {examQs.length}</span></div>
        <div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:14,padding:22}}><div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}><Pill tone="type">SBA</Pill><Pill>{q.module}</Pill></div><SBABody q={q} pick={answers[q.id]} reveal={true}/></div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}><button disabled={reviewIdx===0} onClick={()=>setReviewIdx(reviewIdx-1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:reviewIdx===0?"not-allowed":"pointer",opacity:reviewIdx===0?0.4:1,display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Prev</button><button disabled={reviewIdx===examQs.length-1} onClick={()=>setReviewIdx(reviewIdx+1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:reviewIdx===examQs.length-1?"not-allowed":"pointer",opacity:reviewIdx===examQs.length-1?0.4:1,display:"flex",alignItems:"center",gap:6}}>Next<ChevronRight size={15}/></button></div>
      </div>);
    }
    return(<div style={{textAlign:"center"}}>
      <Award size={40} style={{color:passed?G.blue:G.amber,margin:"10px auto 12px"}}/>
      <h2 style={{fontSize:20,fontFamily:"Georgia,serif",margin:"0 0 4px"}}>Mock complete</h2>
      <p style={{fontSize:56,fontWeight:700,color:passed?G.blue:G.amber,margin:"6px 0",lineHeight:1}}>{pct}%</p>
      <p style={{fontSize:14,fontWeight:600,color:passed?G.blue:G.amber,margin:"0 0 4px"}}>{passed?"Above the pass line":"Below the pass line"} ({PASS_MARK}%)</p>
      <p style={{fontSize:13,color:G.muted,margin:"0 0 22px"}}>{totalScore} correct over {examQs.length} questions · {attempted} attempted · {examQs.length-attempted} left blank</p>
      <div style={{maxWidth:520,margin:"0 auto 22px",textAlign:"left"}}><p style={{fontSize:13,fontWeight:600,marginBottom:10}}>By domain</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{Object.entries(doms).sort((a,b)=>b[1].n-a[1].n).map(([m,d])=>{const p=Math.round((d.s/d.n)*100);return <div key={m} style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:9,padding:"9px 13px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12}}>{m}</span><span style={{fontSize:12,color:G.muted}}>{d.s}/{d.n} · {p}%</span></div><div style={{height:4,borderRadius:99,background:"#e3e7f0",overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:p>=PASS_MARK?G.blueMid:G.amber,width:`${p}%`}}/></div></div>;})}</div></div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}><button onClick={()=>setReviewIdx(0)} style={{padding:"10px 20px",fontSize:13,fontWeight:600,borderRadius:9,background:G.blue,color:"#fff",border:"none",cursor:"pointer"}}>Review all answers</button><button onClick={()=>setPhase("idle")} style={{padding:"10px 20px",fontSize:13,fontWeight:500,borderRadius:9,border:`1px solid ${G.line}`,background:G.white,cursor:"pointer"}}>New mock</button></div>
    </div>);
  }
  const q=examQs[idx];const lowTime=timeLeft<300,midTime=timeLeft<900;
  const answeredCount=examQs.filter(x=>answers[x.id]).length;
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,fontSize:18,fontWeight:700,fontVariantNumeric:"tabular-nums",color:lowTime?G.red:midTime?G.amber:G.ink,background:lowTime?G.redSoft:midTime?G.amberSoft:G.white,padding:"6px 14px",borderRadius:10,border:`1px solid ${lowTime?G.red:midTime?G.amber:G.line}`}}><Clock size={18}/>{fmtTime(timeLeft)}</div>
      <span style={{fontSize:13,color:G.muted}}>{answeredCount} / {examQs.length} answered</span>
      <button onClick={()=>{if(window.confirm("End the exam now and see your score?"))finish();}} style={{fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:9,background:G.red,color:"#fff",border:"none",cursor:"pointer"}}>End exam</button>
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:14}}>{examQs.map((x,i)=>{const done=answers[x.id];return <button key={x.id} onClick={()=>setIdx(i)} style={{width:26,height:26,borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer",border:`1px solid ${i===idx?G.blue:G.line}`,background:i===idx?G.blue:done?G.blueSoft:G.white,color:i===idx?"#fff":done?G.blue:G.muted}}>{i+1}</button>;})}</div>
    <div style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:14,padding:22}}><div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}><Pill tone="type">SBA</Pill><Pill>{q.module}</Pill><span style={{marginLeft:"auto",fontSize:12,color:G.muted}}>Q{idx+1}</span></div><SBABody q={q} pick={answers[q.id]} onPick={l=>setAnswers({...answers,[q.id]:l})} reveal={false}/></div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}><button disabled={idx===0} onClick={()=>setIdx(idx-1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:idx===0?"not-allowed":"pointer",opacity:idx===0?0.4:1,display:"flex",alignItems:"center",gap:6}}><ChevronLeft size={15}/>Previous</button>{idx===examQs.length-1?<button onClick={()=>{if(window.confirm("Submit the exam and see your score?"))finish();}} style={{padding:"8px 18px",fontSize:13,fontWeight:600,borderRadius:8,background:G.blue,color:"#fff",border:"none",cursor:"pointer"}}>Submit exam</button>:<button onClick={()=>setIdx(idx+1)} style={{padding:"8px 16px",fontSize:13,borderRadius:8,border:`1px solid ${G.line}`,background:G.white,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>Next<ChevronRight size={15}/></button>}</div>
  </div>);
}

function BankView({bank}){const [search,setSearch]=useState("");const [mod,setMod]=useState("all");const f=bank.filter(q=>{const h=`${q.module} ${q.stem||""}`.toLowerCase();return h.includes(search.toLowerCase())&&(mod==="all"||q.module===mod);});return(<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:18}}>{[["Total",bank.length,G.ink],["SBA",bank.length,G.blue],["Modules",new Set(bank.map(q=>q.module)).size,G.blueMid],["Flagged",bank.filter(q=>q.flags?.length>0).length,G.red]].map(([l,n,c])=>(<div key={l} style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:10,padding:"10px 14px"}}><p style={{fontSize:11,color:G.muted,margin:0}}>{l}</p><p style={{fontSize:22,fontWeight:600,color:c,margin:0}}>{n}</p></div>))}</div><div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}><div style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:8,border:`1px solid ${G.line}`,background:G.white,minWidth:160}}><Search size={14} style={{color:G.muted}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stem, module…" style={{flex:1,fontSize:13,border:"none",outline:"none",background:"transparent"}}/></div><select value={mod} onChange={e=>setMod(e.target.value)} style={{fontSize:13,padding:"6px 10px",borderRadius:8,border:`1px solid ${G.line}`,background:G.white}}><option value="all">All modules</option>{MODULES.map(m=><option key={m} value={m}>{m}</option>)}</select></div><div style={{display:"flex",flexDirection:"column",gap:8}}>{f.map(q=>(<div key={q.id} style={{background:G.white,border:`1px solid ${q.flags?.length>0?G.red:G.line}`,borderRadius:10,padding:14}}><div style={{display:"flex",gap:7,marginBottom:6,flexWrap:"wrap",alignItems:"center"}}><Pill tone="type">SBA</Pill><Pill tone={q.difficulty==="Hard"?"hard":"mod"}>{q.difficulty}</Pill><Pill>{q.module}</Pill>{q.flags?.length>0&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:G.redSoft,color:G.red}}>Flagged</span>}</div><p style={{fontSize:13,color:"#414a5c",lineHeight:1.55,margin:0}}>{(q.stem||"").slice(0,140)}…</p>{q.ref&&<p style={{fontSize:11,fontStyle:"italic",color:G.blue,marginTop:4,display:"flex",alignItems:"center",gap:3}}><BookOpen size={10}/>{q.ref}</p>}</div>))}</div></div>);}
function Stats({bank,prog,persistProg}){const total=Object.keys(prog).length;const correct=Object.values(prog).filter(v=>v==="correct").length;const pct=total?Math.round((correct/total)*100):0;const byMod=MODULES.map(m=>{const mQs=bank.filter(q=>q.module===m);const att=mQs.filter(q=>prog[q.id]);const cor=mQs.filter(q=>prog[q.id]==="correct");return{module:m,total:mQs.length,attempted:att.length,correct:cor.length};}).filter(x=>x.total>0);return(<div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:22}}>{[["Attempted",total,G.ink],["Correct",correct,G.green],["Wrong",total-correct,G.red],["Score",total?`${pct}%`:"—",pct>=60?G.blue:G.amber]].map(([l,n,c])=>(<div key={l} style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:10,padding:"12px 14px"}}><p style={{fontSize:11,color:G.muted,margin:0}}>{l}</p><p style={{fontSize:22,fontWeight:600,color:c,margin:0}}>{n}</p></div>))}</div><p style={{fontSize:13,fontWeight:500,marginBottom:10}}>Practice performance by module</p><div style={{display:"flex",flexDirection:"column",gap:6}}>{byMod.map(({module,total,attempted,correct})=>{const p=attempted?Math.round((correct/attempted)*100):0;return(<div key={module} style={{background:G.white,border:`1px solid ${G.line}`,borderRadius:9,padding:"10px 14px"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:13}}>{module}</span><span style={{fontSize:12,color:G.muted}}>{attempted}/{total} · {attempted?`${p}%`:"—"}</span></div><div style={{height:4,borderRadius:99,background:"#e3e7f0",overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:p>=60?G.blueMid:G.amber,width:`${(attempted/total)*100}%`}}/></div></div>);})}</div><button onClick={()=>{if(window.confirm("Reset all practice progress?"))persistProg({});}} style={{marginTop:18,fontSize:12,padding:"7px 14px",borderRadius:8,border:`1px solid ${G.line}`,background:G.white,color:G.red,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><RotateCcw size={13}/>Reset my progress</button></div>);}
function FlaggedView({bank,clearFlag}){const flagged=bank.filter(q=>q.flags?.length>0);if(!flagged.length)return <div style={{textAlign:"center",padding:"48px 0"}}><ClipboardCheck size={32} style={{color:G.blue,margin:"0 auto 10px"}}/><p style={{fontSize:14,color:G.muted}}>No flagged questions. All clear.</p></div>;return(<div><p style={{fontSize:13,color:G.muted,marginBottom:14}}>Flagged by trainees. Reviewed and updated periodically.</p><div style={{display:"flex",flexDirection:"column",gap:10}}>{flagged.map(q=>(<div key={q.id} style={{background:G.white,border:`1px solid ${G.red}`,borderRadius:10,padding:14}}><div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}><Pill tone="type">SBA</Pill><Pill>{q.module}</Pill></div><p style={{fontSize:13,lineHeight:1.6,marginBottom:8}}>{(q.stem||"").slice(0,160)}…</p><div style={{background:G.redSoft,borderRadius:7,padding:8,marginBottom:10,fontSize:12,color:G.red}}>{(q.flags||[]).map((f,i)=><p key={i} style={{margin:0}}>• {f.reason} <span style={{color:G.muted}}>({f.date})</span></p>)}</div><button onClick={()=>clearFlag(q.id)} style={{fontSize:12,padding:"5px 12px",borderRadius:7,border:`1px solid ${G.line}`,background:G.white,cursor:"pointer",color:G.muted}}>Clear flag</button></div>))}</div></div>);}

export default function App(){
  const [bank,setBank]=useState([]);
  const [prog,setProg]=useState(loadProg());
  const [view,setView]=useState("practice");
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);
  useEffect(()=>{(async()=>{
    const {data,error}=await supabase.from("questions").select("*").order("id");
    if(error){setErr(error.message);setLoading(false);return;}
    setBank(shuffle((data||[]).map(transformRow)));setLoading(false);
  })();},[]);
  async function flagQuestion(qid,reason){
    const q=bank.find(x=>x.id===qid);const newFlags=[...(q.flags||[]),{reason,date:new Date().toISOString().slice(0,10)}];
    const {error}=await supabase.from("questions").update({flags:newFlags}).eq("id",qid);
    if(!error)setBank(bank.map(x=>x.id===qid?{...x,flags:newFlags}:x));
  }
  async function clearFlag(qid){const {error}=await supabase.from("questions").update({flags:[]}).eq("id",qid);if(!error)setBank(bank.map(x=>x.id===qid?{...x,flags:[]}:x));}
  const persistProg=useCallback((next)=>{setProg(next);saveProg(next);},[]);
  const flagged=bank.filter(q=>q.flags?.length>0);
  const total=Object.keys(prog).length;const correct=Object.values(prog).filter(v=>v==="correct").length;const pct=total?Math.round((correct/total)*100):null;
  const tabs=[{k:"practice",label:"Practice",icon:ListChecks},{k:"mock",label:"Mock Exam",icon:GraduationCap},{k:"bank",label:"Question Bank",icon:Layers},{k:"stats",label:"My Stats",icon:BarChart2},{k:"flagged",label:`Flagged${flagged.length?` (${flagged.length})`:""}`,icon:Flag}];
  return(<div style={{background:G.paper,minHeight:"100vh",fontFamily:"ui-sans-serif,system-ui,sans-serif",color:G.ink}}>
    <header style={{background:G.white,borderBottom:`1px solid ${G.line}`,padding:"12px 20px"}}><div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:10,background:G.blue,display:"flex",alignItems:"center",justifyContent:"center"}}><FlaskConical size={22} color="#fff"/></div><div><h1 style={{fontSize:21,fontWeight:700,fontFamily:"Georgia,serif",margin:0,lineHeight:1.1,letterSpacing:0.3}}>Corpus<span style={{color:G.blueMid}}> I</span></h1><p style={{fontSize:12,color:G.muted,margin:0}}>MRCOG Part 1</p></div></div><div style={{display:"flex",gap:18}}><div style={{textAlign:"right"}}><p style={{fontSize:11,color:G.muted,margin:0}}>Questions</p><p style={{fontSize:22,fontWeight:600,color:G.blue,margin:0}}>{bank.length}</p></div><div style={{textAlign:"right"}}><p style={{fontSize:11,color:G.muted,margin:0}}>Score</p><p style={{fontSize:22,fontWeight:600,margin:0,color:pct===null?G.muted:pct>=60?G.blue:G.amber}}>{pct===null?"—":`${pct}%`}</p></div></div></div></header>
    <nav style={{background:G.white,borderBottom:`1px solid ${G.line}`,padding:"0 20px"}}><div style={{maxWidth:860,margin:"0 auto",display:"flex",gap:2,flexWrap:"wrap"}}>{tabs.map(({k,label,icon:Icon})=>(<button key={k} onClick={()=>setView(k)} style={{padding:"10px 14px",fontSize:13,fontWeight:500,color:view===k?G.blue:G.muted,background:"none",border:"none",borderBottom:`2px solid ${view===k?G.blue:"transparent"}`,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon size={14}/>{label}</button>))}</div></nav>
    <main style={{maxWidth:860,margin:"0 auto",padding:"24px 20px"}}>
      {loading&&<div style={{textAlign:"center",padding:"60px 0"}}><p style={{color:G.muted,fontSize:14}}>Loading questions…</p></div>}
      {err&&<div style={{padding:16,borderRadius:10,background:G.redSoft,color:G.red,fontSize:13,display:"flex",gap:8,alignItems:"flex-start"}}><AlertCircle size={16} style={{marginTop:1,flexShrink:0}}/><div><strong>Could not load questions.</strong> Check your Supabase environment variables in Vercel.<br/><code style={{fontSize:11}}>{err}</code></div></div>}
      {!loading&&!err&&view==="practice"&&<Practice bank={bank} flagQuestion={flagQuestion} prog={prog} persistProg={persistProg}/>}
      {!loading&&!err&&view==="mock"&&<MockExam bank={bank}/>}
      {!loading&&!err&&view==="bank"&&<BankView bank={bank}/>}
      {!loading&&!err&&view==="stats"&&<Stats bank={bank} prog={prog} persistProg={persistProg}/>}
      {!loading&&!err&&view==="flagged"&&<FlaggedView bank={bank} clearFlag={clearFlag}/>}
    </main>
    <footer style={{maxWidth:860,margin:"16px auto 0",padding:"14px 20px",borderTop:`1px solid ${G.line}`}}><p style={{fontSize:11,color:"#8a90a0",textAlign:"center",margin:0,lineHeight:1.7}}>Basic sciences for MRCOG Part 1 · Aligned to standard basic-science references</p></footer>
  </div>);
}
