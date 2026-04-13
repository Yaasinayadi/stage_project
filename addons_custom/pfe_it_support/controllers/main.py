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

    # ─────────────────────────────────────────────
    # ATTACHMENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/ticket/<int:ticket_id>/upload', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def upload_attachment(self, ticket_id, **kw):
        """Upload une ou plusieurs pièces jointes pour un ticket."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'POST, OPTIONS'),
                ('Access-Control-Allow-Headers', 'Content-Type'),
            ])

        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            uploaded_files = request.httprequest.files.getlist('files')
            if not uploaded_files:
                return self._json_response({'status': 400, 'message': 'Aucun fichier reçu.'}, 400)

            # Limite : 10 Mo par fichier, 5 fichiers max
            MAX_SIZE = 10 * 1024 * 1024  # 10 MB
            MAX_FILES = 5
            ALLOWED_TYPES = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf',
                'text/plain', 'text/csv',
                'application/zip',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ]

            if len(uploaded_files) > MAX_FILES:
                return self._json_response({'status': 400, 'message': f'Maximum {MAX_FILES} fichiers à la fois.'}, 400)

            created_attachments = []
            for file in uploaded_files:
                file_data = file.read()

                if len(file_data) > MAX_SIZE:
                    return self._json_response({
                        'status': 400,
                        'message': f'Le fichier "{file.filename}" dépasse 10 Mo.'
                    }, 400)

                if file.content_type not in ALLOWED_TYPES:
                    return self._json_response({
                        'status': 400,
                        'message': f'Type de fichier non autorisé : {file.content_type}'
                    }, 400)

                import base64
                attachment = request.env['ir.attachment'].sudo().create({
                    'name': file.filename,
                    'datas': base64.b64encode(file_data).decode('utf-8'),
                    'res_model': 'support.ticket',
                    'res_id': ticket_id,
                    'mimetype': file.content_type,
                })

                # Lier à la relation Many2many du ticket
                ticket.sudo().write({
                    'attachment_ids': [(4, attachment.id)]
                })

                created_attachments.append({
                    'id': attachment.id,
                    'name': attachment.name,
                    'mimetype': attachment.mimetype,
                    'file_size': len(file_data),
                    'url': f'/web/content/{attachment.id}?download=true',
                })

            return self._json_response({
                'status': 201,
                'message': f'{len(created_attachments)} fichier(s) uploadé(s) avec succès.',
                'data': created_attachments
            }, 201)

        except Exception as e:
            import traceback
            return self._json_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, 500)

    @http.route('/api/ticket/<int:ticket_id>/attachments', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_attachments(self, ticket_id, **kw):
        """Récupère la liste des pièces jointes d'un ticket."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'GET, OPTIONS'),
            ])

        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            attachments = request.env['ir.attachment'].sudo().search([
                ('res_model', '=', 'support.ticket'),
                ('res_id', '=', ticket_id),
            ])

            data = [{
                'id': att.id,
                'name': att.name,
                'mimetype': att.mimetype or 'application/octet-stream',
                'file_size': att.file_size or 0,
                'create_date': str(att.create_date) if att.create_date else None,
                'url': f'/web/content/{att.id}?download=true',
            } for att in attachments]

            return self._json_response({'status': 200, 'data': data})

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/attachment/<int:attachment_id>', type='http', auth='public', methods=['DELETE', 'OPTIONS'], cors='*', csrf=False)
    def delete_attachment(self, attachment_id, **kw):
        """Supprime une pièce jointe."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[
                ('Access-Control-Allow-Origin', '*'),
                ('Access-Control-Allow-Methods', 'DELETE, OPTIONS'),
            ])

        try:
            attachment = request.env['ir.attachment'].sudo().browse(attachment_id)
            if not attachment.exists():
                return self._json_response({'status': 404, 'message': 'Pièce jointe introuvable.'}, 404)

            attachment.sudo().unlink()
            return self._json_response({'status': 200, 'message': 'Fichier supprimé avec succès.'})

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

