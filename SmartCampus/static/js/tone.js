// AI 톤 체인저 페이지 전용 스크립트

const toneInput = document.querySelector('.tone-input');
const toneOutput = document.querySelector('.tone-output');
const toneCopyButton = document.querySelector('.tone-copy');
const toneTarget = document.querySelector('.tone-target');
const toneTemplate = document.querySelector('.tone-template');
const toneConvertButton = document.querySelector('.tone-convert');
const toneCheckButton = document.querySelector('.tone-check');
const toneFill = document.querySelector('.temper-fill-tone');
const badgeBanmal = document.querySelector('.badge-banmal');
const badgeChosung = document.querySelector('.badge-chosung');
const badgeEmoticon = document.querySelector('.badge-emoticon');
const badgeShort = document.querySelector('.badge-short');
const toneError = document.querySelector('.tone-error');
const toneLogs = document.querySelector('.tone-logs');

/* const fakeResult = { // 임시용
    converted: '교수님, 안녕하세요. 과제 제출 기한이 언제까지인지 여쭤봐도 될까요?',
    banmal: true,
    chosung: ['ㅋㅋ'],
    emoticon: ['😂'],
    shortWord: ['넵넵'],
    manner: ['여쭤봐도', '드립니다']
};
*/

function setBadge(badge, on) { // on이 true면 배지를 빨갛게
    badge.classList.toggle('bg-danger', on);
    badge.classList.toggle('bg-secondary', !on);
}

function askServer(data, callback) { // 서버에 물어보고, 답이 오면 callback 실행
    fetch('/tone/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data) // 데이터를 json으로 만들어서 보냄
    })
        .then(response => {
            if (!response.ok) throw new Error(); // 200번대가 아니면 실패로 처리
            return response.json();
        })
        .then(callback)
        .catch(() => { // 실패하면 오류발생, 버튼 되돌리기
            toneError.textContent = '변환에 실패했어요. 잠시 후 다시 시도해 주세요.';
            toneCheckButton.disabled = false;
            toneCheckButton.textContent = '톤 검사';
            toneConvertButton.disabled = false;
            toneConvertButton.textContent = '톤 변환';
        });
}

function showAnalysis(result, text) { // 배지 + 감정 온도 막대 표시
    setBadge(badgeBanmal, result.banmal); // 배지 색 변환 (반말은 있다/없다로 옴)
        setBadge(badgeChosung, result.chosung.length > 0);
        setBadge(badgeEmoticon, result.emoticon.length > 0);
        setBadge(badgeShort, result.shortWord.length > 0);

        const chosungCount = result.chosung.length;
        const emoticonCount = result.emoticon.length;
        const shortCount = result.shortWord.length;
        const mannerCount = result.manner.length;
        const exclamationCount = (text.match(/!/g) || []).length; // 느낌표 개수 세기

        // 문장 수: . ? ! 줄바꿈으로 자른 조각 중 비어 있지 않은 것 (최소 1)
        const sentenceCount = Math.max(1, text.split(/[.?!\n]+/).filter(s => s.trim() !== '').length);

        // 검출한 단어들을 문장 개수로 나눠서 정규화함
        const friendlyRatio = (chosungCount + emoticonCount + shortCount + exclamationCount) / sentenceCount; // 가벼움
        const mannerRatio = mannerCount / sentenceCount; // 공손함

        const MANNER_WEIGHT = 40; // 존댓말 비율 1당 +40
        const FRIENDLY_WEIGHT = 40;     // 가벼움 비율 1당 -40
        const BANMAL_PENALTY = 20;   // 반말이 있으면 -20

        let toneScore = 50 + mannerRatio * MANNER_WEIGHT - friendlyRatio * FRIENDLY_WEIGHT - (result.banmal ? BANMAL_PENALTY : 0);
        toneScore = Math.round(toneScore); // 막대 점수 계산 (윗줄)

        toneScore = Math.max(0, Math.min(100, toneScore)); // 점수 보정 (0~100사이로)
        toneFill.style.height = toneScore + '%'; // 막대 채우기
        toneFill.classList.toggle('temper-low', toneScore < 50); // 막대 색 변경
}

