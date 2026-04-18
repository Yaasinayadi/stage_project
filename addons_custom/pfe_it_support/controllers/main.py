from odoo import http
from odoo.http import request
import json
import hashlib
import secrets
import logging
from datetime import datetime, timedelta

_logger = logging.getLogger(__name__)

class SupportTicketController(http.Controller):

    # ─────────────────────────────────────────────
    # AUTHENTIFICATION API
    # ─────────────────────────────────────────────

    @http.route('/api/auth/login', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def login(self, **kw):
        """Authentifie un utilisateur via email + mot de passe."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'POST, OPTIONS'), ('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Odoo-Database')])
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
            except Exception:
                return self._json_response({'status': 401, 'message': 'Identifiants incorrects.'}, 401)

            # Déterminer le rôle
            x_support_role = user.x_support_role or 'user'

            # Générer un token simple
            token = secrets.token_hex(32)

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'x_support_role': x_support_role,
                    'token': token,
                }
            })

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/auth/register', type='http', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def register(self, **kw):
        """Crée un nouvel utilisateur (portail)."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'POST, OPTIONS'), ('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Odoo-Database')])
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

            # Assigner le groupe "utilisateur interne" pour que l'utilisateur soit
            # gérable comme tous les autres dans Odoo (Internal User, non Portal).
            # Cela évite le "mur Portal vs Internal" et permet l'assignation des rôles.
            internal_group = request.env.ref('base.group_user', raise_if_not_found=False)
            groups = [(4, internal_group.id)] if internal_group else []

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
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'POST, OPTIONS'), ('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Odoo-Database')])
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            user_id = post.get('user_id')

            if not user_id:
                return self._json_response({'status': 400, 'message': 'user_id requis.'}, 400)

            user = request.env['res.users'].sudo().browse(int(user_id))
            if not user.exists():
                return self._json_response({'status': 404, 'message': 'Utilisateur non trouvé.'}, 404)

            x_support_role = user.x_support_role or 'user'

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'x_support_role': x_support_role,
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

        # Filtrer par user_id ou assigned_to si fourni
        user_id = kw.get('user_id')
        assigned_to = kw.get('assigned_to')
        domain = []
        
        if user_id:
            domain.append(('user_id', '=', int(user_id)))
            
        if assigned_to:
            # L'agent voit aussi les tickets non assignés s'il le veut, ou que les siens ? 
            # Pour l'instant, on limite strictement à ceux qui lui sont assignés
            domain.append(('assigned_to', '=', int(assigned_to)))

        tickets = env.search(domain, order='create_date desc')
        data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'state': t.state,
            'priority': t.priority,
            'category': t.ai_classification,
            'user_id': t.user_id.id if t.user_id else None,
            'user_name': t.user_id.name if t.user_id else None,
            'assigned_to_id': t.assigned_to_id.id if t.assigned_to_id else None,
            'assigned_to': t.assigned_to_id.name if t.assigned_to_id else None,
            'sla_deadline': str(t.sla_deadline) if t.sla_deadline else None,
            'sla_status': t.sla_status or None,
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
        if 'assigned_to_id' in post:
            vals['assigned_to_id'] = int(post['assigned_to_id']) if post['assigned_to_id'] else False

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
    # AGENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/agents', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_agents(self, **kw):
        """Récupère la liste des techniciens (utilisateurs internes)."""
        try:
            # Les agents/techniciens sont les utilisateurs internes (base.group_user)
            # mais pas les administrateurs système (base.group_system)
            internal_group = request.env.ref('base.group_user', raise_if_not_found=False)
            system_group = request.env.ref('base.group_system', raise_if_not_found=False)

            if not internal_group:
                return self._json_response({'status': 200, 'data': []})

            # Chercher les utilisateurs internes (share = False)
            domain = [('share', '=', False), ('active', '=', True)]
            users = request.env['res.users'].sudo().search(domain)

            agents = []
            for u in users:
                # Exclure les admins système et le superuser
                if system_group and u.has_group('base.group_system'):
                    continue
                if u.id <= 2:  # Skip OdooBot and superuser
                    continue
                agents.append({
                    'id': u.id,
                    'name': u.name,
                    'email': u.email or u.login,
                    'it_domains': [d.name for d in u.it_domain_ids],
                })

            return self._json_response({'status': 200, 'data': agents})

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    # ─────────────────────────────────────────────
    # COMMENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/ticket/<int:ticket_id>/comments', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_comments(self, ticket_id, **kw):
        """Récupère les commentaires d'un ticket"""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])

        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            comments = request.env['support.ticket.comment'].sudo().search(
                [('ticket_id', '=', ticket_id)], order='create_date asc'
            )
            data = []
            for c in comments:
                author_name = c.author_id.name if c.author_id else 'Inconnu'
                _logger.info("DEBUG_VALEUR_NOM: %s", author_name)
                
                x_support_role = c.author_id.x_support_role if c.author_id else 'user'
                if not x_support_role:
                    x_support_role = 'user'
                
                data.append({
                    'id': c.id,
                    'author_name': author_name,
                    'x_support_role': x_support_role,
                    'date': str(c.create_date) if c.create_date else None,
                    'body': c.body,
                })

            _logger.info("DEBUG COMMENTS: %s", data)
            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/comment', type='json', auth='public', methods=['POST', 'OPTIONS'], cors='*', csrf=False)
    def post_comment(self, ticket_id, **kw):
        """Ajoute un commentaire à un ticket (Format JSON-RPC)"""
        _logger.info(f"==> POST /api/ticket/{ticket_id}/comment - Appel reçu")
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                _logger.warning(f"Ticket {ticket_id} introuvable.")
                return {'status': 404, 'message': 'Ticket introuvable.'}
            
            _logger.info(f"Payload reçu : {kw}")
            body = kw.get('body', '').strip()
            user_id = kw.get('user_id')
            author_name = kw.get('author', 'Utilisateur')

            if not body:
                _logger.warning("Le corps du commentaire est vide.")
                return {'status': 400, 'message': 'Le corps du commentaire est requis.'}

            vals = {
                'ticket_id': ticket_id,
                'body': body,
            }
            if user_id:
                vals['author_id'] = int(user_id)
            else:
                vals['author'] = author_name

            _logger.info(f"Création du commentaire avec les valeurs : {vals}")
            new_comment = request.env['support.ticket.comment'].sudo().create(vals)
            _logger.info(f"Commentaire créé avec l'ID : {new_comment.id}")
            
            return {
                'status': 201, 
                'message': 'Commentaire ajouté.',
                'data': {
                    'id': new_comment.id,
                    'author': new_comment.author_id.name if new_comment.author_id else new_comment.author,
                    'date': str(new_comment.create_date) if new_comment.create_date else None,
                    'body': new_comment.body,
                }
            }
        except Exception as e:
            import traceback
            _logger.error(f"Erreur lors de la création du commentaire : {str(e)}")
            _logger.error(traceback.format_exc())
            return {'status': 500, 'message': str(e)}

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

    # ─────────────────────────────────────────────
    # DASHBOARD & KPIS API
    # ─────────────────────────────────────────────
    
    @http.route('/api/admin/stats', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def admin_stats(self, **kw):
        """Récupère les statistiques pour le dashboard administrateur."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])

        try:
            env = request.env['support.ticket'].sudo()
            period = kw.get('period', 'all')
            domain = []
            now = datetime.utcnow()
            
            if period == 'today':
                domain.append(('create_date', '>=', now - timedelta(days=1)))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period == 'month':
                domain.append(('create_date', '>=', now - timedelta(days=30)))

            total_count = env.search_count(domain)
            open_count = env.search_count(domain + [('state', '=', 'new')])
            in_progress_count = env.search_count(domain + [('state', 'in', ('in_progress', 'waiting'))])
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])

            # Répartition par catégorie
            cats_group = env.read_group(domain, ['ai_classification'], ['ai_classification'])
            cat_map = {}
            for cg in cats_group:
                cat_name = cg.get('ai_classification')
                count = cg.get('ai_classification_count', cg.get('__count', 0))
                
                if not cat_name:
                    norm_name = "Non classé"
                else:
                    import unicodedata
                    base = cat_name.strip()
                    n = ''.join(c for c in unicodedata.normalize('NFD', base) if unicodedata.category(c) != 'Mn').lower()
                    if 'reseau' in n: norm_name = "Réseau"
                    elif 'materiel' in n: norm_name = "Matériel"
                    elif 'logiciel' in n: norm_name = "Logiciel"
                    elif 'acces' in n: norm_name = "Accès"
                    elif 'messagerie' in n: norm_name = "Messagerie"
                    elif 'infrastructure' in n or 'infra' in n: norm_name = "Infrastructure"
                    else: norm_name = base.capitalize()
                    
                cat_map[norm_name] = cat_map.get(norm_name, 0) + count

            category_stats = [{'name': k, 'value': v} for k, v in cat_map.items()]

            # Evolution 7 derniers jours
            trend_stats = []
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            jour_mapping = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
            for i in range(6, -1, -1):
                day_start = today - timedelta(days=i)
                day_end = day_start + timedelta(days=1)
                cnt = env.search_count([('create_date', '>=', day_start), ('create_date', '<', day_end)])
                en_day = day_start.strftime("%a")
                trend_stats.append({
                    'name': jour_mapping.get(en_day, en_day),
                    'date': day_start.strftime("%Y-%m-%d"),
                    'tickets': cnt
                })
                
            # MTTR & SLA
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            total_duration_hours = 0
            sla_ok_count = 0
            
            for rt in resolved_tickets:
                if rt.create_date and rt.write_date:
                    diff = rt.write_date - rt.create_date
                    total_duration_hours += diff.total_seconds() / 3600.0
                if rt.sla_status in (False, 'on_track'):
                    sla_ok_count += 1
            
            mttr = 0
            sla_compliance = 100
            resolved_t_count = len(resolved_tickets)
            
            if resolved_t_count > 0:
                mttr = round(total_duration_hours / resolved_t_count, 1)
                sla_compliance = round((sla_ok_count / resolved_t_count) * 100, 1)
            
            data = {
                'counters': {
                    'total': total_count,
                    'open': open_count,
                    'in_progress': in_progress_count,
                    'resolved': resolved_count,
                },
                'categories': category_stats,
                'trend': trend_stats,
                'kpis': {
                    'mttr_hours': mttr,
                    'sla_compliance': sla_compliance
                }
            }
            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            import traceback
            _logger.error("Error in admin stats: %s", traceback.format_exc())
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/tech/stats', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def tech_stats(self, **kw):
        """Récupère les statistiques pour le dashboard agent."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])

        try:
            env = request.env['support.ticket'].sudo()
            period = kw.get('period', 'all')
            tech_id = kw.get('tech_id')
            
            if not tech_id:
               return self._json_response({'status': 400, 'message': 'tech_id requis'}, 400)
               
            domain = [('assigned_to_id', '=', int(tech_id))]
            now = datetime.utcnow()
            
            if period == 'today':
                domain.append(('create_date', '>=', now - timedelta(days=1)))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period == 'month':
                domain.append(('create_date', '>=', now - timedelta(days=30)))

            total_count = env.search_count(domain)
            open_count = env.search_count(domain + [('state', '=', 'new')])
            in_progress_count = env.search_count(domain + [('state', 'in', ('in_progress', 'waiting'))])
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])

            # Répartition par catégorie
            cats_group = env.read_group(domain, ['ai_classification'], ['ai_classification'])
            cat_map = {}
            for cg in cats_group:
                cat_name = cg.get('ai_classification')
                count = cg.get('ai_classification_count', cg.get('__count', 0))
                
                if not cat_name:
                    norm_name = "Non classé"
                else:
                    import unicodedata
                    base = cat_name.strip()
                    n = ''.join(c for c in unicodedata.normalize('NFD', base) if unicodedata.category(c) != 'Mn').lower()
                    if 'reseau' in n: norm_name = "Réseau"
                    elif 'materiel' in n: norm_name = "Matériel"
                    elif 'logiciel' in n: norm_name = "Logiciel"
                    elif 'acces' in n: norm_name = "Accès"
                    elif 'messagerie' in n: norm_name = "Messagerie"
                    elif 'infrastructure' in n or 'infra' in n: norm_name = "Infrastructure"
                    else: norm_name = base.capitalize()
                    
                cat_map[norm_name] = cat_map.get(norm_name, 0) + count

            category_stats = [{'name': k, 'value': v} for k, v in cat_map.items()]

            # Evolution 7 derniers jours
            trend_stats = []
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            jour_mapping = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
            for i in range(6, -1, -1):
                day_start = today - timedelta(days=i)
                day_end = day_start + timedelta(days=1)
                cnt = env.search_count(domain + [('create_date', '>=', day_start), ('create_date', '<', day_end)])
                en_day = day_start.strftime("%a")
                trend_stats.append({
                    'name': jour_mapping.get(en_day, en_day),
                    'date': day_start.strftime("%Y-%m-%d"),
                    'tickets': cnt
                })
                
            # MTTR & SLA
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            total_duration_hours = 0
            sla_ok_count = 0
            
            for rt in resolved_tickets:
                if rt.create_date and rt.write_date:
                    diff = rt.write_date - rt.create_date
                    total_duration_hours += diff.total_seconds() / 3600.0
                if rt.sla_status in (False, 'on_track'):
                    sla_ok_count += 1
            
            mttr = 0
            sla_compliance = 100
            resolved_t_count = len(resolved_tickets)
            
            if resolved_t_count > 0:
                mttr = round(total_duration_hours / resolved_t_count, 1)
                sla_compliance = round((sla_ok_count / resolved_t_count) * 100, 1)
            
            data = {
                'counters': {
                    'total': total_count,
                    'open': open_count,
                    'in_progress': in_progress_count,
                    'resolved': resolved_count,
                },
                'categories': category_stats,
                'trend': trend_stats,
                'kpis': {
                    'mttr_hours': mttr,
                    'sla_compliance': sla_compliance
                }
            }
            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            import traceback
            _logger.error("Error in tech stats: %s", traceback.format_exc())
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    # ─────────────────────────────────────────────
    # USERS ADMINISTRATION API
    # ─────────────────────────────────────────────

    @http.route('/api/admin/users', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def admin_get_users(self, **kw):
        """Récupère la liste de tous les utilisateurs (pour le dashboard Admin)."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'GET, OPTIONS')])

        try:
            # active_test=False permet de voir aussi les utilisateurs archivés/bannis
            users = request.env['res.users'].sudo().with_context(active_test=False).search([('id', '>', 2)], order='create_date desc')

            data = []
            system_group = request.env.ref('base.group_system', raise_if_not_found=False)
            tech_group   = request.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)

            for u in users:
                # Compute role LIVE from groups (mirrors the write logic in admin_update_user)
                if system_group and system_group in u.group_ids:
                    role = 'admin'
                elif tech_group and tech_group in u.group_ids:
                    role = 'agent'   # 'agent' = technicien in the frontend select
                else:
                    role = 'user'

                data.append({
                    'id': u.id,
                    'name': u.name,
                    'email': u.email or u.login,
                    'role': role,
                    'it_domains': [d.name for d in u.it_domain_ids],
                    'active': u.active
                })

            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            import traceback
            return self._json_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, 500)

    @http.route('/api/admin/users/<int:user_id>', type='http', auth='public', methods=['PUT', 'OPTIONS'], cors='*', csrf=False)
    def admin_update_user(self, user_id, **kw):
        """Met à jour un utilisateur (rôle, domaine, statut actif)."""
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=[('Access-Control-Allow-Origin', '*'), ('Access-Control-Allow-Methods', 'PUT, OPTIONS')])

        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            
            # 1. Vérification de sécurité (Middleware)
            caller_id = post.get('caller_user_id')
            if not caller_id:
                return self._json_response({'status': 403, 'message': 'Non autorisé. ID appelant manquant.'}, 403)
                
            caller = request.env['res.users'].sudo().browse(int(caller_id))
            if not caller.exists() or not caller.has_group('base.group_system'):
                return self._json_response({'status': 403, 'message': 'Accès refusé. Droits administrateur (Settings) requis.'}, 403)

            user = request.env['res.users'].sudo().with_context(active_test=False).browse(user_id)

            if not user.exists():
                return self._json_response({'status': 404, 'message': 'Utilisateur introuvable'}, 404)

            cr = request.env.cr

            # active / it_domain_ids
            vals = {}
            if 'active' in post:
                vals['active'] = post['active']
            if vals:
                user.write(vals)

            # domains (list of names → find/create pfe.it.domain records, then link via SQL)
            if 'it_domains' in post:
                domain_names = post['it_domains']  # list of strings e.g. ['Réseau', 'Matériel']
                DomainModel = request.env['pfe.it.domain'].sudo()
                domain_records = []
                for dname in domain_names:
                    rec = DomainModel.search([('name', '=', dname)], limit=1)
                    if rec:
                        domain_records.append(rec.id)
                # Rewrite the Many2many via SQL
                cr.execute(
                    "DELETE FROM res_users_it_domain_rel WHERE user_id = %s",
                    (user_id,)
                )
                for did in domain_records:
                    cr.execute(
                        "INSERT INTO res_users_it_domain_rel (user_id, domain_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (user_id, did)
                    )

            # role
            computed_role = None
            if 'role' in post:
                role = post['role']
                system_group = request.env.ref('base.group_system', raise_if_not_found=False)
                erp_mgr_group= request.env.ref('base.group_erp_manager', raise_if_not_found=False)
                agent_group  = request.env.ref('base.group_user',   raise_if_not_found=False)
                portal_group = request.env.ref('base.group_portal', raise_if_not_found=False)
                tech_group   = request.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)

                if not all([system_group, agent_group, portal_group, tech_group, erp_mgr_group]):
                    return self._json_response({'status': 500, 'message': 'Groupes Odoo introuvables'}, 500)

                if role == 'admin':
                    # L'admin reçoit System (Administration) et ERP Manager (Access Rights)
                    new_gids = [agent_group.id, system_group.id, erp_mgr_group.id]
                    computed_role = 'admin'
                elif role in ('agent', 'tech'):
                    new_gids = [agent_group.id, tech_group.id]
                    computed_role = 'tech'
                else:
                    new_gids = [agent_group.id]
                    computed_role = 'user'

                all_role_gids = [system_group.id, erp_mgr_group.id, tech_group.id, portal_group.id, agent_group.id]

                # Direct SQL – bypasses ORM constraints that silently block group writes
                cr.execute(
                    "DELETE FROM res_groups_users_rel WHERE uid = %s AND gid = ANY(%s)",
                    (user_id, all_role_gids)
                )
                for gid in new_gids:
                    cr.execute(
                        "INSERT INTO res_groups_users_rel (uid, gid) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (user_id, gid)
                    )

                # Update stored computed field directly
                cr.execute(
                    "UPDATE res_users SET x_support_role = %s WHERE id = %s",
                    (computed_role, user_id)
                )

                try:
                    request.env.registry.clear_cache()
                except Exception:
                    pass

            return self._json_response({
                'status': 200,
                'message': 'Utilisateur mis à jour avec succès',
                'x_support_role': computed_role,
            })

        except Exception as e:
            import traceback
            return self._json_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, 500)



