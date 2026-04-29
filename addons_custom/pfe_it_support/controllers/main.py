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

    @http.route('/api/auth/login', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def login(self, **kw):
        """Authentifie un utilisateur via email + mot de passe."""
        _logger.info(">>> REQUÊTE REÇUE : %s %s", request.httprequest.method, request.httprequest.path)
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', [
                ('Access-Control-Allow-Origin', origin),
                ('Access-Control-Allow-Credentials', 'true'),
                ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'),
                ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'),
            ])
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

    @http.route('/api/auth/register', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def register(self, **kw):
        """Crée un nouvel utilisateur (portail)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
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

    @http.route('/api/auth/me', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def get_me(self, **kw):
        """Récupère les infos de l'utilisateur connecté par son ID."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
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

    @http.route('/api/tickets', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_tickets(self, **kw):
        """Récupère la liste de tous les tickets de support."""
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'GET, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)
            
        env = request.env['support.ticket'].sudo()

        # Filtrer par user_id ou assigned_to si fourni
        user_id = kw.get('user_id')
        assigned_to = kw.get('assigned_to')
        category = kw.get('category')
        domain = []
        
        if user_id:
            user = request.env['res.users'].sudo().browse(int(user_id))
            if user.exists() and getattr(user, 'x_support_role', '') != 'admin':
                domain.append(('user_id', '=', int(user_id)))
            
        if assigned_to:
            # "Mes Tickets" : tickets assignés au technicien ET explicitement acceptés
            domain.append(('assigned_to_id', '=', int(assigned_to)))
            domain.append(('x_accepted', '=', True))
            
        if category:
            domain.append(('ai_classification', '=', category))

        tickets = env.search(domain, order='create_date desc')
        data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'state': t.state,
            'priority': t.priority,
            'category': t.ai_classification,
            'x_accepted': t.x_accepted,
            'user_id': t.user_id.id if t.user_id else None,
            'user_name': t.user_id.name if t.user_id else None,
            'user_email': t.user_id.email or t.user_id.login if t.user_id else None,
            'assigned_to_id': t.assigned_to_id.id if t.assigned_to_id else None,
            'assigned_to': t.assigned_to_id.name if t.assigned_to_id else None,
            'escalated_by_id': t.escalated_by_id.id if t.escalated_by_id else None,
            'sla_deadline': str(t.sla_deadline) if t.sla_deadline else None,
            'sla_status': t.sla_status or None,
            'create_date': str(t.create_date) if t.create_date else None,
            'write_date': str(t.write_date) if t.write_date else None,
            'date_resolved': str(t.date_done) if t.date_done else None,
            'resolution': t.resolution or None,
        } for t in tickets]
        headers.append(('Content-Type', 'application/json'))
        return request.make_response(
            json.dumps({'status': 200, 'data': data}),
            headers=headers
        )

    @http.route('/api/ticket/create', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_ticket(self, **kw):
        """Crée un nouveau ticket de support via l'API."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            name = post.get('name')
            description = post.get('description')
            ai_category = post.get('category')
            priority = str(post.get('priority', '1'))
            if priority not in ['0', '1', '2', '3']:
                priority = '1'
            user_id = post.get('user_id')

            if not name or not description:
                return self._json_response({'status': 400, 'message': 'Missing name or description'}, 400)

            vals = {
                'name': name,
                'description': description,
                'ai_classification': ai_category,
                'priority': priority
            }

            # Associer le ticket à l'utilisateur connecté
            if user_id and str(user_id).isdigit():
                vals['user_id'] = int(user_id)

            env = request.env['support.ticket'].sudo()
            new_ticket = env.create(vals)
            return self._json_response({'status': 201, 'message': 'Success', 'ticket_id': new_ticket.id}, 201)
            
        except Exception as e:
            import traceback
            _logger.error("Error in create_ticket: %s", traceback.format_exc())
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    # ─────────────────────────────────────────────
    # UTILS
    # ─────────────────────────────────────────────

    def _cors_response(self, data=None, status_code=200):
        """Helper CORS ultra-permissif pour débloquer le Frontend (OPTIONS et réponses normales)."""
        origin = 'http://localhost:3000'
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'),
            ('Content-Type', 'application/json')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers)
            
        body = json.dumps(data) if data is not None else ''
        response = request.make_response(body, headers)
        response.status_code = status_code
        return response

    def _json_response(self, data, status_code=200):
        """Rétrocompatibilité : utilise _cors_response."""
        return self._cors_response(data, status_code)

    @http.route('/api/ticket/update/<int:ticket_id>', type='http', auth='public', methods=['PUT', 'OPTIONS'], csrf=False)
    def update_ticket(self, ticket_id, **kw):
        """Met à jour un ticket de support via l'API."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        post = json.loads(request.httprequest.data.decode('utf-8'))
        env = request.env['support.ticket'].sudo()
        ticket = env.browse(ticket_id)
        
        if not ticket.exists():
            return self._json_response({'status': 404, 'message': 'Ticket not found'}, 404)

        vals = {}
        if 'name' in post: vals['name'] = post['name']
        if 'description' in post: vals['description'] = post['description']
        if 'priority' in post: vals['priority'] = post['priority']
        if 'category' in post: vals['ai_classification'] = post['category']
        if 'state' in post: vals['state'] = post['state']
        if 'assigned_to_id' in post:
            vals['assigned_to_id'] = int(post['assigned_to_id']) if post['assigned_to_id'] else False

        ticket.write(vals)
        return self._json_response({'status': 200, 'message': 'Success updated'}, 200)

    # ─────────────────────────────────────────────
    # TICKET WORKFLOW ACTIONS API
    # ─────────────────────────────────────────────

    @http.route('/api/ticket/<int:ticket_id>/resolve', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def resolve_ticket(self, ticket_id, **kw):
        """Résout un ticket : enregistre la note de résolution et change le statut."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            resolution_note = post.get('resolution', '').strip()
            add_to_kb = post.get('add_to_kb', False)
            user_id = post.get('user_id')

            if not resolution_note:
                return self._json_response({'status': 400, 'message': 'La note de résolution est requise.'}, 400)

            # Mettre à jour le ticket (date_done est auto-rempli via le write() override)
            ticket.write({
                'state': 'resolved',
                'resolution': resolution_note,
            })

            # Message public dans le chatter
            ticket.message_post(
                body=f"✅ **TICKET RÉSOLU** : {resolution_note}",
                message_type='comment',
                subtype_xmlid='mail.mt_comment',
                author_id=int(user_id) if user_id else False
            )

            # Publier dans la base de connaissances si demandé
            if add_to_kb:
                try:
                    request.env['support.knowledge'].sudo().create({
                        'title': f"[Résolu] {ticket.name}",
                        'content': resolution_note,
                        'category': ticket.ai_classification or 'Général',
                    })
                except Exception as kb_err:
                    _logger.warning("KB publish failed: %s", kb_err)

            return self._json_response({
                'status': 200,
                'message': 'Ticket résolu avec succès.',
                'state': 'resolved',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/escalate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def escalate_ticket(self, ticket_id, **kw):
        """Escalade un ticket vers l'administrateur."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            tech_id = post.get('tech_id')
            tech_name = 'Technicien'
            if tech_id:
                tech_user = request.env['res.users'].sudo().browse(int(tech_id))
                if tech_user.exists():
                    tech_name = tech_user.name

            ticket.write({
                'state': 'escalated',
                'assigned_to_id': False,  # Remet dans la file d'attente admin
                'x_accepted': False,      # Réinitialise l'acceptation
                'escalated_by_id': int(tech_id) if tech_id else False,
            })

            # Enregistrer un commentaire système pour notifier l'admin
            escalation_note = (
                f"🚨 ESCALADE par {tech_name} : Ce ticket nécessite l'intervention d'un administrateur."
            )
            
            # Message public dans le chatter
            ticket.message_post(
                body=escalation_note,
                message_type='comment',
                subtype_xmlid='mail.mt_comment'
            )

            try:
                request.env['support.ticket.comment'].sudo().create({
                    'ticket_id': ticket_id,
                    'body': escalation_note,
                    'author_id': int(tech_id) if tech_id else False,
                })
            except Exception as comment_err:
                _logger.warning("Escalation comment failed: %s", comment_err)

            return self._json_response({
                'status': 200,
                'message': 'Ticket escaladé. L\'administrateur a été notifié.',
                'state': 'escalated',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/unescalate', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def unescalate_ticket(self, ticket_id, **kw):
        """Annule l'escalade d'un ticket et le réassigne au technicien."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            user_id = post.get('user_id')
            
            if ticket.state != 'escalated':
                return self._json_response({'status': 400, 'message': 'Le ticket n\'est pas escaladé.'}, 400)
            
            if ticket.escalated_by_id and user_id and ticket.escalated_by_id.id != int(user_id):
                return self._json_response({'status': 403, 'message': 'Seul le technicien ayant déclenché l\'escalade peut l\'annuler.'}, 403)

            # Revert the escalation
            assigned_id = ticket.escalated_by_id.id if ticket.escalated_by_id else (int(user_id) if user_id else False)
            
            ticket.write({
                'state': 'in_progress',
                'assigned_to_id': assigned_id,
                'x_accepted': True,
                'escalated_by_id': False,
            })

            # Add system comment
            undo_note = "⚠️ Escalade annulée par le technicien."
            ticket.message_post(
                body=undo_note,
                message_type='comment',
                subtype_xmlid='mail.mt_comment'
            )

            try:
                request.env['support.ticket.comment'].sudo().create({
                    'ticket_id': ticket_id,
                    'body': undo_note,
                    'author_id': int(user_id) if user_id else False,
                })
            except Exception as comment_err:
                import logging
                logging.getLogger(__name__).warning("Unescalation comment failed: %s", comment_err)

            return self._json_response({
                'status': 200,
                'message': 'Escalade annulée. Vous avez repris la main sur le ticket.',
                'state': 'in_progress',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/wait', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def wait_ticket(self, ticket_id, **kw):
        """Passe un ticket en état 'En attente' avec une justification."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            justification = post.get('justification', '').strip()
            user_id = post.get('user_id')
            
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            ticket.write({'state': 'waiting'})

            # Ajouter un commentaire explicatif et message public
            if justification:
                body = f"⏸️ **MISE EN ATTENTE** : {justification}"
                ticket.message_post(
                    body=body,
                    message_type='comment',
                    subtype_xmlid='mail.mt_comment',
                    author_id=int(user_id) if user_id else False
                )
                request.env['support.ticket.comment'].sudo().create({
                    'ticket_id': ticket_id,
                    'body': body,
                    'author_id': int(user_id) if user_id else request.env.user.id,
                })

            return self._json_response({
                'status': 200,
                'message': 'Ticket mis en attente.',
                'state': 'waiting',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/resume', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def resume_ticket(self, ticket_id, **kw):
        """Reprend le travail sur un ticket en attente."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            user_id = post.get('user_id')

            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            ticket.write({'state': 'in_progress'})

            # Message public dans le chatter
            ticket.message_post(
                body="▶️ **REPRISE DU TRAVAIL** : Le technicien a repris le traitement du ticket.",
                message_type='comment',
                subtype_xmlid='mail.mt_comment',
                author_id=int(user_id) if user_id else False
            )

            return self._json_response({
                'status': 200,
                'message': 'Ticket repris.',
                'state': 'in_progress',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/ai-analyze', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def ai_analyze_ticket(self, ticket_id, **kw):
        """Proxy vers le service IA pour une analyse détaillée."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            import requests
            ia_url = "http://ia_service:8000/ai_analyze_detailed"
            payload = {"description": f"{ticket.name}\n{ticket.description}"}
            try:
                res = requests.post(ia_url, json=payload, timeout=10)
            except requests.exceptions.ConnectionError:
                res = requests.post("http://127.0.0.1:8000/ai_analyze_detailed", json=payload, timeout=10)
            
            if res.status_code == 200:
                data = res.json()
                
                # Recherche d'un article pertinent avec Llama-3 et filtre de catégorie strict
                data['kb_article_id'] = None
                data['kb_article_title'] = None
                
                if ticket.name or ticket.description:
                    extract_url = "http://ia_service:8000/extract_keywords"
                    payload_extract = {"description": f"{ticket.name}\n{ticket.description}"}
                    
                    keywords = []
                    try:
                        res_extract = requests.post(extract_url, json=payload_extract, timeout=10)
                        if res_extract.status_code == 200:
                            keywords = res_extract.json().get("keywords", [])
                    except Exception:
                        try:
                            res_extract = requests.post("http://127.0.0.1:8000/extract_keywords", json=payload_extract, timeout=10)
                            if res_extract.status_code == 200:
                                keywords = res_extract.json().get("keywords", [])
                        except Exception:
                            pass
                            
                    domain = [('is_published', '=', True)]
                    
                    # 1. Filtrage Strict par Catégorie
                    if ticket.ai_classification:
                        domain.append(('category', '=ilike', ticket.ai_classification))
                        
                    # 2. Recherche Textuelle ciblée avec ilike sur le Titre (logique OU pour éviter les faux négatifs)
                    if keywords:
                        kw_domain = []
                        for _ in range(len(keywords) - 1):
                            kw_domain.append('|')
                        for kw in keywords:
                            kw_domain.append(('name', 'ilike', kw))
                        domain.extend(kw_domain)
                            
                        articles = request.env['support.knowledge'].sudo().search(domain, limit=1)
                        if articles:
                            data['kb_article_id'] = articles[0].id
                            data['kb_article_title'] = articles[0].name

                return self._json_response({'status': 'success', 'data': data})
            else:
                return self._json_response({'status': 'error', 'message': 'IA Service unreachable'}, 502)
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>', type='http', auth='public', methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_ticket(self, ticket_id, **kw):
        """Supprime un ticket de support."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        env = request.env['support.ticket'].sudo()
        ticket = env.browse(ticket_id)
        
        if not ticket.exists():
            return self._json_response({'status': 404, 'message': 'Ticket not found'}, 404)
            
        ticket.unlink()
        return self._json_response({'status': 200, 'message': 'Ticket deleted successfully'}, 200)

    # ─────────────────────────────────────────────
    # CATEGORIES API
    # ─────────────────────────────────────────────

    @http.route('/api/categories', type='http', auth='public', methods=['GET', 'OPTIONS'], cors='*', csrf=False)
    def get_categories(self, **kw):
        """Récupère la liste des catégories de tickets disponibles."""
        try:
            domain_recs = request.env['pfe.it.domain'].sudo().search([])
            categories = [d.name for d in domain_recs]
            
            # Add fallback distinct ai_classification from tickets if we want
            # but getting them from pfe.it.domain should be enough.
            
            return self._json_response({'status': 200, 'data': categories})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    # ─────────────────────────────────────────────
    # AGENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/agents', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_agents(self, **kw):
        """Récupère la liste des techniciens (utilisateurs internes)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
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
            return self._json_response({'status': 500, 'message': str(e)}, status_code=500)

    @http.route('/api/agents/suggest', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_suggested_agents(self, **kw):
        """Récupère une liste d'agents triée par pertinence pour une catégorie."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            category = kw.get('category', '').strip()
            ticket_id = kw.get('ticket_id')
            
            exclude_id = None
            if ticket_id:
                ticket = request.env['support.ticket'].sudo().browse(int(ticket_id))
                if ticket.exists() and ticket.escalated_by_id:
                    exclude_id = ticket.escalated_by_id.id

            # Strictly filter for role 'tech' only
            domain = [('share', '=', False), ('active', '=', True), ('x_support_role', '=', 'tech')]
            users = request.env['res.users'].sudo().search(domain)
            system_group = request.env.ref('base.group_system', raise_if_not_found=False)
            
            all_agents = []
            for u in users:
                if system_group and u.has_group('base.group_system'):
                    continue
                if u.id <= 2:
                    continue
                if exclude_id and u.id == exclude_id:
                    continue
                
                user_domains = [d.name for d in u.it_domain_ids]
                is_expert = bool(category) and category in user_domains
                
                # Compter les tickets actifs
                active_tickets_count = request.env['support.ticket'].sudo().search_count([
                    ('assigned_to_id', '=', u.id),
                    ('state', 'in', ['new', 'in_progress', 'assigned'])
                ])
                
                all_agents.append({
                    'id': u.id,
                    'name': u.name,
                    'email': u.email or u.login,
                    'it_domains': user_domains,
                    'active_tickets': active_tickets_count,
                    'is_expert': is_expert
                })
            
            # Si une catégorie est fournie, filtrer STRICTEMENT par domaine correspondant
            # Fallback : si aucun tech ne correspond, retourner tous les techs
            if category:
                experts = [a for a in all_agents if a['is_expert']]
                agents = experts if experts else all_agents
            else:
                agents = all_agents
            
            # Trier : d'abord les experts, puis le moins de charge de travail
            agents.sort(key=lambda x: (not x['is_expert'], x['active_tickets']))
            
            return self._json_response({'status': 'success', 'data': agents})


        except Exception as e:
            return self._json_response({'status': 'error', 'message': str(e)}, status_code=500)

    # ─────────────────────────────────────────────
    # COMMENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/ticket/<int:ticket_id>/comments', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_comments(self, ticket_id, **kw):
        """Récupère les commentaires d'un ticket"""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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

    @http.route(['/api/ticket/<int:ticket_id>/comment', '/api/ticket/<int:ticket_id>/comment/'], type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def post_comment(self, ticket_id, **kw):
        """Ajoute un commentaire à un ticket (Format HTTP) avec gestion stricte des erreurs."""
        try:
            _logger.info("==> POST /api/ticket/%s/comment - Appel reçu", ticket_id)
            if hasattr(request, 'httprequest'):
                _logger.info("PAYLOAD REÇU : %s", request.httprequest.data)

            if request.httprequest.method == 'OPTIONS':
                return self._cors_response()

            if not isinstance(ticket_id, int):
                return self._cors_response({'status': 400, 'message': 'L\'ID du ticket doit être un entier.'}, 400)

            # Parsing manuel du JSON car type='http'
            raw_data = request.httprequest.data.decode('utf-8')
            data = json.loads(raw_data) if raw_data else {}
            
            # Support des deux formats : direct ou via params
            params = data.get('params', {}) if 'params' in data else data
            body = params.get('body')
            user_id = params.get('user_id')
            author_name = params.get('author')

            if not body or not str(body).strip():
                _logger.warning("Le corps du commentaire est vide.")
                return self._cors_response({'status': 400, 'message': 'Le corps du commentaire est requis.'}, 400)

            ticket = request.env['support.ticket'].sudo().browse(int(ticket_id))
            if not ticket.exists():
                _logger.warning(f"Ticket {ticket_id} introuvable.")
                return self._cors_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            vals = {
                'ticket_id': ticket.id,
                'body': str(body).strip(),
            }
            if user_id:
                vals['author_id'] = int(user_id)
            else:
                vals['author'] = str(author_name) if author_name else 'Utilisateur Inconnu'

            _logger.info(f"Création du commentaire avec les valeurs : {vals}")
            new_comment = request.env['support.ticket.comment'].sudo().create(vals)
            _logger.info(f"Commentaire créé avec l'ID : {new_comment.id}")

            # Message public dans le chatter Odoo
            ticket.message_post(
                body=body,
                message_type='comment',
                subtype_xmlid='mail.mt_comment'
            )
            
            return self._cors_response({
                'status': 201, 
                'message': 'Commentaire ajouté.',
                'data': {
                    'id': new_comment.id,
                    'author': new_comment.author_id.name if new_comment.author_id else new_comment.author,
                    'date': str(new_comment.create_date) if new_comment.create_date else None,
                    'body': new_comment.body,
                }
            }, 201)
        except Exception as e:
            import traceback
            _logger.error("DÉTAIL CRASH : %s", e)
            _logger.error(traceback.format_exc())
            return self._cors_response({'status': 500, 'message': f'Erreur interne: {str(e)}'}, 500)

    # ─────────────────────────────────────────────
    # ATTACHMENTS API
    # ─────────────────────────────────────────────

    @http.route('/api/ticket/<int:ticket_id>/upload', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def upload_attachment(self, ticket_id, **kw):
        """Upload une ou plusieurs pièces jointes pour un ticket."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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

    @http.route('/api/ticket/<int:ticket_id>/attachments', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_attachments(self, ticket_id, **kw):
        """Récupère la liste des pièces jointes d'un ticket."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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

    @http.route('/api/attachment/<int:attachment_id>', type='http', auth='public', methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_attachment(self, attachment_id, **kw):
        """Supprime une pièce jointe."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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
    
    @http.route('/api/admin/stats', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def admin_stats(self, **kw):
        """Récupère les statistiques pour le dashboard administrateur."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])
            
            # Non-resolved context for partition
            open_domain = domain + [('state', 'not in', ('resolved', 'closed'))]
            overdue_count = env.search_count(open_domain + [('sla_status', '=', 'breached')])
            at_risk_count = env.search_count(open_domain + [('sla_status', '=', 'at_risk')])
            in_progress_count = env.search_count(open_domain + [('sla_status', 'not in', ('breached', 'at_risk'))])

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
                    elif 'securite' in n: norm_name = "Sécurité"
                    else: norm_name = base.capitalize()
                    
                cat_map[norm_name] = cat_map.get(norm_name, 0) + count

            category_stats = [{'name': k, 'value': v} for k, v in cat_map.items()]

            # Trend calculation (Volume réel par jour)
            trend_stats = []
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if period == 'today':
                days_to_show = 1
            elif period == 'week':
                days_to_show = 7
            elif period == 'month':
                days_to_show = 30
            else: # 'all'
                days_to_show = 30 # For chart clarity, keep last 30 days
            
            jour_mapping = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
            for i in range(days_to_show - 1, -1, -1):
                day_start = today_start - timedelta(days=i)
                day_end = day_start + timedelta(days=1)
                cnt = env.search_count([('create_date', '>=', day_start), ('create_date', '<', day_end)])
                day_name = day_start.strftime("%a")
                trend_stats.append({
                    'name': jour_mapping.get(day_name, day_name) if days_to_show <= 7 else day_start.strftime("%d/%m"),
                    'date': day_start.strftime("%Y-%m-%d"),
                    'tickets': cnt
                })
                
            # MTTR & SLA (Basé sur la période sélectionnée)
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            total_duration_hours = 0
            sla_ok_count = 0
            tech_resolved_t_count = 0
            
            for rt in resolved_tickets:
                if not rt.assigned_to_id or rt.assigned_to_id.x_support_role not in ['tech', 'agent']:
                    continue
                    
                tech_resolved_t_count += 1
                # Utilise write_date par defaut car date_done n'est pas encore dans la BDD
                final_date = getattr(rt, 'date_done', rt.write_date) if hasattr(rt, 'date_done') else rt.write_date
                if rt.create_date and final_date:
                    diff = final_date - rt.create_date
                    total_duration_hours += diff.total_seconds() / 3600.0
                if rt.sla_status == 'on_track':
                    sla_ok_count += 1
            
            mttr = 0
            sla_compliance = 0
            
            if tech_resolved_t_count > 0:
                mttr = round(total_duration_hours / tech_resolved_t_count, 1)
                sla_compliance = round((sla_ok_count / tech_resolved_t_count) * 100, 1)
            else:
                sla_compliance = 0 # Par défaut si aucun ticket résolu par technicien
            
            data = {
                'counters': {
                    'total': total_count,
                    'resolved': resolved_count,
                    'overdue': overdue_count,
                    'at_risk': at_risk_count,
                    'in_progress': in_progress_count,
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

    @http.route('/api/admin/technicians/performance', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def tech_performance(self, **kw):
        """Récupère la performance détaillée SLA par technicien pour le drill-down."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            period = kw.get('period', 'all')
            domain = []
            now = datetime.utcnow()
            
            if period == 'today':
                domain.append(('create_date', '>=', now - timedelta(days=1)))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period == 'month':
                domain.append(('create_date', '>=', now - timedelta(days=30)))

            # Agents have role 'tech'
            techs = request.env['res.users'].sudo().search([
                ('x_support_role', '=', 'tech'),
                ('active', '=', True)
            ])
            
            data = []
            env = request.env['support.ticket'].sudo()
            
            for tech in techs:
                # Calculer les stats de résolution pour ce technicien
                # On ne filtre PAS par période ici pour le volume total si on veut la perf globale, 
                # ou on applique le domaine temporel si on veut la perf sur la période.
                # L'énoncé dit "Cohérence avec le dashboard global", donc on applique le domaine.
                tech_domain = domain + [('assigned_to_id', '=', tech.id), ('state', 'in', ('resolved', 'closed'))]
                resolved_tickets = env.search(tech_domain)
                
                total_duration_hours = 0
                sla_ok_count = 0
                count = len(resolved_tickets)
                
                for rt in resolved_tickets:
                    # Sécurité : date_done est le champ officiel de fin de SLA
                    final_date = getattr(rt, 'date_done', rt.write_date) if hasattr(rt, 'date_done') and rt.date_done else rt.write_date
                    if rt.create_date and final_date:
                        diff = final_date - rt.create_date
                        total_duration_hours += diff.total_seconds() / 3600.0
                    
                    # Le statut SLA est déjà calculé par Odoo
                    if rt.sla_status == 'on_track':
                        sla_ok_count += 1
                        
                mttr = round(total_duration_hours / count, 1) if count > 0 else 0
                sla_score = round((sla_ok_count / count) * 100, 1) if count > 0 else 0
                
                avatar_url = f"/web/image/res.users/{tech.id}/avatar_128"
                
                data.append({
                    'id': tech.id,
                    'name': tech.name,
                    'avatar_url': avatar_url,
                    'volume': count,
                    'sla_score': sla_score,
                    'mttr': mttr,
                })
                
            # Tri par score SLA décroissant, puis par volume
            data.sort(key=lambda x: (x['sla_score'], x['volume']), reverse=True)
            
            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/tech/stats', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def tech_stats(self, **kw):
        """Récupère les statistiques pour le dashboard agent."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])
            
            # Non-resolved context for partition
            open_domain = domain + [('state', 'not in', ('resolved', 'closed'))]
            overdue_count = env.search_count(open_domain + [('sla_status', '=', 'breached')])
            at_risk_count = env.search_count(open_domain + [('sla_status', '=', 'at_risk')])
            in_progress_count = env.search_count(open_domain + [('sla_status', 'not in', ('breached', 'at_risk'))])

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

            # Trend calculation (Volume réel par jour)
            trend_stats = []
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if period == 'today':
                days_to_show = 1
            elif period == 'week':
                days_to_show = 7
            elif period == 'month':
                days_to_show = 30
            else: # 'all'
                days_to_show = 30 # For chart clarity, keep last 30 days
            
            jour_mapping = {'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mer', 'Thu': 'Jeu', 'Fri': 'Ven', 'Sat': 'Sam', 'Sun': 'Dim'}
            for i in range(days_to_show - 1, -1, -1):
                day_start = today_start - timedelta(days=i)
                day_end = day_start + timedelta(days=1)
                cnt = env.search_count(domain + [('create_date', '>=', day_start), ('create_date', '<', day_end)])
                day_name = day_start.strftime("%a")
                trend_stats.append({
                    'name': jour_mapping.get(day_name, day_name) if days_to_show <= 7 else day_start.strftime("%d/%m"),
                    'date': day_start.strftime("%Y-%m-%d"),
                    'tickets': cnt
                })
                
            # MTTR & SLA (Basé sur la période sélectionnée)
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            total_duration_hours = 0
            sla_ok_count = 0
            
            for rt in resolved_tickets:
                # Utilise write_date par defaut car date_done n'est pas encore dans la BDD
                final_date = getattr(rt, 'date_done', rt.write_date) if hasattr(rt, 'date_done') else rt.write_date
                if rt.create_date and final_date:
                    diff = final_date - rt.create_date
                    total_duration_hours += diff.total_seconds() / 3600.0
                if rt.sla_status == 'on_track':
                    sla_ok_count += 1
            
            mttr = 0
            sla_compliance = 0
            resolved_t_count = len(resolved_tickets)
            
            if resolved_t_count > 0:
                mttr = round(total_duration_hours / resolved_t_count, 1)
                sla_compliance = round((sla_ok_count / resolved_t_count) * 100, 1)
            else:
                sla_compliance = 0 # Par défaut si aucun ticket résolu
            
            data = {
                'counters': {
                    'total': total_count,
                    'resolved': resolved_count,
                    'overdue': overdue_count,
                    'at_risk': at_risk_count,
                    'in_progress': in_progress_count,
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

    @http.route('/api/admin/users', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def admin_get_users(self, **kw):
        """Récupère la liste de tous les utilisateurs (pour le dashboard Admin)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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

    @http.route('/api/admin/users/<int:user_id>', type='http', auth='public', methods=['PUT', 'OPTIONS'], csrf=False)
    def admin_update_user(self, user_id, **kw):
        """Met à jour un utilisateur (rôle, domaine, statut actif)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

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



