/* DOM과 분리된 규칙: 나중에 서버로 옮길 수 있습니다. */
(function(root){
const labels={unknown:'모름',unsure:'애매함',done:'완료'};
function hours(exam,now=Date.now()){return (new Date(exam.at).getTime()-now)/3600000;}
function mode(exam,now=Date.now()){const h=hours(exam,now);return h<=0?'ended':h<=2?'last':h<=24?'cram':'normal';}
function sortByDate(exams,now=Date.now()){return [...exams].sort((a,b)=>{const endedA=hours(a,now)<=0,endedB=hours(b,now)<=0;if(endedA!==endedB)return endedA?1:-1;return new Date(a.at)-new Date(b.at);});}
function progress(e){return e.scopes.length?e.scopes.filter(s=>s.status==='done').length/e.scopes.length:0;}
function priority(e,now=Date.now()){if(hours(e,now)<=0)return -1;const weak=e.scopes.reduce((a,s)=>a+(s.status==='unknown'?1:s.status==='unsure'?.5:0),0)/Math.max(1,e.scopes.length);return 55/(1+hours(e,now)/24)+40*weak+5*(2-Number(e.readiness))/2;}
function strategy(e,now=Date.now()){
 const m=mode(e,now),tags=[...e.formats,...e.traits],urgent=m==='cram';
 if(m==='ended')return {title:'종료된 시험',text:'시험 시간이 지났습니다.'};
 if(m==='last')return {title:'시험 직전 모드',text:'새로운 범위보다 헷갈리는 내용과 이미 공부한 내용을 우선 확인해요. 반복 오답 → 핵심 공식·키워드 → 빠른 확인'};
 const steps=[];
 if(tags.includes('객관식')||tags.includes('문제은행형'))steps.push(urgent?'문제 → 오답 개념 → 다시 문제':'개념 확인 → 문제 → 오답 정리');
 if(tags.includes('계산형'))steps.push(urgent?'대표 문제 → 막힌 공식 확인 → 다시 풀기':'개념 → 공식 이해 → 유형별 문제');
 if(tags.includes('암기형'))steps.push(urgent?'핵심 암기 → 테스트 → 틀린 내용 반복':'범위별 암기 → 떠올리기 → 반복');
 if(tags.includes('서술형'))steps.push(urgent?'예상 질문 → 핵심 키워드 → 답안 틀':'개념 이해 → 답안 작성 → 빠진 키워드 확인');
 if(!steps.length)steps.push(urgent?'핵심 개념 → 스스로 테스트 → 취약 내용 확인':'개념 이해 → 스스로 설명 → 문제 확인');
 return {title:urgent?'벼락치기 모드 · 핵심부터 집중':steps.length>1?'취약 범위 중심 혼합 전략':'개념과 문제를 함께',text:steps.join(' / ')};
}
function plan(exams,budget,now=Date.now()){
 let left=Math.max(0,Math.floor(budget));const candidates=[];
 for(const e of exams){if(mode(e,now)==='ended')continue;for(const s of e.scopes){const rank=mode(e,now)==='last'?{unsure:3,done:2,unknown:0}:{unknown:3,unsure:2,done:0};candidates.push({examId:e.id,scopeId:s.id,title:s.title,examName:e.name,status:s.status,score:priority(e,now)+rank[s.status]*12,cap:Math.max(0,Math.floor(hours(e,now)*60))});}}
 candidates.sort((a,b)=>b.score-a.score);const result=[];let elapsed=0;
 for(const c of candidates){if(left<=0)break;const minutes=Math.min(c.status==='done'?20:45,left,c.cap-elapsed);if(minutes<=0)continue;result.push({...c,minutes,done:false});left-=minutes;elapsed+=minutes;}
 return result;
}
const api={labels,hours,mode,progress,priority,strategy,plan,sortByDate};root.ExamPlanner=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
