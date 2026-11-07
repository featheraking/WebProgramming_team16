from flask import Blueprint, render_template

bp = Blueprint('workspace', __name__, url_prefix='/workspace')


@bp.route('')
def index():
    return render_template('workspace.html')


@bp.route('/project/<project_id>')
def project(project_id):
    return render_template('project.html', project_id=project_id)