import json, db

from flask import Blueprint, render_template, request, jsonify, current_app, session
from google import genai
from google.genai import types

bp = Blueprint('tone', __name__, url_prefix='/tone')


@bp.route('')
def index():
    return render_template('tone.html')


@bp.route('/logs')
def logs(): # 로그인한 사람의 최근 기록 5개를 tone.js에게 전달 (로그인 안 했으면 빈 목록)
    rows = db.query('SELECT is_converted, input_text, recipient, template, analysis FROM tone_logs WHERE user_id = %s ORDER BY id DESC LIMIT 5',
                    (session.get('user_id'),))
    return jsonify(rows)

# 받는 사람별 말투 안내
TARGET_GUIDE = {
    '교수님': '격식 있는 존댓말(~습니다, ~드립니다). 첫 줄에 인사와 함께 [과목명] 수강생 [이름]이라고 밝힘.',
    '조교': '정중한 존댓말. 교수님보다 조금 덜 딱딱해도 됨. [과목명] 수강생 [이름]이라고 밝힘.',
    '선배': '부드러운 존댓말(~요). 지나치게 딱딱하지 않게, 예의는 지킴.',
    '팀원': '친근하지만 예의 있는 존댓말(~요). 용건 위주로 짧게.',
}

# 템플릿별 글 구성 안내
TEMPLATE_GUIDE = {
    '없음': '형식은 추가하지 말고 말투만 바꿈. 길이는 원문과 비슷하게.',
    '문의': '인사 → 무엇이 궁금한지 한두 문장으로 분명하게 → 감사 인사.',
    '요청': '인사 → 무엇을 부탁하는지와 이유 → 가능 여부를 정중히 여쭘 → 감사 인사.',
    '사과': '인사 → 무엇에 대한 사과인지 먼저 → 이유는 짧게 → 앞으로의 다짐이나 조치 → 마무리.',
    '감사': '인사 → 무엇에 대해 감사한지 구체적으로 → 마무리.',
    '안내': '인사 → 알릴 내용(일정, 장소, 할 일)을 빠짐없이 → 확인 부탁.',
}


def make_prompt(text, target, template): # 프롬프트 만들기
    target_guide = TARGET_GUIDE.get(target, '상대에 맞는 말.')
    template_guide = TEMPLATE_GUIDE.get(template, TEMPLATE_GUIDE['없음'])

    return f"""너는 대학생이 보내는 메시지를 상황에 맞게 다듬어 주는 도우미야.

[할 일 1] 원문을 [{target}]에게 보내는 메시지로 다시 써.
- 말투: {target_guide}
- 구성: {template_guide}

[지킬 것]
- 원문의 용건과 사실은 그대로 유지할 것.
- 원문에 없는 사실(날짜, 이유, 과목명, 이름 등)은 지어내지 말고 [이름], [과목명]처럼 빈칸으로 남길 것.
- 같은 뜻의 문장을 두 번 쓰지 말 것. (예: "연락드렸습니다"와 "문의드립니다"를 같이 쓰지 않기)
- 공문서처럼 딱딱하게 쓰지 말고, 실제 대학생이 쓴 것처럼 자연스럽게 쓸 것.
- 초성, 이모티콘, 줄임말은 결과에 쓰지 말 것.

[예시]
원문: 교수님 과제 언제까지임?? ㅋㅋ
받는 사람: 교수님 / 구성: 문의
결과: 교수님, 안녕하세요. [과목명] 수강생 [이름]입니다.

과제 제출 기한이 언제까지인지 여쭤보고 싶어 연락드렸습니다.

바쁘신데 시간 내주시어 감사드립니다.

감사합니다.
[이름] 드림.

[할 일 2] 원문에 반말이 하나라도 있으면 banmal을 true, 없으면 false로 할것 . (예: "휴강인가?", "알겠어"가 있으면 true)

[할 일 3] 원문에서 아래 표현을 찾아, 원문에 적힌 어절 그대로 목록에 넣을 것.
- chosung: 자음만 쓴 것 (예: ㅋㅋ, ㅎㅎ, ㅇㅋ)
- emoticon: 이모지나 기호 이모티콘 (예: 😂, ㅠㅠ, ^^)
- shortWord: 단어를 줄여 쓴 것 (예: 낼, 담주, 단톡)
- manner: 존댓말 어미나 높임 호칭 (예: ~요, ~습니다, 교수님)
- 하나의 표현은 한 목록에만 넣을 것. 없으면 빈 목록.

[답 형식] 아래 JSON으로만 답할 것.
{{ "converted": "다시 쓴 글", "banmal": false, "chosung": [],"emoticon": [], "shortWord": [], "manner": [] }}

원문: {text}"""

@bp.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json() # 요청을 파이선 딕셔너리로 변환
    text = data.get('text', '') # 각 데이터를 뽑아냄
    target = data.get('target', '')
    template = data.get('template', '')
    is_converted = data.get('isConverted', False) # 톤 변환 버튼이면 True, 톤 검사 버튼이면 False
    client = genai.Client(
    api_key=current_app.config['GEMINI_API_KEY'],
    http_options=types.HttpOptions(timeout=60000, retry_options=types.HttpRetryOptions(attempts=1)), # 시간 초과시 타임아웃 설정
)
    for model in ['gemini-3.6-flash', 'gemini-3.5-flash-lite']: # 앞 모델이 실패하면 다음 모델로 넘어감
        if model == 'gemini-3.6-flash': # 3.6 플래시는 생각 단계를 low로 낮춰서 빠르게
            config = types.GenerateContentConfig(response_mime_type='application/json', thinking_config=types.ThinkingConfig(thinking_level='low'))
        else:
            config = types.GenerateContentConfig(response_mime_type='application/json') # 대답을 json형식으로 고정
        try:
            response = client.models.generate_content( # response 만들기
                model=model,
                contents=make_prompt(text, target, template),
                config=config,
            )
            result = json.loads(response.text) # 제미나이 답을 파이썬 딕셔너리로 변환
        except Exception: # 제미나이가 제대로 된 json으로 대답하지 않았을 경우 다음 모델로
            continue
        if session.get('user_id'): # 로그인한 사람만 기록을 저장
            db.execute('INSERT INTO tone_logs (user_id, is_converted, input_text, recipient, template, analysis) VALUES (%s, %s, %s, %s, %s, %s)',
                       (session.get('user_id'), is_converted, text, target, template, response.text))
            db.execute('DELETE FROM tone_logs WHERE user_id = %s AND id NOT IN (SELECT id FROM (SELECT id FROM tone_logs WHERE user_id = %s ORDER BY id DESC LIMIT 5) AS recent)', # 최근 5개만 남기고 지움
                       (session.get('user_id'), session.get('user_id')))
        return jsonify(result) # json으로 tone.js에게 전달
    return jsonify({'error': '변환에 실패했어요. 잠시 후 다시 시도해 주세요.'}), 503 # 두 모델 다 실패