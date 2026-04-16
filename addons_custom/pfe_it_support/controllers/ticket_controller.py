from odoo import http
from odoo.http import request
import json

class TicketController(http.Controller):
    
    @http.route('/api/tickets/queue', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False, cors='*')
    def get_tickets_queue(self, **kwargs):
        """
        Récupère les tickets non assignés ou ceux qui requièrent une prise en charge rapide
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])
        try:
            # Recherche des tickets non assignés
            tickets = request.env['support.ticket'].sudo().search([
                ('assigned_to_id', '=', False),
                ('state', 'in', ['new', 'waiting'])
            ])
            
            data = []
            for t in tickets:
                data.append({
                    'id': t.id,
                    'name': t.name,
                    'description': t.description,
                    'priority': t.priority,
                    'state': t.state,
                    'create_date': str(t.create_date) if t.create_date else None,
                    'sla_deadline': str(t.sla_deadline) if t.sla_deadline else None,
                    'user_id': t.user_id.name if t.user_id else None,
                })
            
            return request.make_response(
                json.dumps({'status': 'success', 'data': data}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/assign', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False, cors='*')
    def assign_ticket(self, ticket_id, **kwargs):
        """
        Assigne un ticket au technicien en cours de session.
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'PATCH, OPTIONS')])
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=[('Content-Type', 'application/json')], status=404)
            
            # L'assigner à l'utilisateur courant
            ticket.write({
                'assigned_to_id': request.env.user.id,
                'state': 'assigned'
            })
            
            return request.make_response(
                json.dumps({'status': 'success', 'message': f"Ticket {ticket.id} assigné avec succès"}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/transfer', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False, cors='*')
    def transfer_ticket(self, ticket_id, **kwargs):
        """
        Transfère l'assignation du ticket ou l'escalade
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'PATCH, OPTIONS')])
        try:
            data = request.httprequest.data
            payload = json.loads(data) if data else {}
            
            new_agent_id = payload.get('new_agent_id')
            is_escalation = payload.get('escalate', False)
            
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=[('Content-Type', 'application/json')], status=404)
            
            if is_escalation:
                ticket.write({
                    'state': 'escalated'
                })
                # On pourrait aussi déclencher un ping aux admins
                return request.make_response(
                    json.dumps({'status': 'success', 'message': f"Ticket {ticket.id} escaladé avec succès"}),
                    headers=[('Content-Type', 'application/json')]
                )
            
            if new_agent_id:
                ticket.write({
                    'assigned_to_id': new_agent_id,
                    'state': 'assigned'
                })
                return request.make_response(
                    json.dumps({'status': 'success', 'message': f"Ticket {ticket.id} transféré avec succès"}),
                    headers=[('Content-Type', 'application/json')]
                )
                
            return request.make_response(json.dumps({'status': 'error', 'message': 'Paramètres invalides, new_agent_id ou escalate requis'}), headers=[('Content-Type', 'application/json')], status=400)
            
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/ai-suggest', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False, cors='*')
    def ai_suggest_diagnostic(self, ticket_id, **kwargs):
        """
        Interroge le microservice IA pour un diagnostic assisté basé sur la description.
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])
        import requests
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=[('Content-Type', 'application/json')], status=404)
            
            # Appel au service IA (FastAPI)
            ai_service_url = "http://ia_service:8000/classify_ticket"
            try:
                resp = requests.post(ai_service_url, json={"description": f"{ticket.name}\\n{ticket.description}"}, timeout=5)
            except requests.exceptions.ConnectionError:
                resp = requests.post("http://127.0.0.1:8000/classify_ticket", json={"description": f"{ticket.name}\\n{ticket.description}"}, timeout=5)
                
            if resp.status_code == 200:
                ai_data = resp.json()
                ticket.write({
                    'ai_classification': ai_data.get('category'),
                    'ai_confidence': ai_data.get('confidence'),
                    'ai_suggested_solution': ai_data.get('suggested_solution')
                })
                return request.make_response(
                    json.dumps({'status': 'success', 'data': ai_data}),
                    headers=[('Content-Type', 'application/json')]
                )
            else:
                return request.make_response(json.dumps({'status': 'error', 'message': 'Erreur du service IA'}), headers=[('Content-Type', 'application/json')], status=500)
                
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/resolve', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False, cors='*')
    def resolve_ticket(self, ticket_id, **kwargs):
        """
        Marque le ticket comme résolu et publie Optionnellement la solution dans la KB
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'PATCH, OPTIONS')])
        try:
            data = request.httprequest.data
            payload = json.loads(data) if data else {}
            
            resolution_text = payload.get('resolution')
            add_to_kb = payload.get('add_to_kb', False)
            
            if not resolution_text:
                return request.make_response(json.dumps({'status': 'error', 'message': 'Résolution requise'}), headers=[('Content-Type', 'application/json')], status=400)
                
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=[('Content-Type', 'application/json')], status=404)
            
            if add_to_kb:
                request.env['support.knowledge'].sudo().create({
                    'name': ticket.name,
                    'solution': resolution_text,
                    'category': ticket.ai_classification or 'Support',
                    'ticket_id': ticket.id
                })
                
            ticket.write({
                'state': 'resolved',
                'resolution': resolution_text
            })
            
            return request.make_response(
                json.dumps({'status': 'success', 'message': 'Ticket résolu' + (' et publié dans la KB' if add_to_kb else '')}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/knowledge', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False, cors='*')
    def get_knowledge_base(self, **kwargs):
        """
        Récupère les FAQs.
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])
        try:
            domain = []
            category = kwargs.get('category')
            if category:
                domain.append(('category', 'ilike', category))
                
            kb_entries = request.env['support.knowledge'].sudo().search(domain, order='create_date desc', limit=50)
            data = []
            for kb in kb_entries:
                data.append({
                    'id': kb.id,
                    'title': kb.name,
                    'solution': kb.solution,
                    'category': kb.category,
                    'source_ticket_id': kb.ticket_id.id if kb.ticket_id else None
                })
            
            return request.make_response(
                json.dumps({'status': 'success', 'data': data}),
                headers=[('Content-Type', 'application/json')]
            )
        except Exception as e:
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=[('Content-Type', 'application/json')],
                status=500
            )

    @http.route('/api/knowledge/create', type='json', auth='public', methods=['POST', 'OPTIONS'], csrf=False, cors='*')
    def create_knowledge_base(self, **kwargs):
        """
        Crée manuellement un article de la base de connaissances.
        """
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'POST, OPTIONS'), ('Access-Control-Allow-Headers', 'Content-Type')])
        try:
            title = kwargs.get('title')
            solution = kwargs.get('solution')
            category = kwargs.get('category')
            
            if not title or not solution:
                return {'status': 'error', 'message': 'Titre et solution requis'}
                
            new_kb = request.env['support.knowledge'].sudo().create({
                'name': title,
                'solution': solution,
                'category': category or 'Support',
            })
            
            return {
                'status': 'success',
                'data': {'id': new_kb.id, 'title': new_kb.name}
            }
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
