from odoo import http, fields  # type: ignore
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
            
            if x_support_role == 'tech':
                resolved_domain = [('assigned_to_id', '=', user.id), ('state', '=', 'resolved')]
            elif x_support_role == 'admin':
                resolved_domain = [('state', '=', 'resolved')]  # Admin voit tous les tickets résolus
            else:
                resolved_domain = [('user_id', '=', user.id), ('state', '=', 'resolved')]
                
            resolved_tickets = request.env['support.ticket'].sudo().search_count(resolved_domain)

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'phone': user.phone or '',
                    'x_support_role': x_support_role,
                    'it_domains': [d.name for d in user.it_domain_ids],
                    'resolved_tickets': resolved_tickets,
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
                return self._json_response({
                    'status': 409,
                    'message': f"Un compte existe déjà avec l'adresse \"{email}\". Veuillez vous connecter ou utiliser une autre adresse.",
                    'email_exists': True,
                }, 409)

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
            
            if x_support_role == 'tech':
                resolved_domain = [('assigned_to_id', '=', user.id), ('state', '=', 'resolved')]
            elif x_support_role == 'admin':
                resolved_domain = [('state', '=', 'resolved')]  # Admin voit tous les tickets résolus
            else:
                resolved_domain = [('user_id', '=', user.id), ('state', '=', 'resolved')]
                
            resolved_tickets = request.env['support.ticket'].sudo().search_count(resolved_domain)

            return self._json_response({
                'status': 200,
                'data': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email or user.login,
                    'phone': user.phone or '',
                    'x_support_role': x_support_role,
                    'it_domains': [d.name for d in user.it_domain_ids],
                    'resolved_tickets': resolved_tickets,
                    'preferences': {
                        'notif_on_create': user.x_notif_on_create,
                        'notif_on_assign': user.x_notif_on_assign,
                        'notif_on_comment': user.x_notif_on_comment,
                        'notif_on_sla': user.x_notif_on_sla,
                    }
                }
            })

        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/auth/update_profile', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def update_profile(self, **kw):
        """Met à jour les informations du profil de l'utilisateur."""
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
                
            vals = {}
            if 'name' in post:
                vals['name'] = post['name'].strip()
            if 'phone' in post:
                vals['phone'] = post['phone'].strip()
            if 'preferences' in post:
                prefs = post['preferences']
                if 'notif_on_create' in prefs: vals['x_notif_on_create'] = prefs['notif_on_create']
                if 'notif_on_assign' in prefs: vals['x_notif_on_assign'] = prefs['notif_on_assign']
                if 'notif_on_comment' in prefs: vals['x_notif_on_comment'] = prefs['notif_on_comment']
                if 'notif_on_sla' in prefs: vals['x_notif_on_sla'] = prefs['notif_on_sla']
                
            if vals:
                user.write(vals)
                
            return self._json_response({
                'status': 200,
                'message': 'Profil mis à jour avec succès.',
                'data': {
                    'name': user.name,
                    'phone': user.phone or '',
                    'preferences': {
                        'notif_on_create': user.x_notif_on_create,
                        'notif_on_assign': user.x_notif_on_assign,
                        'notif_on_comment': user.x_notif_on_comment,
                        'notif_on_sla': user.x_notif_on_sla,
                    }
                }
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/auth/change_password', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def change_password(self, **kw):
        """Change le mot de passe de l'utilisateur."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            user_id = post.get('user_id')
            old_password = post.get('old_password')
            new_password = post.get('new_password')
            
            if not user_id or not old_password or not new_password:
                return self._json_response({'status': 400, 'message': 'Paramètres manquants.'}, 400)
                
            user = request.env['res.users'].sudo().browse(int(user_id))
            if not user.exists():
                return self._json_response({'status': 404, 'message': 'Utilisateur non trouvé.'}, 404)
                
            # Vérifier l'ancien mot de passe
            login = user.login or user.email
            try:
                credential = {'type': 'password', 'login': login, 'password': old_password}
                uid = request.env['res.users'].sudo().authenticate(credential, {})
                if not uid:
                    raise Exception("Access Denied")
            except Exception:
                return self._json_response({'status': 401, 'message': 'Ancien mot de passe incorrect.'}, 401)
                
            if len(new_password) < 6:
                return self._json_response({'status': 400, 'message': 'Le nouveau mot de passe doit contenir au moins 6 caractères.'}, 400)
                
            user.write({'password': new_password})
            
            return self._json_response({'status': 200, 'message': 'Mot de passe modifié avec succès.'})
            
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
            domain.append(('ai_classification.name', '=ilike', category))

        tickets = env.search(domain, order='create_date desc')
        data = [{
            'id': t.id,
            'name': t.name,
            'description': t.description,
            'state': t.state,
            'priority': t.priority,
            'category': t.ai_classification.name if t.ai_classification else None,
            'x_is_manual_classification': t.x_is_manual_classification,
            'x_accepted': t.x_accepted,
            'user_id': t.user_id.id if t.user_id else None,
            'user_name': t.user_id.name if t.user_id else None,
            'user_email': t.user_id.email or t.user_id.login if t.user_id else None,
            'assigned_to_id': t.assigned_to_id.id if t.assigned_to_id else None,
            'assigned_to': t.assigned_to_id.name if t.assigned_to_id else None,
            'assigned_by_id': t.assigned_by_id.id if t.assigned_by_id else None,
            'assigned_by': t.assigned_by_id.name if t.assigned_by_id else None,
            'escalated_by_id': t.escalated_by_id.id if t.escalated_by_id else None,
            'escalated_by_name': t.escalated_by_id.name if t.escalated_by_id else None,
            'x_escalation_note': t.x_escalation_note,
            # ── SLA Résolution (existant) ──────────────────────────────────────
            'sla_deadline': str(t.sla_deadline) if t.sla_deadline else None,
            'sla_status': t.sla_status or None,
            'x_last_pause_date': str(t.x_last_pause_date) if t.x_last_pause_date else None,
            # ── SLA Réponse (v2) ───────────────────────────────────────────
            'sla_response_deadline': str(t.sla_response_deadline) if t.sla_response_deadline else None,
            'sla_response_status': t.sla_response_status or None,
            'date_first_assigned': str(t.date_first_assigned) if t.date_first_assigned else None,
            # ── Escalade (v2) ──────────────────────────────────────────────────
            'date_escalated': str(t.date_escalated) if t.date_escalated else None,
            'escalation_sla_bonus_hours': t.escalation_sla_bonus_hours or 0.0,
            # ── Timestamps & résolution ───────────────────────────────────────────
            'create_date': str(t.create_date) if t.create_date else None,
            'write_date': str(t.write_date) if t.write_date else None,
            'date_resolved': str(t.date_done) if t.date_done else None,
            'resolution': t.resolution or None,
            'ai_confidence': t.ai_confidence or None,
            'ai_suggested_solution': t.ai_suggested_solution or None,
            # ── Matériel IT lié au ticket ───────────────────────────────────────
            'materials': [{
                'id':        line.material_id.id,
                'name':      line.material_id.name,
                'category':  line.material_id.category,
                'status':    line.status,
                'line_id':   line.id,
                'unit_cost': line.material_id.unit_cost,
                'quantity':  line.quantity,
            } for line in t.material_line_ids],
            'total_material_cost': t.total_material_cost,
            'labor_cost': t.labor_cost,
            'resolution_type': t.resolution_type or None,
            'digital_signature': t.digital_signature.decode('utf-8') if t.digital_signature else None,
            # ── Pause SLA (Smart Timer) ───────────────────────────────────────────
            'x_total_paused_duration': t.x_total_paused_duration or 0.0,
            'x_actual_paused_duration': t.x_actual_paused_duration or 0.0,
            'hourly_rate': t.assigned_to_id.x_hourly_rate if t.assigned_to_id else 0.0,
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
                'ai_classification': False,
                'priority': priority
            }
            if ai_category:
                domain_rec = request.env['pfe.it.domain'].sudo().search([('name', '=ilike', ai_category)], limit=1)
                if domain_rec:
                    vals['ai_classification'] = domain_rec.id

            # Associer le ticket à l'utilisateur connecté
            if user_id and str(user_id).isdigit():
                vals['user_id'] = int(user_id)

            env = request.env['support.ticket'].sudo()
            new_ticket = env.create(vals)

            # Phase 2.4 — Envoyer l'email de confirmation de création
            try:
                self._send_notification(new_ticket, 'email_template_ticket_created')
            except Exception as notif_err:
                _logger.warning("[NOTIF] Erreur création notif: %s", notif_err)

            # Phase 3 — Notification in-app : ticket créé
            try:
                if new_ticket.user_id:
                    ticket_ref = f"TK-{str(new_ticket.id).zfill(4)}"
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=new_ticket.user_id.id,
                        notif_type='ticket_created',
                        message=f"✅ Votre ticket {ticket_ref} a été créé avec succès.",
                        ticket_id=new_ticket.id,
                    )
            except Exception as notif_err:
                _logger.warning("[NOTIF-INAPP] Erreur création notif in-app: %s", notif_err)

            # Phase 2.1 — Notifier tous les Admins du nouveau ticket
            try:
                ticket_ref = f"TK-{str(new_ticket.id).zfill(4)}"
                admin_users = request.env['res.users'].sudo().search([
                    ('x_support_role', '=', 'admin'),
                    ('active', '=', True),
                ])
                notif_env = request.env['support.notification'].sudo()
                for admin in admin_users:
                    notif_env._create_notif(
                        user_id=admin.id,
                        notif_type='ticket_created',
                        message=f"🎫 Nouveau ticket {ticket_ref} créé.",
                        ticket_id=new_ticket.id,
                    )
            except Exception as admin_notif_err:
                _logger.warning("[NOTIF-ADMIN] Erreur notif admin nouveau ticket: %s", admin_notif_err)

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
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS'),
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

    # ─── Phase 2.4 — Déclenchement des Templates Email ──────────────────────
    def _send_notification(self, ticket, template_xmlid, force_email=None):
        """
        Helper centralisé pour envoyer un email de notification via mail.template.
        Vérifie les préférences de l'utilisateur (x_notif_on_*) avant l'envoi.

        template_xmlid → ex: 'email_template_ticket_created'
        force_email    → si fourni, override l'email_to du template
        """
        # Vérification des préférences de notification de l'utilisateur
        notif_pref_map = {
            'email_template_ticket_created':  'x_notif_on_create',
            'email_template_ticket_assigned': 'x_notif_on_assign',
            'email_template_ticket_comment':  'x_notif_on_comment',
            'email_template_sla_breached':    'x_notif_on_sla',
        }
        pref_field = notif_pref_map.get(template_xmlid)
        if pref_field and ticket.user_id:
            user_pref = getattr(ticket.user_id, pref_field, True)
            if not user_pref:
                _logger.info(
                    "[NOTIF] Email ignoré — préférence %s désactivée pour user %s",
                    pref_field, ticket.user_id.login
                )
                return

        # Phase 3.2 — Vérifier que l'utilisateur a un email valide et non-fictif
        recipient = force_email or (ticket.user_id.email if ticket.user_id else None)
        FAKE_DOMAINS = {'test.com', 'example.com', 'fake.com', 'noreply.com', 'invalid.com', 'test.fr', 'localhost'}
        if not recipient:
            _logger.warning(
                "[NOTIF] Pas d'email valide pour le ticket TK-%04d — envoi ignoré.", ticket.id
            )
            return
        domain_part = recipient.split('@')[-1].lower() if '@' in recipient else ''
        if domain_part in FAKE_DOMAINS:
            _logger.info(
                "[NOTIF] Email '%s' ignoré — domaine de test détecté pour TK-%04d.", recipient, ticket.id
            )
            return

        # Charger le template et envoyer
        try:
            template = request.env.ref(
                f'pfe_it_support.{template_xmlid}', raise_if_not_found=False
            )
            if not template:
                _logger.warning("[NOTIF] Template '%s' introuvable dans Odoo.", template_xmlid)
                return

            email_values = {}
            if force_email:
                email_values['email_to'] = force_email

            template.sudo().send_mail(
                ticket.id,
                force_send=True,
                email_values=email_values or None,
            )
            _logger.info(
                "[NOTIF] ✅ Email '%s' envoyé pour TK-%04d → %s",
                template_xmlid, ticket.id, recipient
            )
        except Exception as e:
            # On ne fait jamais planter une action métier à cause d'un email
            _logger.error(
                "[NOTIF] ❌ Échec d'envoi du template '%s' pour TK-%04d : %s",
                template_xmlid, ticket.id, e
            )

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

        # auth='public' → request.env.user est toujours l'utilisateur anonyme.
        # On doit résoudre l'utilisateur réel via la session Odoo ou le payload.
        session_uid = request.session.uid
        is_admin = False
        is_tech_or_admin = False
        
        # Vérification via payload (pour contourner le blocage des cookies CORS)
        requester_role = post.get('requester_role')
        if requester_role in ('admin', 'tech'):
            is_tech_or_admin = True
        
        if session_uid and not is_tech_or_admin:
            session_user = request.env['res.users'].sudo().browse(session_uid)
            is_admin = session_user.has_group('base.group_system')
            has_tech = session_user.has_group('pfe_it_support.group_support_technician')
            is_tech_or_admin = is_admin or has_tech

        if 'name' in post: vals['name'] = post['name']
        if 'description' in post: vals['description'] = post['description']

        if 'priority' in post:
            if not is_tech_or_admin:
                return self._json_response({'status': 403, 'message': 'Seul un agent IT peut modifier la priorité.'}, 403)
            vals['priority'] = post['priority']
            vals['x_is_manual_classification'] = True

        if 'category' in post:
            if not is_tech_or_admin:
                return self._json_response({'status': 403, 'message': 'Seul un agent IT peut modifier la catégorie.'}, 403)
            domain_name = post['category']
            domain_rec = request.env['pfe.it.domain'].sudo().search([('name', '=ilike', domain_name)], limit=1)
            vals['ai_classification'] = domain_rec.id if domain_rec else False
            vals['x_is_manual_classification'] = True

        if 'state' in post: vals['state'] = post['state']
        old_assigned_id = ticket.assigned_to_id.id if ticket.assigned_to_id else None
        new_assigned_id = None
        if 'assigned_to_id' in post:
            new_assigned_id = int(post['assigned_to_id']) if post['assigned_to_id'] else False
            vals['assigned_to_id'] = new_assigned_id

        try:
            ticket.write(vals)

            # Phase 2.2 — Notif in-app au Technicien lors de l'assignation
            if new_assigned_id and new_assigned_id != old_assigned_id:
                try:
                    ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=new_assigned_id,
                        notif_type='ticket_assigned',
                        message=f"📋 Le ticket {ticket_ref} vous a été assigné : {ticket.name[:60]}",
                        ticket_id=ticket.id,
                    )
                    # Email d'assignation vers le tech (force_email sur son adresse)
                    tech_user = request.env['res.users'].sudo().browse(new_assigned_id)
                    if tech_user.exists() and tech_user.email:
                        self._send_notification(ticket, 'email_template_ticket_assigned',
                                                force_email=tech_user.email)
                except Exception as tech_notif_err:
                    _logger.warning("[NOTIF-TECH] Erreur notif assignation technicien: %s", tech_notif_err)

            return self._json_response({'status': 200, 'message': 'Success updated'}, 200)
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

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
            resolution_type = post.get('resolution_type', 'success')
            digital_signature = post.get('digital_signature', False)
            add_to_kb = post.get('add_to_kb', False)
            user_id = post.get('user_id')

            if not resolution_note:
                return self._json_response({'status': 400, 'message': 'La note de résolution est requise.'}, 400)

            # Nettoyer l'en-tête base64 si présent
            if digital_signature and digital_signature.startswith('data:image'):
                digital_signature = digital_signature.split(',')[1]

            # Mettre à jour le ticket (date_done est auto-rempli via le write() override)
            ticket.write({
                'state': 'resolved',
                'resolution': resolution_note,
                'resolution_type': resolution_type,
                'digital_signature': digital_signature,
            })

            # Message public dans le chatter
            ticket.message_post(
                body=f"<b>TICKET RÉSOLU</b> : {resolution_note}",
                message_type='comment',
                subtype_xmlid='mail.mt_comment',
                author_id=int(user_id) if user_id else False
            )

            # Publier dans la base de connaissances si demandé
            if add_to_kb:
                try:
                    import requests
                    tag_names = []
                    try:
                        ia_res = requests.post(
                            "http://ia_api:8000/extract_keywords",
                            json={"description": ticket.description or ticket.name},
                            timeout=5
                        )
                        if ia_res.status_code == 200:
                            tag_names = ia_res.json().get("keywords", [])
                    except Exception as ia_err:
                        _logger.warning("IA keyword extraction failed: %s", ia_err)

                    # Create tags
                    tag_ids = []
                    if tag_names:
                        TagModel = request.env['support.knowledge.tag'].sudo()
                        for tname in tag_names:
                            tname = str(tname).strip()
                            if not tname: continue
                            tag = TagModel.search([('name', '=ilike', tname)], limit=1)
                            if not tag:
                                tag = TagModel.create({'name': tname})
                            tag_ids.append(tag.id)

                    request.env['support.knowledge'].sudo().create({
                        'name': f"[Résolu] {ticket.name}",
                        'problem_description': ticket.description or '',
                        'solution': resolution_note,
                        'category': ticket.ai_classification.name if ticket.ai_classification else 'Autre',
                        'ticket_id': ticket.id,
                        'tag_ids': [(6, 0, tag_ids)] if tag_ids else []
                    })
                except Exception as kb_err:
                    _logger.warning("KB publish failed: %s", kb_err)

            # Phase 2.3 — Notif in-app User et Admin : ticket résolu
            try:
                ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                notif_env = request.env['support.notification'].sudo()
                if ticket.user_id:
                    notif_env._create_notif(
                        user_id=ticket.user_id.id,
                        notif_type='ticket_resolved',
                        message=f"✅ Votre ticket {ticket_ref} a été résolu.",
                        ticket_id=ticket.id,
                    )
                # Notifier les admins
                admin_users = request.env['res.users'].sudo().search([
                    ('x_support_role', '=', 'admin'),
                    ('active', '=', True),
                ])
                for admin in admin_users:
                    notif_env._create_notif(
                        user_id=admin.id,
                        notif_type='ticket_resolved',
                        message=f"✅ Le ticket {ticket_ref} a été résolu.",
                        ticket_id=ticket.id,
                    )
            except Exception as res_notif_err:
                _logger.warning("[NOTIF-USER] Erreur notif résolution user: %s", res_notif_err)

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
            escalation_note = post.get('escalation_note')
            if not escalation_note:
                return self._json_response({'status': 400, 'message': 'Le motif d\'escalade est obligatoire.'}, 400)

            tech_name = 'Technicien'
            if tech_id:
                tech_user = request.env['res.users'].sudo().browse(int(tech_id))
                if tech_user.exists():
                    tech_name = tech_user.name

            vals = {
                'state': 'escalated',
                'assigned_to_id': False,  # Remet dans la file d'attente admin
                'x_accepted': False,      # Réinitialise l'acceptation
                'escalated_by_id': int(tech_id) if tech_id else False,
                'x_escalation_note': escalation_note,
            }
            if tech_id:
                vals['escalated_by_tech_ids'] = [(4, int(tech_id))]
            ticket.write(vals)

            # Enregistrer un commentaire système pour notifier l'admin
            log_note = (
                f"🚨 <b>ESCALADE</b> par <b>{tech_name}</b><br/>"
                f"<b>Motif :</b> {escalation_note}"
            )
            
            # Message public dans le chatter
            ticket.message_post(
                body=log_note,
                message_type='comment',
                subtype_xmlid='mail.mt_comment'
            )

            try:
                request.env['support.ticket.comment'].sudo().create({
                    'ticket_id': ticket_id,
                    'body': log_note,
                    'author_id': int(tech_id) if tech_id else False,
                })
            except Exception as comment_err:
                _logger.warning("Escalation comment failed: %s", comment_err)

            # Phase 2.1 — Notif in-app vers tous les Admins (escalade)
            try:
                ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                admin_users = request.env['res.users'].sudo().search([
                    ('x_support_role', '=', 'admin'),
                    ('active', '=', True),
                ])
                notif_env = request.env['support.notification'].sudo()
                for admin in admin_users:
                    notif_env._create_notif(
                        user_id=admin.id,
                        notif_type='ticket_escalated',
                        message=f"🚨 Escalade sur {ticket_ref} par {tech_name} : {escalation_note[:80]}",
                        ticket_id=ticket.id,
                    )
            except Exception as admin_esc_err:
                _logger.warning("[NOTIF-ADMIN] Erreur notif admin escalade: %s", admin_esc_err)

            # Phase 2.3 — Notif in-app vers le User propriétaire du ticket
            try:
                if ticket.user_id:
                    ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=ticket.user_id.id,
                        notif_type='ticket_escalated',
                        message=f"⬆️ Votre ticket {ticket_ref} a été escaladé à l'administrateur.",
                        ticket_id=ticket.id,
                    )
            except Exception as user_esc_err:
                _logger.warning("[NOTIF-USER] Erreur notif user escalade: %s", user_esc_err)

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
        """Passe un ticket en état 'En attente client' avec une justification."""
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
                body = f"⏸️ **EN ATTENTE CLIENT** : {justification}"
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

            # Phase 2.3 — Notif in-app User : ticket mis en pause
            try:
                if ticket.user_id:
                    ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                    pause_msg = f"⏸️ Votre ticket {ticket_ref} est en attente"
                    if justification:
                        pause_msg += f" : {justification[:80]}"
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=ticket.user_id.id,
                        notif_type='ticket_waiting',
                        message=pause_msg,
                        ticket_id=ticket.id,
                    )
            except Exception as wait_notif_err:
                _logger.warning("[NOTIF-USER] Erreur notif user pause: %s", wait_notif_err)

            return self._json_response({
                'status': 200,
                'message': 'Ticket mis en attente client.',
                'state': 'waiting',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/wait-material', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def wait_material_ticket(self, ticket_id, **kw):
        """Passe un ticket en état 'En attente matériel' (pause SLA) + enregistre le matériel requis."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            justification = post.get('justification', '').strip()
            user_id = post.get('user_id')
            # 'materials' must be a list of dicts: [{'id': 1, 'quantity': 2}]
            materials_payload = post.get('materials', [])
            
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            # Préparer les valeurs à écrire
            write_vals = {'state': 'waiting_material'}
            
            existing_lines = ticket.material_line_ids
            existing_mat_ids = existing_lines.mapped('material_id.id')
            lines_cmd = []
            
            if materials_payload:
                requested_mids = [int(m['id']) for m in materials_payload]
                
                for line in existing_lines:
                    if line.material_id.id not in requested_mids:
                        lines_cmd.append((2, line.id, False))
                    else:
                        # Update quantity if it changed
                        qty = next((m['quantity'] for m in materials_payload if int(m['id']) == line.material_id.id), 1)
                        if line.quantity != qty:
                            lines_cmd.append((1, line.id, {'quantity': qty}))
                            
                for m in materials_payload:
                    mid = int(m['id'])
                    qty = m.get('quantity', 1)
                    if mid not in existing_mat_ids:
                        lines_cmd.append((0, 0, {'material_id': mid, 'quantity': qty, 'status': 'requested'}))
            else:
                lines_cmd.append((5, 0, 0))
                
            write_vals['material_line_ids'] = lines_cmd

            ticket.write(write_vals)

            # Construire le message avec les matériels
            mat_names = []
            if materials_payload:
                mats = request.env['pfe.it.material'].sudo().browse([int(m['id']) for m in materials_payload])
                mat_names = [m.name for m in mats if m.exists()]

            mat_str = ', '.join(mat_names) if mat_names else 'Non spécifié'
            body_parts = ["📦 <b>EN ATTENTE MATÉRIEL</b>"]
            if justification:
                body_parts.append(f"<b>Motif :</b> {justification}")
            body_parts.append(f"<b>Matériel requis :</b> {mat_str}")
            body = "<br/>".join(body_parts)

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

            # Phase 2.3 — Notif in-app User : attente matériel
            try:
                if ticket.user_id:
                    ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                    mat_label = ', '.join(mat_names[:2]) if mat_names else 'matériel requis'
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=ticket.user_id.id,
                        notif_type='ticket_waiting',
                        message=f"📦 Votre ticket {ticket_ref} est en attente de matériel ({mat_label}).",
                        ticket_id=ticket.id,
                    )
            except Exception as mat_notif_err:
                _logger.warning("[NOTIF-USER] Erreur notif user attente matériel: %s", mat_notif_err)

            return self._json_response({
                'status': 200,
                'message': 'Ticket mis en attente matériel. SLA suspendu.',
                'state': 'waiting_material',
                'materials': mat_names,
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/materials', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def save_ticket_materials(self, ticket_id, **kw):
        """Met à jour le matériel requis d'un ticket (sans changer son état)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8'))
            materials_payload = post.get('materials', [])
            
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)
                
            existing_lines = ticket.material_line_ids
            existing_mat_ids = existing_lines.mapped('material_id.id')
            lines_cmd = []
            
            if materials_payload:
                requested_mids = [int(m['id']) for m in materials_payload]
                
                for line in existing_lines:
                    if line.material_id.id not in requested_mids:
                        lines_cmd.append((2, line.id, False))
                    else:
                        qty = next((m['quantity'] for m in materials_payload if int(m['id']) == line.material_id.id), 1)
                        if line.quantity != qty:
                            lines_cmd.append((1, line.id, {'quantity': qty}))
                            
                for m in materials_payload:
                    mid = int(m['id'])
                    qty = m.get('quantity', 1)
                    if mid not in existing_mat_ids:
                        lines_cmd.append((0, 0, {'material_id': mid, 'quantity': qty, 'status': 'requested'}))
            else:
                lines_cmd.append((5, 0, 0))
                
            ticket.write({'material_line_ids': lines_cmd})
            
            materials = [{
                'id':        line.material_id.id,
                'name':      line.material_id.name,
                'category':  line.material_id.category,
                'status':    line.status,
                'line_id':   line.id,
                'unit_cost': line.material_id.unit_cost,
                'quantity':  line.quantity,
            } for line in ticket.material_line_ids]
            
            return self._json_response({
                'status': 200, 
                'message': 'Matériels mis à jour', 
                'data': materials, 
                'total_material_cost': ticket.total_material_cost,
                'state': ticket.state
            })
        except Exception as e:
            import traceback
            return self._json_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, 500)



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
                        domain.append(('category', '=ilike', ticket.ai_classification.name))
                        
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
                            
                            # Phase 4.2 - Notification Spéciale IA
                            try:
                                if ticket.user_id:
                                    request.env['support.notification'].sudo()._create_notif(
                                        user_id=ticket.user_id.id,
                                        notif_type='ia_solution',
                                        message=f"🤖 L'IA a trouvé une solution pour votre ticket TK-{str(ticket.id).zfill(4)}",
                                        ticket_id=ticket.id,
                                    )
                            except Exception as notif_err:
                                _logger.warning("[NOTIF-IA] Erreur création notif IA: %s", notif_err)

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

    @http.route('/api/categories', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
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
    # MATERIALS API
    # ─────────────────────────────────────────────

    @http.route('/api/materials', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_materials(self, **kw):
        """Récupère le catalogue complet de matériel IT."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            mats = request.env['pfe.it.material'].sudo().search([('active', '=', True)], order='category, name')
            data = [{
                'id':            m.id,
                'name':          m.name,
                'category':      m.category,
                'reference':     m.reference or '',
                'qty_available': m.qty_available,
                'unit_cost':     m.unit_cost,
            } for m in mats]
            return self._json_response({'status': 200, 'data': data})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)



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

            # Phase 2.4 — Notifier l'auteur du ticket qu'un message a été ajouté
            # On n'envoie la notif que si l'auteur du commentaire n'est pas lui-même
            commenter_id = int(user_id) if user_id else None
            ticket_owner_id = ticket.user_id.id if ticket.user_id else None
            if commenter_id != ticket_owner_id:
                try:
                    self._send_notification(ticket, 'email_template_ticket_comment')
                except Exception as notif_err:
                    _logger.warning("[NOTIF] Erreur commentaire notif: %s", notif_err)

            # Phase 3 — Notification in-app : nouveau commentaire
            try:
                if ticket.user_id and commenter_id != ticket_owner_id:
                    ticket_ref = f"TK-{str(ticket.id).zfill(4)}"
                    commenter_name = new_comment.author_id.name if new_comment.author_id else (author_name or 'Un agent')
                    request.env['support.notification'].sudo()._create_notif(
                        user_id=ticket.user_id.id,
                        notif_type='new_comment',
                        message=f"💬 {commenter_name} a répondu à votre ticket {ticket_ref}.",
                        ticket_id=ticket.id,
                    )
            except Exception as notif_err:
                _logger.warning("[NOTIF-INAPP] Erreur commentaire notif in-app: %s", notif_err)

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
            elif period == 'yesterday':
                yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                yesterday_end = yesterday_start + timedelta(days=1)
                domain.append(('create_date', '>=', yesterday_start))
                domain.append(('create_date', '<', yesterday_end))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period in ['month', '30days']:
                domain.append(('create_date', '>=', now - timedelta(days=30)))
            elif period == 'custom':
                start_date = kw.get('start_date')
                end_date = kw.get('end_date')
                if start_date and end_date:
                    domain.append(('create_date', '>=', start_date + ' 00:00:00'))
                    domain.append(('create_date', '<=', end_date + ' 23:59:59'))

            total_count = env.search_count(domain)
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])
            
            # Non-resolved context for partition
            open_domain = domain + [('state', 'not in', ('resolved', 'closed'))]
            open_tickets = env.search(open_domain)
            overdue_count = len(open_tickets.filtered(lambda t: t.sla_status == 'breached'))
            at_risk_count = len(open_tickets.filtered(lambda t: t.sla_status == 'at_risk'))
            in_progress_count = len(open_tickets.filtered(lambda t: t.sla_status not in ('breached', 'at_risk')))

            # Répartition par catégorie
            cats_group = env.read_group(domain, ['ai_classification'], ['ai_classification'])
            cat_map = {}
            for cg in cats_group:
                cat_val = cg.get('ai_classification')
                cat_name = cat_val[1] if cat_val else 'Non classé'
                count = cg.get('ai_classification_count', cg.get('__count', 0))
                
                if cat_name == 'Non classé':
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
            elif period == 'yesterday':
                days_to_show = 1
                today_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'week':
                days_to_show = 7
            elif period in ['month', '30days']:
                days_to_show = 30
            elif period == 'custom' and kw.get('start_date') and kw.get('end_date'):
                s = datetime.strptime(kw.get('start_date'), '%Y-%m-%d')
                e = datetime.strptime(kw.get('end_date'), '%Y-%m-%d')
                days_to_show = min((e - s).days + 1, 60)
                today_start = e.replace(hour=0, minute=0, second=0, microsecond=0)
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
                
            # MTTR & SLA centralisé (Basé sur la période sélectionnée)
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            
            # Le dashboard global doit refléter TOUS les tickets résolus de la période
            sla_metrics = env._compute_sla_metrics_for_tickets(resolved_tickets)
            mttr = sla_metrics['mttr']
            sla_compliance = sla_metrics['sla_compliance']
            
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
            tech_id = kw.get('tech_id')
            domain = []
            now = datetime.utcnow()
            
            if period == 'today':
                domain.append(('create_date', '>=', now - timedelta(days=1)))
            elif period == 'yesterday':
                yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                yesterday_end = yesterday_start + timedelta(days=1)
                domain.append(('create_date', '>=', yesterday_start))
                domain.append(('create_date', '<', yesterday_end))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period in ['month', '30days']:
                domain.append(('create_date', '>=', now - timedelta(days=30)))
            elif period == 'custom':
                start_date = kw.get('start_date')
                end_date = kw.get('end_date')
                if start_date and end_date:
                    domain.append(('create_date', '>=', start_date + ' 00:00:00'))
                    domain.append(('create_date', '<=', end_date + ' 23:59:59'))

            # Agents have role 'tech'
            search_domain = [
                ('x_support_role', '=', 'tech'),
                ('active', '=', True)
            ]
            if tech_id:
                search_domain.append(('id', '=', int(tech_id)))
                
            techs = request.env['res.users'].sudo().search(search_domain)
            
            data = []
            env = request.env['support.ticket'].sudo()
            
            for tech in techs:
                # Calculer les stats de résolution pour ce technicien
                # On ne filtre PAS par période ici pour le volume total si on veut la perf globale, 
                # ou on applique le domaine temporel si on veut la perf sur la période.
                # L'énoncé dit "Cohérence avec le dashboard global", donc on applique le domaine.
                tech_domain = domain + [('assigned_to_id', '=', tech.id), ('state', 'in', ('resolved', 'closed'))]
                resolved_tickets = env.search(tech_domain)
                
                sla_metrics = env._compute_sla_metrics_for_tickets(resolved_tickets)
                count = sla_metrics['volume']
                sla_ok_count = sla_metrics['sla_ok_count']
                mttr = sla_metrics['mttr']
                sla_score = sla_metrics['sla_compliance']
                
                avatar_url = f"/web/image/res.users/{tech.id}/avatar_128"
                
                data.append({
                    'id': tech.id,
                    'name': tech.name,
                    'avatar_url': avatar_url,
                    'volume': count,
                    'breached_volume': count - sla_ok_count,
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
            elif period == 'yesterday':
                yesterday_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                yesterday_end = yesterday_start + timedelta(days=1)
                domain.append(('create_date', '>=', yesterday_start))
                domain.append(('create_date', '<', yesterday_end))
            elif period == 'week':
                domain.append(('create_date', '>=', now - timedelta(days=7)))
            elif period in ['month', '30days']:
                domain.append(('create_date', '>=', now - timedelta(days=30)))
            elif period == 'custom':
                start_date = kw.get('start_date')
                end_date = kw.get('end_date')
                if start_date and end_date:
                    domain.append(('create_date', '>=', start_date + ' 00:00:00'))
                    domain.append(('create_date', '<=', end_date + ' 23:59:59'))

            total_count = env.search_count(domain)
            resolved_count = env.search_count(domain + [('state', 'in', ('resolved', 'closed'))])
            
            # Non-resolved context for partition
            open_domain = domain + [('state', 'not in', ('resolved', 'closed'))]
            open_tickets = env.search(open_domain)
            overdue_count = len(open_tickets.filtered(lambda t: t.sla_status == 'breached'))
            at_risk_count = len(open_tickets.filtered(lambda t: t.sla_status == 'at_risk'))
            in_progress_count = len(open_tickets.filtered(lambda t: t.sla_status not in ('breached', 'at_risk')))

            # Répartition par catégorie
            cats_group = env.read_group(domain, ['ai_classification'], ['ai_classification'])
            cat_map = {}
            for cg in cats_group:
                cat_val = cg.get('ai_classification')
                cat_name = cat_val[1] if cat_val else 'Non classé'
                count = cg.get('ai_classification_count', cg.get('__count', 0))
                
                if cat_name == 'Non classé':
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
            elif period == 'yesterday':
                days_to_show = 1
                today_start = (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'week':
                days_to_show = 7
            elif period in ['month', '30days']:
                days_to_show = 30
            elif period == 'custom' and kw.get('start_date') and kw.get('end_date'):
                s = datetime.strptime(kw.get('start_date'), '%Y-%m-%d')
                e = datetime.strptime(kw.get('end_date'), '%Y-%m-%d')
                days_to_show = min((e - s).days + 1, 60)
                today_start = e.replace(hour=0, minute=0, second=0, microsecond=0)
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
                
            # MTTR & SLA centralisé (Basé sur la période sélectionnée)
            resolved_tickets = env.search(domain + [('state', 'in', ('resolved', 'closed'))])
            
            sla_metrics = env._compute_sla_metrics_for_tickets(resolved_tickets)
            mttr = sla_metrics['mttr']
            sla_compliance = sla_metrics['sla_compliance']
            
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
                    'x_hourly_rate': u.x_hourly_rate,
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

            # active / x_hourly_rate
            vals = {}
            if 'active' in post:
                vals['active'] = post['active']
            if 'x_hourly_rate' in post:
                vals['x_hourly_rate'] = float(post['x_hourly_rate'])
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

    @http.route('/api/admin/inventory', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_admin_inventory(self, **kwargs):
        """Récupère tous les matériels demandés pour l'inventaire administrateur."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            lines = request.env['support.ticket.material.line'].sudo().search([])
            
            data = []
            for line in lines:
                mat = line.material_id
                data.append({
                    'id': line.id,
                    'ticket_id': line.ticket_id.id,
                    'ticket_name': line.ticket_id.name,
                    'user_name': line.ticket_id.assigned_to_id.name if line.ticket_id.assigned_to_id else (line.ticket_id.user_id.name if line.ticket_id.user_id else 'Inconnu'),
                    'material_id': mat.id,
                    'material_name': mat.name,
                    'material_reference': mat.reference or '',
                    'quantity': line.quantity,
                    'qty_available': mat.qty_available,
                    'unit_cost': mat.unit_cost,
                    'status': line.status,
                    'ticket_priority': line.ticket_id.priority,
                })
                
            all_materials = request.env['pfe.it.material'].sudo().search([('active', '=', True)])
            total_inventory_value = sum(m.qty_available * m.unit_cost for m in all_materials)

            # Coût main d'œuvre de tous les tickets actifs (non résolus/fermés)
            active_tickets = request.env['support.ticket'].sudo().search([
                ('state', 'not in', ['resolved', 'closed'])
            ])
            total_labor_cost = sum(t.labor_cost for t in active_tickets)
                
            return self._json_response({
                'status': 200,
                'data': data,
                'total_inventory_value': total_inventory_value,
                'total_labor_cost': total_labor_cost,
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)


    @http.route('/api/admin/catalog', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_admin_catalog(self, **kwargs):
        """Retourne le catalogue complet des matériels IT avec leur stock."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            materials = request.env['pfe.it.material'].sudo().search([('active', '=', True)], order='category, name')
            data = []
            for mat in materials:
                data.append({
                    'id': mat.id,
                    'name': mat.name,
                    'reference': mat.reference or '',
                    'category': mat.category or 'other',
                    'qty_available': mat.qty_available,
                    'unit_cost': mat.unit_cost,
                })
                
            total_inventory_value = sum(m.qty_available * m.unit_cost for m in materials)
            return self._json_response({'status': 200, 'data': data, 'total_inventory_value': total_inventory_value})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/admin/catalog/<int:material_id>/stock', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def update_catalog_stock(self, material_id, **kwargs):
        """Incrémente ou décrémente le stock d'un matériel. Payload JSON: { delta: 1 | -1 }"""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            raw = request.httprequest.data.decode('utf-8')
            payload = json.loads(raw) if raw else {}
            delta = int(payload.get('delta', 0))

            if delta not in (1, -1):
                return self._json_response({'status': 400, 'message': 'delta doit être 1 ou -1.'}, 400)

            mat = request.env['pfe.it.material'].sudo().browse(material_id)
            if not mat.exists():
                return self._json_response({'status': 404, 'message': 'Matériel introuvable.'}, 404)

            new_qty = max(0, mat.qty_available + delta)
            mat.write({'qty_available': new_qty})

            return self._json_response({
                'status': 200,
                'message': 'Stock mis à jour.',
                'qty_available': new_qty,
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/admin/catalog/batch', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def update_catalog_batch(self, **kwargs):
        """Met à jour les quantités et/ou coûts de plusieurs matériels en une seule fois."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            raw = request.httprequest.data.decode('utf-8')
            payload = json.loads(raw) if raw else {}
            updates = payload.get('updates', [])

            if not updates or not isinstance(updates, list):
                return self._json_response({'status': 400, 'message': 'Format invalide ou aucune mise à jour.'}, 400)

            updated_count = 0
            for item in updates:
                mat_id = item.get('id')
                if not mat_id:
                    continue
                mat = request.env['pfe.it.material'].sudo().browse(mat_id)
                if mat.exists():
                    vals = {}
                    if 'qty_available' in item:
                        vals['qty_available'] = int(item['qty_available'])
                    if 'unit_cost' in item:
                        vals['unit_cost'] = float(item['unit_cost'])
                    
                    if vals:
                        mat.write(vals)
                        updated_count += 1

            return self._json_response({
                'status': 200,
                'message': f'{updated_count} articles mis à jour avec succès.',
            })
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/admin/inventory/<int:line_id>/ready', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def mark_inventory_ready(self, line_id, **kwargs):
        """Marque une ligne de matériel comme 'ready'."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            line = request.env['support.ticket.material.line'].sudo().browse(line_id)
            if not line.exists():
                return self._json_response({'status': 404, 'message': 'Ligne introuvable.'}, 404)
            
            qty_needed = line.quantity or 1
            if line.material_id.qty_available < qty_needed:
                return self._json_response({'status': 400, 'message': f'Stock insuffisant pour la ressource \'{line.material_id.name}\' (disponible : {line.material_id.qty_available}, demandé : {qty_needed})'}, 400)
                
            line.write({'status': 'ready'})
            
            # Notifier dans le ticket
            ticket = line.ticket_id
            if ticket:
                msg = f"✅ <b>Matériel Disponible</b> : Le matériel {line.material_id.name} est désormais prêt et peut être récupéré par le technicien."
                ticket.message_post(body=msg, message_type='notification')
                
            return self._json_response({'status': 200, 'message': 'Matériel marqué comme prêt.'})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/ticket/<int:ticket_id>/order_material', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def order_inventory_material(self, ticket_id, **kwargs):
        """Marque une ligne de matériel comme 'ordered' (en cours de commande)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
            
        try:
            raw = request.httprequest.data.decode('utf-8')
            payload = json.loads(raw) if raw else {}
            material_id = payload.get('material_id')

            if not material_id:
                return self._json_response({'status': 400, 'message': 'material_id requis.'}, 400)

            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return self._json_response({'status': 404, 'message': 'Ticket introuvable.'}, 404)

            line = request.env['support.ticket.material.line'].sudo().search([
                ('ticket_id', '=', ticket_id),
                ('material_id', '=', int(material_id))
            ], limit=1)

            if not line:
                return self._json_response({'status': 404, 'message': 'Ligne de matériel introuvable pour ce ticket.'}, 404)
                
            line.write({'status': 'ordered'})
            
            # Notifier dans le ticket
            msg = f"PROCÉDURE : Une commande a été initiée pour le matériel {line.material_id.name}."
            ticket.message_post(body=msg, message_type='notification')
                
            return self._json_response({'status': 200, 'message': 'Matériel marqué comme en commande.'})
        except Exception as e:
            return self._json_response({'status': 500, 'message': str(e)}, 500)




    # ─────────────────────────────────────────────
    # CHATBOT HISTORY API
    # ─────────────────────────────────────────────

    @http.route('/api/chat/debug', type='http', auth='public', methods=['GET'], csrf=False)
    def debug_chat(self, **kw):
        histories = request.env['pfe.chat.history'].sudo().search([])
        data = []
        for h in histories:
            msgs = []
            for m in h.message_ids:
                msgs.append({'id': m.id, 'role': m.role, 'content': m.content})
            data.append({'id': h.id, 'name': h.name, 'session_id': h.session_id, 'msgs': msgs})
        return self._cors_response({'data': data})

    @http.route('/api/chat/history', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_chat_history(self, **kw):
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response({'status': 'ok'})

        user_id = kw.get('user_id')
        if not user_id:
            return self._cors_response({'status': 'error', 'message': 'user_id requis.'}, status_code=400)

        try:
            histories = request.env['pfe.chat.history'].sudo().search([('user_id', '=', int(user_id))], order='write_date desc')
            data = []
            for h in histories:
                messages = []
                for msg in h.message_ids:
                    messages.append({
                        'sender': 'bot' if msg.role == 'assistant' else 'user',
                        'text': msg.content,
                        'ticketId': msg.ticket_id,
                        'timestamp': msg.timestamp.isoformat() + 'Z' if msg.timestamp else None
                    })
                
                data.append({
                    'id': h.id,
                    'session_id': h.session_id,
                    'title': h.name,
                    'is_pinned': h.is_pinned,
                    'messages': messages,
                    'date': h.write_date.isoformat() + 'Z' if h.write_date else None
                })
            return self._cors_response({'status': 'success', 'data': data})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("get_chat_history error: %s", e)
            return self._cors_response({'status': 'error', 'message': str(e)}, status_code=500)

    @http.route('/api/chat/history', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def save_chat_history(self, **kw):
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response({'status': 'ok'})

        try:
            import json
            post = json.loads(request.httprequest.data.decode('utf-8'))
            user_id = post.get('user_id')
            session_id = post.get('session_id')
            messages = post.get('messages', [])
            title = post.get('title', 'Nouvelle discussion')

            if not user_id or not session_id:
                return self._cors_response({'status': 'error', 'message': 'user_id et session_id requis.'}, status_code=400)

            # Auto-generate title if it's default
            if title == 'Nouvelle discussion' and messages:
                for msg in messages:
                    if msg.get('sender') == 'user' or msg.get('role') == 'user':
                        content = msg.get('text') or msg.get('content', '')
                        if isinstance(content, str) and content:
                            title = content[:50] + ('...' if len(content) > 50 else '')
                            break

            history = request.env['pfe.chat.history'].sudo().search([
                ('user_id', '=', int(user_id)),
                ('session_id', '=', session_id)
            ], limit=1)

            if not history:
                history = request.env['pfe.chat.history'].sudo().create({
                    'user_id': int(user_id),
                    'session_id': session_id,
                    'name': title
                })
            else:
                if title != 'Nouvelle discussion':
                    history.sudo().write({'name': title})

            history.message_ids.sudo().unlink()

            for msg in messages:
                role = 'assistant' if msg.get('sender') == 'bot' or msg.get('role') == 'assistant' else 'user'
                content = msg.get('text')
                if content is None:
                    content = msg.get('content', '')
                if not isinstance(content, str):
                    content = str(content)

                request.env['pfe.chat.message'].sudo().create({
                    'history_id': history.id,
                    'role': role,
                    'content': content,
                    'ticket_id': msg.get('ticketId')
                })

            return self._cors_response({'status': 'success'})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("save_chat_history error: %s", e)
            return self._cors_response({'status': 'error', 'message': str(e)}, status_code=500)

    @http.route('/api/chat/history/action', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def chat_history_action(self, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response({'status': 'ok'})

        try:
            import json
            post = json.loads(request.httprequest.data.decode('utf-8'))
            user_id = post.get('user_id')
            session_id = post.get('session_id')
            action = post.get('action')

            if not user_id or not session_id or not action:
                return self._cors_response({'status': 'error', 'message': 'user_id, session_id et action requis.'}, status_code=400)

            history = request.env['pfe.chat.history'].sudo().search([
                ('user_id', '=', int(user_id)),
                ('session_id', '=', session_id)
            ], limit=1)

            if not history:
                return self._cors_response({'status': 'error', 'message': 'Historique non trouvé.'}, status_code=404)

            if action == 'delete':
                history.unlink()
            elif action == 'pin':
                history.sudo().write({'is_pinned': not history.is_pinned})
            elif action == 'rename':
                new_title = post.get('title')
                if new_title:
                    history.sudo().write({'name': new_title})

            return self._cors_response({'status': 'success'})
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("chat_history_action error: %s", e)
            return self._cors_response({'status': 'error', 'message': str(e)}, status_code=500)

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 3 — NOTIFICATION CENTER API
    # ─────────────────────────────────────────────────────────────────────────

    @http.route('/api/notifications', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_notifications(self, **kw):
        """Retourne les 20 dernières notifications de l'utilisateur (non lues en premier)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            user_id = kw.get('user_id')
            if not user_id:
                return self._cors_response({'status': 400, 'message': 'user_id requis.'}, 400)

            notifs = request.env['support.notification'].sudo().search([
                ('user_id', '=', int(user_id)),
            ], limit=20, order='create_date desc')

            data = [{
                'id':          n.id,
                'notif_type':  n.notif_type,
                'message':     n.message,
                'ticket_id':   n.ticket_id.id if n.ticket_id else None,
                'ticket_name': n.ticket_id.name if n.ticket_id else None,
                'x_accepted':  n.ticket_id.x_accepted if n.ticket_id else False,
                'is_read':     n.is_read,
                'create_date': str(n.create_date) if n.create_date else None,
                'read_at':     str(n.read_at) if n.read_at else None,
            } for n in notifs]

            unread_count = sum(1 for n in data if not n['is_read'])

            return self._cors_response({
                'status': 200,
                'data': data,
                'unread_count': unread_count,
            })
        except Exception as e:
            return self._cors_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/notifications/<int:notif_id>/read', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def mark_notification_read(self, notif_id, **kw):
        """Marque une notification spécifique comme lue."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            notif = request.env['support.notification'].sudo().browse(notif_id)
            if not notif.exists():
                return self._cors_response({'status': 404, 'message': 'Notification introuvable.'}, 404)
            notif.write({'is_read': True, 'read_at': fields.Datetime.now()})
            return self._cors_response({'status': 200, 'message': 'Notification marquée comme lue.'})
        except Exception as e:
            return self._cors_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/notifications/read-all', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def mark_all_notifications_read(self, **kw):
        """Marque toutes les notifications d'un utilisateur comme lues."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            user_id = post.get('user_id')
            if not user_id:
                return self._cors_response({'status': 400, 'message': 'user_id requis.'}, 400)

            notifs = request.env['support.notification'].sudo().search([
                ('user_id', '=', int(user_id)),
                ('is_read', '=', False),
            ])
            now = datetime.now()
            notifs.write({'is_read': True, 'read_at': now})
            return self._cors_response({'status': 200, 'message': f'{len(notifs)} notification(s) marquée(s) comme lues.'})
        except Exception as e:
            return self._cors_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/notifications/<int:notif_id>', type='http', auth='public', methods=['DELETE', 'OPTIONS'], csrf=False)
    def delete_notification(self, notif_id, **kw):
        """Supprime une notification."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            notif = request.env['support.notification'].sudo().browse(notif_id)
            if not notif.exists():
                return self._cors_response({'status': 404, 'message': 'Notification introuvable.'}, 404)
            notif.unlink()
            return self._cors_response({'status': 200, 'message': 'Notification supprimée.'})
        except Exception as e:
            return self._cors_response({'status': 500, 'message': str(e)}, 500)

    @http.route('/api/notifications/create', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_notification(self, **kw):
        """Crée une notification in-app (utilisé par le service IA ou des appels internes)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            post = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            user_id   = post.get('user_id')
            notif_type = post.get('notif_type')
            message   = post.get('message')
            ticket_id = post.get('ticket_id')

            if not user_id or not notif_type or not message:
                return self._cors_response({'status': 400, 'message': 'user_id, notif_type et message requis.'}, 400)

            notif_env = request.env['support.notification'].sudo()
            notif_env._create_notif(
                user_id=int(user_id),
                notif_type=notif_type,
                message=message,
                ticket_id=int(ticket_id) if ticket_id else None,
            )
            return self._cors_response({'status': 201, 'message': 'Notification créée.'}, 201)
        except Exception as e:
            return self._cors_response({'status': 500, 'message': str(e)}, 500)
