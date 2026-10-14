/* 같은 HTML 안에서 주소(#home, #plan, #focus)가 다른 전용 화면으로 이동합니다.
   로컬 파일로 실행해도 기존 저장 데이터를 그대로 사용할 수 있습니다. */
function goPage(route){if(location.hash==='#'+route)showPage();else location.hash=route;}
function showPage(){let route=location.hash.slice(1)||'home';if(!['home','plan','focus'].includes(route))route='home';document.querySelectorAll('[data-view]').forEach(el=>el.hidden=el.dataset.view!==route);document.querySelectorAll('[data-route]').forEach(el=>{if(el.dataset.route===route)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});document.title=({home:'시험 대시보드',plan:'오늘 공부 계획',focus:'집중 타이머'})[route]+' | Smart Campus Hub';refreshPageDetails();document.querySelector(`[data-view="${route}"] h1`).focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function refreshPageDetails(){
 const upcoming=P.sortByDate(state.exams).filter(e=>P.hours(e)>0),nearest=upcoming[0];
 $('#nearestExam').innerHTML=nearest?`<h3>${esc(nearest.name)}</h3><strong class="nearest-countdown">${dday(nearest)}</strong><p class="muted">${new Date(nearest.at).toLocaleString('ko-KR',{month:'long',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit'})}</p><p>완료 ${nearest.scopes.filter(s=>s.status==='done').length} / 전체 ${nearest.scopes.length}개 범위</p>`:'<p class="muted">예정된 시험이 없어요.<br>시험을 등록해 일정을 관리해 보세요.</p>';
 const pending=state.plan.filter(p=>!p.done),total=pending.reduce((a,p)=>a+p.minutes,0),available=Math.max(0,Math.floor(Number($('#budget').value||0)-spent()));
 $('#planSpent').textContent=Math.floor(spent())+'분';$('#planRemaining').textContent=available+'분';$('#planCount').textContent=pending.length+'개 남음';
 $('#runningBanner').classList.toggle('hidden',!state.timer);
 const result=state.lastResult;$('#sessionFeedback').classList.toggle('hidden',!result||result.day!==day());
 if(result&&result.day===day()){const diff=Math.ceil(result.seconds/60-result.expected);$('#sessionFeedback').textContent=`${result.title} · ${Math.floor(result.seconds/60)}분 ${Math.floor(result.seconds%60)}초 공부했어요. `+(result.expected&&diff>0?`예정보다 ${diff}분 더 사용했어요. `:'')+`남은 ${remaining()}분으로 계획을 다시 만들 수 있어요.`;}
 document.querySelector('.plan-footnote')?.remove();
 if(state.plan.length){$('#plan').insertAdjacentHTML('beforeend',`<div class="plan-footnote">${Math.max(0,remaining()-total)>0?`배정하지 않은 ${Math.max(0,remaining()-total)}분은 휴식이나 추가 복습에 활용하세요.`:'배정된 순서대로 하나씩 시작해 보세요.'}</div>`);}
 refreshTimerDetails();
}
function refreshTimerDetails(){
 const t=state.timer;if(!$('#timerState'))return;
 $('#timerState').textContent=t?(t.running?'● 집중 중':'Ⅱ 잠시 쉬는 중'):'시작 준비';$('#timerState').classList.toggle('paused',!!t&&!t.running);
 const exam=t?state.exams.find(e=>e.id===t.examId):null;
 $('#timerExam').textContent=exam?exam.name+' · '+dday(exam):'나만의 집중 시간';
 $('#freeStart').classList.toggle('hidden',!!t);$('#pause').classList.toggle('hidden',!t);$('#finish').classList.toggle('hidden',!t);
 const elapsed=seconds(),target=t?.expected*60||0;
 $('#timerTarget').textContent=t?(target?(elapsed>target?`계획보다 ${Math.floor((elapsed-target)/60)}분 ${Math.floor((elapsed-target)%60)}초 더 집중하고 있어요`:`목표 ${t.expected}분 · 남은 ${Math.ceil((target-elapsed)/60)}분`):'자유 공부 · 원하는 만큼 집중한 뒤 결과를 기록하세요.'):'계획에 연결하지 않고도 공부 시간을 기록할 수 있어요.';
 $('#timerProgress').style.width=target?Math.min(100,elapsed/target*100)+'%':'0%';
 $('#timerGuide').innerHTML=exam?`<h3>${esc(P.strategy(exam).title)}</h3><p>${esc(P.strategy(exam).text)}</p><p class="hint">현재 범위에 이 순서를 적용해 보세요. 공부를 마친 뒤 모름·애매함·완료 중 하나를 기록합니다.</p>`:'<p>오늘 집중할 주제를 하나 정하고 시작하세요.</p><p class="hint">자유 공부 시간도 오늘의 총 공부 시간에 포함됩니다.</p>';
 const next=state.plan.find(p=>!p.done&&!(p.examId===t?.examId&&p.scopeId===t?.scopeId));$('#timerNext').textContent=next?`${next.title} · ${next.minutes}분 (${next.examName})`:'남은 계획이 없어요. 공부를 마친 뒤 다음 계획을 만들어 보세요.';
}
window.goPage=goPage;window.refreshPageDetails=refreshPageDetails;window.refreshTimerDetails=refreshTimerDetails;
window.addEventListener('hashchange',showPage);$('#budget').addEventListener('input',refreshPageDetails);document.querySelectorAll('[data-minutes]').forEach(b=>b.addEventListener('click',refreshPageDetails));
showPage();
