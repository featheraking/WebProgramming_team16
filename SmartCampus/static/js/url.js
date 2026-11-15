// URL 스캐너 페이지 전용 스크립트

const scanPage = document.querySelector('.scan-page');
const scanButton = document.querySelector('.scan-button');
const scanInput = document.querySelector('.scan-input');
const scanError = document.querySelector('.scan-error');
const redirectCount = document.querySelector('.redirect-count');
const redirectList = document.querySelector('.redirect-list');
const downloadName = document.querySelector('.real-name');
const downloadDouble = document.querySelector('.is-double');
const downloadKind = document.querySelector('.real-kind');
const siteDanger = document.querySelector('.is-danger');
const screenshotList = document.querySelector('.screenshot-list');

function isValidUrl(text) {                            // 올바른 URL인지 검사하는 함수
    if(!(text.startsWith('https://')||text.startsWith('http://')))
        text='https://'+text;                       // https를 생략하는 경우 붙여줌
    try {
        const url = new URL(text);
        const parts = url.hostname.split('.');
        return parts.length >= 2 && parts.every(p => /^[a-z0-9-]+$/.test(p)); 
                                            // abc.abc처럼 영어 알파벳이고, .으로 나뉘며 두 조각 이상이고, 빈 공백이 없다면 true반환 
    } catch {
        return false;
    }
}

function askServer(data, callback) { // 서버에 물어보고, 답이 오면 callback 실행
    fetch('/url/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data) // 데이터를 json으로 만들어서 보냄
    })
        .then(response => response.json()) // 응답을 js객체로 바꿈
        .then(result => {
            if (result.error) {                    // flask는 정상인데, 사이트의 응답이 없는 경우
                scanError.textContent = result.error;
                scanButton.disabled = false;
                scanButton.textContent = '검사하기';
            } else {
                callback(result);                  // 정상이면 통과
            }
        })
        .catch(() => {                             // flask에 문제가 있는 경우
            scanError.textContent = '검사에 실패했어요. 잠시 후 다시 시도해 주세요.';
            scanButton.disabled = false;
            scanButton.textContent = '검사하기';
        });
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
        askServer({ url: text }, (result) => {// 답이 오면 이 안이 실행됨
            scanButton.disabled = false;         // 다시 누를 수 있게
            scanButton.textContent = '검사하기';
            redirectCount.textContent = result.redirects.length;
            redirectList.innerHTML = '';                 // 내용 초기화
            screenshotList.innerHTML = '';               //  스크린샷 초기화
            result.redirects.forEach((redirect, index) => {       // 주소를 서버한테 받은 뒤에 html li로 만들고, 스크린샷도 돌면서 찍음
                const li = document.createElement('li');
                const item = document.createElement('div');    
                if (index === 0) {                                               
                    item.className = 'carousel-item active';   // 첫 번째 페이지라면 active를 붙여서 부트스트랩이 가장 앞에 띄우도록 함
                } else {
                    item.className = 'carousel-item';
                }
                if (redirect.image) {                                            // 사진이 있으면 사진을 출력함
                    item.innerHTML = '<img class="screenshot-image"><div class="text-muted mt-2 text-center"></div>';
                    item.querySelector('img').src = 'data:image/jpeg;base64,' + redirect.image;
                } else {                                                         // 없으면 안내 문구를 띄움
                    item.innerHTML = '<div class="screenshot-box">사이트 화면 촬영을 실패했어요</div><div class="text-muted mt-2 text-center"></div>';
                }
                item.querySelector('.text-center').textContent = redirect.url;   // 사진 아래에 주소를 넣음
                screenshotList.appendChild(item);                               
                li.innerHTML = '<div class="d-flex justify-content-between"><span></span><span></span></div>';
                const spans = li.querySelectorAll('span');
                spans[0].textContent = redirect.url;     // 왼쪽 칸: 주소
                spans[1].textContent = redirect.country + ' · ' + redirect.company + (redirect.proxy ? ' [프록시]' : '');  // 오른쪽 칸: 나라, 회사 이름, 프록시 서버 여부 
                redirectList.appendChild(li);            // 목록에 붙이기
            });
            downloadName.textContent = result.download ? result.download.name : '-';
            downloadKind.textContent = result.download ? result.download.kind : '-';
            downloadDouble.textContent = result.download ? (result.download.double ? 'O' : 'X') : '-';
            siteDanger.textContent = result.danger;
            scanPage.classList.add('is-scanned');                     
        });
        
    } else {
        setTimeout(() => {  // 올바르지 않은 url로 다시 검사를 시도했을 때 문구가 잠시 없어졌다가 나타나면서 강조하는 역할
        scanError.textContent = '올바른 주소를 입력해주세요'; // 빨간 안내문구 출력
        }, 100); 
    }
});
