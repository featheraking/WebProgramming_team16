/* 서버가 저장을 확인한 뒤에만 다음 변경을 허용합니다. */
window.SchedulerAPI = (() => {
  let revision = null, csrf = '';
  async function request(options = {}) {
    const response = await fetch('/scheduler/api/state', {
      credentials: 'same-origin', cache: 'no-store', ...options,
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json',
        'X-CSRF-Token': csrf, ...(options.headers || {})}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `서버 응답 오류 (${response.status})`);
    revision = data.revision; csrf = data.csrf_token;
    return data.state;
  }
  return {
    load: () => request(),
    save: state => {
      if (revision === null) return Promise.reject(new Error('먼저 서버 데이터를 불러와 주세요.'));
      return request({method: 'PUT', body: JSON.stringify({revision, state})});
    }
  };
})();
