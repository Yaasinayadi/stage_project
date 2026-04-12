from odoo import http
from odoo.http import request
import json
import hashlib
import secrets


class SupportTicketController(http.Controller):

    # ─────────────────────────────────────────────
    # AUTHENTIFICATION API
    # ─────────────────────────────────────────────

    @http.route('/api/auth/login', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def login(self, **kw):
        """Authentifie un utilisateur via email + mot de passe."""
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            email = post.get('email', '').strip()
            password = post.get('password', '')

            if not email or not password:
                return self._json_response({'status': 400, 'message': 'Email et mot de passe requis.'}, 400)

            # Chercher l'utilisateur par email ou login
            user = request.env['res.users'].sudo().search([
                '|', ('login', '=', email), ('email', '=', email)
            ], limit=1)

            if not user:
                return self._json_response({'status': 401, 'message': 'Identifiants incorrects.'}, 401)

            # Vérifier le mot de passe via Odoo 19
            try:
                credential = {'type': 'password', 'login': email, 'password': password}
                uid = request.env['res.users'].sudo().authenticate(credential, {})
                if not uid:
                    raise Exception("Access Denied")
            except Exception as e:
                import traceback
                return self._json_response({'status': 401, 'message': f'Identifiants incorrects. EX: {traceback.format_exc()}'}, 401)

            # Déterminer le rôle
            role = 'user'
            if user.has_group('base.group_system'):
                role = 'admin'
            elif user.has_group('base.group_user'):
                role = 'agent'

            # Générer un token simple
            token = secrets.token_hex(32)

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'role': role,
                    'token': token,
                }
            })

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/auth/register', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def register(self, **kw):
        """Crée un nouvel utilisateur (portail)."""
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            name = post.get('name', '').strip()
            email = post.get('email', '').strip()
            password = post.get('password', '')

            if not name or not email or not password:
                return self._json_response({'status': 400, 'message': 'Tous les champs sont requis.'}, 400)

            if len(password) < 6:
                return self._json_response({'status': 400, 'message': 'Le mot de passe doit contenir au moins 6 caractères.'}, 400)

            # Vérifier si l'email existe déjà
            existing = request.env['res.users'].sudo().search([
                '|', ('login', '=', email), ('email', '=', email)
            ], limit=1)

            if existing:
                return self._json_response({'status': 409, 'message': 'Cet email est déjà utilisé.'}, 409)

            # Assigner le groupe portail par défaut pour autoriser la connexion
            portal_group = request.env.ref('base.group_portal', raise_if_not_found=False)
            groups = [(4, portal_group.id)] if portal_group else []

            # Créer l'utilisateur
            new_user = request.env['res.users'].sudo().with_context(no_reset_password=True).create({
                'name': name,
                'login': email,
                'email': email,
                'group_ids': groups,
            })
            # Assigner explicitement le mot de passe
            new_user.write({'password': password})

            return self._json_response({
                'status': 201,
                'message': 'Compte créé avec succès.',
                'data': {
                    'id': new_user.id,
                    'name': new_user.name,
                    'email': new_user.email,
                }
            })

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/auth/me', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def get_me(self, **kw):
        """Récupère les infos de l'utilisateur connecté par son ID."""
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            user_id = post.get('user_id')

            if not user_id:
                return self._json_response({'status': 400, 'message': 'user_id requis.'}, 400)

            user = request.env['res.users'].sudo().browse(int(user_id))
            if not user.exists():
                return self._json_response({'status': 404, 'message': 'Utilisateur non trouvé.'}, 404)

            role = 'user'
            if user.has_group('base.group_system'):
                role = 'admin'
            elif user.has_group('base.group_user'):
                role = 'agent'

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'role': role,
                }
            })

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    # ─────────────────────────────────────────────
    # TICKETS API
    # ─────────────────────────────────────────────

    @http.route('/api/tickets', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_tickets(self, **kw):
        """Récupère la liste de tous les tickets de support."""
        env = request.env['support.ticket'].sudo()

        # Filtrer par user_id si fourni
        user_id = kw.get('user_id')
        domain = [('user_id', '=', int(user_id))] if user_id else []

        tickets = env.search(domain)
        data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'state': t.state,
            'priority': t.priority,
            'category': t.ai_classification,
            'user_id': t.user_id.id if t.user_id else None,
            'user_name': t.user_id.name if t.user_id else None,
            'assigned_to': t.assigned_to.name if t.assigned_to else None,
            'create_date': str(t.create_date) if t.create_date else None,
            'write_date': str(t.write_date) if t.write_date else None,
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
        user_id = post.get('user_id')

        if not name or not description:
            return request.make_response(
                json.dumps({'status': 400, 'message': 'Missing name or description'}),
                headers=[('Content-Type', 'application/json')]
            )

        vals = {
            'name': name,
            'description': description,
            'ai_classification': ai_category,
            'priority': priority
        }

        # Associer le ticket à l'utilisateur connecté
        if user_id:
            vals['user_id'] = int(user_id)

        env = request.env['support.ticket'].sudo()
        new_ticket = env.create(vals)
        return request.make_response(
            json.dumps({'status': 201, 'message': 'Success', 'ticket_id': new_ticket.id}),
            headers=[('Content-Type', 'application/json')]
        )

    # ─────────────────────────────────────────────
    # UTILS
    # ─────────────────────────────────────────────

    def _json_response(self, data, status_code=200):
        """Helper pour retourner une réponse JSON propre."""
        return request.make_response(
            json.dumps(data),
            headers=[
                ('Content-Type', 'application/json'),
            ],
            status=status_code
        )

    @http.route('/api/ticket/update/<int:ticket_id>', type='http', auth='public', methods=['PUT', 'OPTIONS'], cors='*', csrf=False)
    def update_ticket(self, ticket_id, **kw):
        """Met à jour un ticket de support via l'API."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'PUT, OPTIONS')])
            
        post = json.loads(request.httprequest.data.decode('utf-8'))
        env = request.env['support.ticket'].sudo()
        ticket = env.browse(ticket_id)
        
        if not ticket.exists():
            return request.make_response(
                json.dumps({'status': 404, 'message': 'Ticket not found'}),
                headers=[('Content-Type', 'application/json')]
            )

        vals = {}
        if 'name' in post: vals['name'] = post['name']
        if 'description' in post: vals['description'] = post['description']
        if 'priority' in post: vals['priority'] = post['priority']
        if 'category' in post: vals['ai_classification'] = post['category']
        if 'state' in post: vals['state'] = post['state']

        ticket.write(vals)
        return request.make_response(
            json.dumps({'status': 200, 'message': 'Success updated'}),
            headers=[('Content-Type', 'application/json')]
        )

    @http.route('/api/ticket/<int:ticket_id>', type='http', auth='public', methods=['DELETE', 'OPTIONS'], cors='*', csrf=False)
    def delete_ticket(self, ticket_id, **kw):
        """Supprime un ticket de support."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'DELETE, OPTIONS')])
            
        env = request.env['support.ticket'].sudo()
        ticket = env.browse(ticket_id)
        
        if not ticket.exists():
            return request.make_response(
                json.dumps({'status': 404, 'message': 'Ticket not found'}),
                headers=[('Content-Type', 'application/json')]
            )
            
        ticket.unlink()
        return request.make_response(
            json.dumps({'status': 200, 'message': 'Ticket deleted successfully'}),
            headers=[('Content-Type', 'application/json')]

        )
