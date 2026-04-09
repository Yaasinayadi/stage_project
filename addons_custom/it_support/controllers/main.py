from odoo import http
from odoo.http import request

class ITSupportController(http.Controller):
    
    # 1. Affiche la page du formulaire Web
    @http.route('/support', type='http', auth='public', website=True)
    def support_page(self, **kw):
        return request.render('it_support.support_ticket_form_page', {})

    # 2. Reçoit les données quand l'utilisateur clique sur "Envoyer"
    @http.route('/support/submit', type='http', auth='public', website=True, methods=['POST'])
    def support_submit(self, **post):
        # Création du ticket dans la base de données
        request.env['it.support.ticket'].sudo().create({
            'name': post.get('name'),
            'description': post.get('description'),
        })
        # Affiche la page de remerciement
        return request.render('it_support.support_ticket_thanks', {})