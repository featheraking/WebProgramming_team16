// URL 스캐너 페이지 전용 스크립트

const scanPage = document.querySelector('.scan-page');
const scanButton = document.querySelector('.scan-button');
const scanInput = document.querySelector('.scan-input');
const scanError = document.querySelector('.scan-error');

function isValidUrl(text) {                            // 올바른 URL인지 검사하는 함수
    if(!(text.startsWith('https://')||text.startsWith('http://')))
        text='https://'+text;                       // https를 생략하는 경우 붙여줌
    try {
        const url = new URL(text);
        const parts = url.hostname.split('.');
        return parts.length >= 2 && parts.every(p => /^[a-z0-9-]+$/.test(p)); 
                                            // abc.abc 모양을 따르고, 빈 문자열이 없다면 true반환 
    } catch {
        return false;
    }
}

scanInput.addEventListener('keydown', (event) => { // 입력창에서 엔터 눌러도 검사함
    if (event.key === 'Enter' && !event.isComposing) {
        scanButton.click();
    }
});

scanButton.addEventListener('click', () => { //검사하기 버튼 클릭시 결과 출력
    const text = scanInput.value.trim();
    scanError.textContent = '';
    if (isValidUrl(text)) {
        
        scanButton.disabled = true;          // 못 누르게
        scanButton.textContent = '검사중';
        setTimeout(() => {                      // 테스트용 타이머
            scanButton.disabled = false;         // 다시 누를 수 있게
            scanButton.textContent = '검사하기';
            scanPage.classList.add('is-scanned');                     
        }, 1500);
        
    } else {
        setTimeout(() => {
        scanError.textContent = '올바른 주소를 입력해주세요'; //빨간 안내문구 출력
        }, 100); 
    }
});
