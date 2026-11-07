# 공동파일 (수정 금지)

from flask import Flask

from config import Config
import db
from views.auth_views import bp as auth_bp
from views.scheduler_views import bp as scheduler_bp
from views.workspace_views import bp as workspace_bp
from views.url_views import bp as url_bp
from views.tone_views import bp as tone_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    # Blueprint 등록
    app.register_blueprint(auth_bp)
    app.register_blueprint(scheduler_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(url_bp)
    app.register_blueprint(tone_bp)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
