import requests, socket, db, ipaddress
from flask import Blueprint, render_template, request, jsonify, current_app
from patchright.sync_api import sync_playwright, TimeoutError

bp = Blueprint('url', __name__, url_prefix='/url')

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'}
# 로봇이 아닌 척하기 위한 표시 (기본적인 자동 차단을 막기 위함. )

@bp.route('')
def index():
    return render_template('url.html')


@bp.route('/scan', methods=['POST'])
def scan():
    data = request.get_json()
    url = data.get('url', '').strip()
    if not url.startswith(('http://', 'https://')):   # 생략했으면 https:// 붙이기
        url = 'https://' + url
    try:
        response = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        response.close()
    except requests.RequestException:
        return jsonify({'error': '사이트에 접속할 수 없어요.'}), 502

    redirects = []                                # 거쳐 가는 주소 목록
    lastUrl = ''                                   # 바로 앞 주소 (비교용)
    for step in response.history + [response]:    # 중간에 거친 답들 + 마지막 답
        host = step.url.split('/')[2]            # 사이트 이름
        thisUrl = host.removeprefix('www.')         # 비교용
        if thisUrl == lastUrl:
            redirects.pop()                       # 앞 줄과 같은 주소면 앞 줄을 버림
        try:
            ip = socket.gethostbyname(host)                # 사이트 이름으로 IP 찾기
            if not ipaddress.ip_address(ip).is_global:     # 내부 주소면 거절
                return jsonify({'error': '검사 불가능한 IP주소에요'}), 400
            saved = db.query('SELECT country, hosting_company AS isp, is_proxy AS proxy FROM url_scan_logs WHERE ip_address = %s AND scanned_at > NOW() - INTERVAL 7 DAY', (ip,), one=True)
            if saved:                                      #  DB에 7일 안에 조회한 IP가 있으면 그걸 씀
                info = saved
            else:                                          #  없으면 ip-api에 물어봄
                answer = requests.get('http://ip-api.com/json/' + ip + '?fields=country,isp,proxy', timeout=5)
                if answer.status_code == 200:              #  정상 답이면 DB에 적어 둠
                    info = answer.json()
                    db.execute('REPLACE INTO url_scan_logs (ip_address, country, hosting_company, is_proxy) VALUES (%s, %s, %s, %s)', # db에 추가
                               (ip, info.get('country'), info.get('isp'), info.get('proxy', False)))
                else:                                      #  답은 왔는데 한도 초과 등 다른 메시지
                    info = {'country': '확인 실패'}
        except (requests.RequestException, socket.gaierror):   #  연결이 안 됨
            info = {'country': '연결 실패'}
        redirects.append({'url': step.url, 'country': info.get('country', '-'), 'company': info.get('isp', '-'), 'proxy': info.get('proxy', False)})    
        lastUrl = thisUrl                              # 다음 url로 이동

    disposition = response.headers.get('Content-Disposition', '')  # 서버가 파일을 저장하려고 했는지
    content_type = response.headers.get('Content-Type', '')        # 콘텐츠가 html이 아닌지 == 파일 형식인지
    if 'attachment' in disposition or 'text/html' not in content_type: # 검사하는 페이지가 다운로드 버튼 페이지인지 확인
        if 'filename=' in disposition:                  
            name = disposition.split('filename=')[1].split(';')[0].strip('"')  # 서버가 파일명을 지정했다면 filename이라는 정보에 들어있는 파일명만 잘라냄
        else:                                             
            name = response.url.split('?')[0].split('/')[-1] # 서버가 지정 안 했다면 주소에서 ? 뒤의 쿼리와 / 전에 웹사이트를 잘라내고 가운데 파일명만 남김
        kind = name.split('.')[-1]
        parts = name.lower().split('.')      
        double = len(parts) >= 3 and parts[-2] in ['pdf', 'doc', 'docx', 'hwp', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'png', 'zip', 'mp4']
                                # 만약 .으로 나눠지는 조각이 hello.pdf.exe처럼 3개 이상이면, 유명한 확장자를 대입해서 뒤에서 2번째 조각이 확장자인 척 하는지 확인
        download = {'name': name, 'kind': kind, 'double': double}
    else:                                             
        download = None


    try:
        check = requests.get('https://safebrowsing.googleapis.com/v5alpha1/urls:search',
                            params={'key': current_app.config['SAFE_BROWSING_API_KEY'], 'urls': response.url},
                            timeout=5)
        if check.status_code == 200:                   # 정상 응답일 경우 위험 감지 여부를 확인
            danger = '위험 감지' if check.content.startswith(b'\n') else '위험 불감지'
        else:                                          # 답은 왔는데 한도 초과 등 다른 메시지
            danger = '확인 불가'
    except requests.RequestException:
        danger = '연결 실패'                            #구글 api에 연결 실패
    with sync_playwright() as p:                              # 패치라이트 시작 (끝나면 알아서 정리됨)
        browser = p.chromium.launch(channel='chrome', chromium_sandbox=True)         # 깔려 있는 크롬을 화면 없이 켬, 샌드박스 모드로 보안 강화
        page = browser.new_page(viewport={'width': 1280, 'height': 720}, accept_downloads=False)  # 새 탭 열 때 다운로드를 차단함
        for redirect in redirects:                            # 남은 주소마다 한 장씩
            try:
                try:
                    page.goto(redirect['url'], timeout=10000)     # 그 주소로 이동
                except TimeoutError:                              # 10초 안에 다 안 떠도 뜬 데까지 찍으러 감
                    pass
                shot = page.context.new_cdp_session(page).send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 60})
                redirect['image'] = shot['data']                  # 크롬이 찍어 준 사진 (이미 글자로 바뀌어 있음)
            except Exception:                                 
                redirect['image'] = None
        browser.close()                                      
    return jsonify({'redirects': redirects, 'download': download, 'danger': danger})