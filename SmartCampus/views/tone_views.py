from flask import Blueprint, render_template

bp = Blueprint('tone', __name__, url_prefix='/tone')


@bp.route('')
def index():
    return render_template('tone.html')