from odoo import http
from odoo.http import request
import json
import odoo
class SupportTicketController(http.Controller):

    @http.route('/api/tickets', type='http', auth='none', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_tickets(self, **kw):
        cors_headers = [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=cors_headers)
        
        db_name = 'pfe_db'
        registry = odoo.registry(db_name)
        with registry.cursor() as cr:
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
            tickets = env['support.ticket'].search([])
            data = [{
                'id': t.id,
                'name': t.name,
                'description': t.description,
                'state': t.state,
                'priority': t.priority,
                'category': t.ai_classification,
            } for t in tickets]
            return request.make_response(json.dumps({'status': 200, 'data': data}), headers=[('Content-Type', 'application/json')] + cors_headers)

    @http.route('/api/ticket/create', type='http', auth='none', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def create_ticket(self, **kw):
        cors_headers = [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=cors_headers)
        
        post = json.loads(request.httprequest.data.decode('utf-8'))
        name = post.get('name')
        description = post.get('description')
        ai_category = post.get('category')
        priority = post.get('priority', '1')

        if not name or not description:
            return request.make_response(json.dumps({'status': 400, 'message': 'Missing name'}), headers=[('Content-Type', 'application/json')] + cors_headers)

        db_name = 'pfe_db'
        registry = odoo.registry(db_name)
        with registry.cursor() as cr:
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
            new_ticket = env['support.ticket'].create({
                'name': name,
                'description': description,
                'ai_classification': ai_category,
                'priority': priority
            })
            return request.make_response(json.dumps({'status': 201, 'message': 'Success', 'ticket_id': new_ticket.id}), headers=[('Content-Type', 'application/json')] + cors_headers)