function loadLogs() { // 최근 기록 5개를 서버에서 받아와 목록으로 보여줌
    fetch('/tone/logs')
        .then(response => response.json()) // 응답을 js객체로 바꿈
        .then(logs => {
            toneLogs.innerHTML = '';                               // 목록 초기화
            if (logs.length === 0) {
                toneLogs.textContent = '저장된 기록이 없어요';
            }
            logs.forEach(log => {                                  // 기록 하나마다 버튼 한 줄
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'list-group-item list-group-item-action tone-log';
                button.textContent = '[' + log.recipient + '] ' + log.input_text;
                button.addEventListener('click', () => {           // 기록을 누르면 그때 화면을 다시 채움
                    const result = JSON.parse(log.analysis);       // 저장해 둔 제미나이 답을 js객체로 바꿈
                    toneInput.value = log.input_text;
                    toneTarget.value = log.recipient;
                    toneTemplate.value = log.template;
                    toneOutput.value = log.is_converted ? result.converted : ''; // 톤 검사만 했던 기록이면 결과창은 비움
                    showAnalysis(result, log.input_text);
                });
                toneLogs.appendChild(button);
            });
        });
}

loadLogs(); // 페이지를 열 때 한 번 불러옴

toneCheckButton.addEventListener('click', () => {  // 톤 검사 버튼
    const text = toneInput.value.trim();
    toneError.textContent = '';
    if (text === '') {
        setTimeout(() => {
            toneError.textContent = '문장을 입력해 주세요';
        }, 100);
        return;
    }
    toneCheckButton.disabled = true;           // 기다리는 동안 못 누르게
    toneCheckButton.textContent = '검사중';

    console.log(text);                  // 확인용

    askServer({ text: text, target: toneTarget.value, template: toneTemplate.value, isConverted: false }, (result) => {// 답이 오면 이 안이 실행됨
        showAnalysis(result, text);

        toneCheckButton.disabled = false;      // 다시 누를 수 있게
        toneCheckButton.textContent = '톤 검사';
        loadLogs();                            // 방금 저장된 기록까지 목록에 반영
    });
});
toneConvertButton.addEventListener('click', () => { // 톤 변환 버튼
    const text = toneInput.value.trim();
    toneError.textContent = '';
    if (text === '') {
        setTimeout(() => {                  // 빈 문장으로 다시 변환을 시도했을 때 문구가 잠시 없어졌다가 나타나면서 강조하는 역할
            toneError.textContent = '문장을 입력해 주세요';
        }, 100);
        return;
    }
    toneConvertButton.disabled = true;           // 기다리는 동안 못 누르게
    toneConvertButton.textContent = '변환중';

    const target = toneTarget.value;
    const template = toneTemplate.value;

    console.log(text, target, template);   // 확인용

    askServer({ text: text, target: toneTarget.value, template: toneTemplate.value,  isConverted: true }, (result) => {// 답이 오면 이 안이 실행됨
        showAnalysis(result, text);
        
        toneOutput.value = result.converted;
        toneConvertButton.disabled = false;      // 다시 누를 수 있게
        toneConvertButton.textContent = '톤 변환';
        loadLogs();                              // 방금 저장된 기록까지 목록에 반영
    });
});

toneCopyButton.addEventListener('click', () => { // 복사버튼 누르면 결과 텍스트 복사
    navigator.clipboard.writeText(toneOutput.value);
    toneCopyButton.innerHTML = '<i class="fas fa-check"></i>';     // 아이콘 체크 표시로 변경
    setTimeout(() => {
        toneCopyButton.innerHTML = '<i class="far fa-copy"></i>';  
    }, 2000);
});

