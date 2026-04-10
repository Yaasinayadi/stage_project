from odoo import http, api, SUPERUSER_ID
from odoo.http import request
from odoo.modules.registry import Registry
import json
class SupportTicketController(http.Controller):

    @http.route('/api/tickets', type='http', auth='none', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_tickets(self, **kw):
        # Odoo's cors='*' already handles OPTIONS and Access-Control-Allow-Origin Headers.
        # Odoo's cors='*' already handles OPTIONS and Access-Control-Allow-Origin Headers.
        db_name = 'pfe_db'
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = api.Environment(cr, SUPERUSER_ID, {})
            tickets = env['support.ticket'].search([])
            data = [{
                'id': t.id,
                'name': t.name,
                'description': t.description,
                'state': t.state,
                'priority': t.priority,
                'category': t.ai_classification,
            } for t in tickets]
            return request.make_response(json.dumps({'status': 200, 'data': data}), headers=[('Content-Type', 'application/json')])

    @http.route('/api/ticket/create', type='http', auth='none', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def create_ticket(self, **kw):
        # Odoo's cors='*' already handles OPTIONS and Access-Control-Allow-Origin Headers.
        post = json.loads(request.httprequest.data.decode('utf-8'))
        name = post.get('name')
        description = post.get('description')
        ai_category = post.get('category')
        priority = post.get('priority', '1')

        if not name or not description:
            return request.make_response(json.dumps({'status': 400, 'message': 'Missing name'}), headers=[('Content-Type', 'application/json')])

        db_name = 'pfe_db'
        registry = Registry(db_name)
        with registry.cursor() as cr:
            env = api.Environment(cr, SUPERUSER_ID, {})
            new_ticket = env['support.ticket'].create({
                'name': name,
                'description': description,
                'ai_classification': ai_category,
                'priority': priority
            })
            cr.commit()  # Explicitly commit to ensure ticket creation is persisted
            return request.make_response(json.dumps({'status': 201, 'message': 'Success', 'ticket_id': new_ticket.id}), headers=[('Content-Type', 'application/json')])
