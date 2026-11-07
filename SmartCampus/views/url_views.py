from flask import Blueprint, render_template

bp = Blueprint('url', __name__, url_prefix='/url')


@bp.route('')
def index():
    return render_template('url.html')