from odoo import http
from odoo.http import request
import json


class SupportTicketController(http.Controller):

    @http.route('/api/tickets', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_tickets(self, **kw):
        """Récupère la liste de tous les tickets de support."""
        env = request.env['support.ticket'].sudo()
        tickets = env.search([])
        data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'state': t.state,
            'priority': t.priority,
            'category': t.ai_classification,
        } for t in tickets]
        return request.make_response(
            json.dumps({'status': 200, 'data': data}),
            headers=[('Content-Type', 'application/json')]
        )

    @http.route('/api/ticket/create', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def create_ticket(self, **kw):
        """Crée un nouveau ticket de support via l'API."""
        post = json.loads(request.httprequest.data.decode('utf-8'))
        name = post.get('name')
        description = post.get('description')
        ai_category = post.get('category')
        priority = post.get('priority', '1')

        if not name or not description:
            return request.make_response(
                json.dumps({'status': 400, 'message': 'Missing name or description'}),
                headers=[('Content-Type', 'application/json')]
            )

        env = request.env['support.ticket'].sudo()
        new_ticket = env.create({
            'name': name,
            'description': description,
            'ai_classification': ai_category,
            'priority': priority
        })
        return request.make_response(
            json.dumps({'status': 201, 'message': 'Success', 'ticket_id': new_ticket.id}),
            headers=[('Content-Type', 'application/json')]
        )
