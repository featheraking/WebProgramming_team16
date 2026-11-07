// AI 톤 체인저 페이지 전용 스크립트

const toneInput = document.querySelector('.tone-input');
const toneOutput = document.querySelector('.tone-output');
const toneCopy = document.querySelector('.tone-copy');
const toneTarget = document.querySelector('.tone-target');
const toneTemplate = document.querySelector('.tone-template');
const toneConvert = document.querySelector('.tone-convert');
const toneCheck = document.querySelector('.tone-check');
const fillCalm = document.querySelector('.temp-fill-calm');
const fillFormal = document.querySelector('.temp-fill-formal');
const badgeBanmal = document.querySelector('.badge-banmal');
const badgeChosung = document.querySelector('.badge-chosung');
const badgeEmoticon = document.querySelector('.badge-emoticon');
const badgeShort = document.querySelector('.badge-short');
const toneError = document.querySelector('.tone-error');

const fakeResult = {
    converted: '교수님, 안녕하세요. 과제 제출 기한이 언제까지인지 여쭤봐도 될까요?',
    banmal: ['알겠어'],
    chosung: ['ㅋㅋ'],
    emoticon: ['😂'],
    shortWord: ['넵넵'],
    honorific: ['여쭤봐도', '드립니다']
};


function setBadge(badge, list) { // 목록이 비어 있지 않으면 배지를 빨갛게
    const on = list.length > 0;
    badge.classList.toggle('bg-danger', on);
    badge.classList.toggle('bg-secondary', !on);
}

function fakeServer(callback) { // 서버 대신: 1.5초 뒤에 가짜 답을 넘겨줌
    setTimeout(() => {
        callback(fakeResult);
    }, 1500);
}

function showAnalysis(result, text) { // 배지 + 감정 온도 막대 표시
    setBadge(badgeBanmal, result.banmal); // 배지 색 변환
        setBadge(badgeChosung, result.chosung);
        setBadge(badgeEmoticon, result.emoticon);
        setBadge(badgeShort, result.shortWord);

        const banmalCount = result.banmal.length; 
        const chosungCount = result.chosung.length;
        const emoticonCount = result.emoticon.length;
        const shortCount = result.shortWord.length;
        const honorificCount = result.honorific.length;
        const exclamationCount = (text.match(/!/g) || []).length; // !개수 세기 
        const periodCount = (text.match(/\./g) || []).length;     // .개수 세기

        let formalScore = 50 + honorificCount*10 - banmalCount*10 - chosungCount*10 - emoticonCount*10 - shortCount*10; // 격식 점수 계산
        let calmScore = 50 + periodCount*10 - exclamationCount*10 - emoticonCount*10; // 감정 점수 계산

        formalScore = Math.max(0, Math.min(100,formalScore)); // 격식 점수 보정
        fillFormal.style.height = formalScore + '%';
        fillFormal.classList.toggle('temp-low', formalScore < 50); // 격식 막대 움직임 

        calmScore = Math.max(0, Math.min(100,calmScore)); // 감정 점수 보정
        fillCalm.style.height = calmScore + '%';
        fillCalm.classList.toggle('temp-low', calmScore < 50); // 감정 막대 움직임
}

toneCheck.addEventListener('click', () => {  // 톤 검사 버튼
    const text = toneInput.value.trim();
    toneError.textContent = '';
    if (text === '') {
        setTimeout(() => {
            toneError.textContent = '문장을 입력해 주세요';
        }, 100);
        return;
    }
    toneCheck.disabled = true;           // 기다리는 동안 못 누르게
    toneCheck.textContent = '검사중';

    console.log(text);   // 확인용

    fakeServer((result) => {               // 답이 오면 이 안이 실행됨
        showAnalysis(result, text);

        toneCheck.disabled = false;      // 다시 누를 수 있게
        toneCheck.textContent = '톤 검사';
    });
});
toneConvert.addEventListener('click', () => { // 톤 변환 버튼
    const text = toneInput.value.trim();
    toneError.textContent = '';
    if (text === '') {
        setTimeout(() => {
            toneError.textContent = '문장을 입력해 주세요';
        }, 100);
        return;
    }
    toneConvert.disabled = true;           // 기다리는 동안 못 누르게
    toneConvert.textContent = '변환중';

    const target = toneTarget.value;
    const template = toneTemplate.value;

    console.log(text, target, template);   // 확인용

    fakeServer((result) => {               // 답이 오면 이 안이 실행됨
        showAnalysis(result, text);
        
        toneOutput.value = result.converted;
        toneConvert.disabled = false;      // 다시 누를 수 있게
        toneConvert.textContent = '톤 변환';
    });
});

toneCopy.addEventListener('click', () => { // 복사버튼 누르면 결과 텍스트 복사
    navigator.clipboard.writeText(toneOutput.value);
    toneCopy.innerHTML = '<i class="fas fa-check"></i>';     // 아이콘 체크 표시로 변경
    setTimeout(() => {
        toneCopy.innerHTML = '<i class="far fa-copy"></i>';  
    }, 2000);
});

