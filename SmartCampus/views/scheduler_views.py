from flask import Blueprint, render_template

bp = Blueprint('scheduler', __name__, url_prefix='/scheduler')


@bp.route('')
def index():
    return render_template('exam-scheduler-team.html')