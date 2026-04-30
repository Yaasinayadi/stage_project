from odoo import http
from odoo.http import request
import json
import logging

_logger = logging.getLogger(__name__)
class TicketController(http.Controller):
    
    @http.route('/api/tickets/queue', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_tickets_queue(self, **kwargs):
        """
        Récupère les tickets non assignés ou ceux qui requièrent une prise en charge rapide
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'GET, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)
            
        try:
            priority_field = request.env['support.ticket'].fields_get(allfields=['priority'])['priority']['selection']
            priority_dict = dict(priority_field)
            
            # Initialization
            priority_counts = {p[0]: {'id': p[0], 'label': p[1], 'count': 0} for p in priority_field}
            
            # Identify the caller from query params (our login uses custom token, not Odoo session)
            caller_id = kwargs.get('user_id')
            caller_role = kwargs.get('role', '')
            is_admin = caller_role == 'admin'

            if caller_id:
                caller_id = int(caller_id)
                calling_user = request.env['res.users'].sudo().browse(caller_id)
            else:
                # Fallback: use session user
                calling_user = request.env.user
                is_admin = calling_user.has_group('base.group_system')

            import logging
            _logger = logging.getLogger(__name__)
            _logger.info(f"QUEUE DEBUG: caller_id={caller_id} caller_role={caller_role} is_admin={is_admin}")

            domain = [('state', 'not in', ['resolved', 'closed'])]
            if not is_admin:
                expertise_ids = calling_user.it_domain_ids.ids if hasattr(calling_user, 'it_domain_ids') else []
                _logger.info(f"QUEUE DEBUG: expertise={expertise_ids}")
                domain = [
                    '|',
                    '&', ('assigned_to_id', '=', calling_user.id), ('x_accepted', '=', False),
                    '&', ('assigned_to_id', '=', False), ('ai_classification', 'in', expertise_ids)
                ] + domain
                # Hide tickets escalated by this tech
                domain = ['|', ('escalated_by_id', '=', False), ('escalated_by_id', '!=', calling_user.id)] + domain
            else:
                domain = [('assigned_to_id', '=', False)] + domain

            # Search
            tickets = request.env['support.ticket'].sudo().search(domain, order='priority desc, create_date desc')
            _logger.info(f"QUEUE DEBUG: found {len(tickets)} tickets ids={tickets.ids}")
            
            data = []
            for t in tickets:
                if t.priority in priority_counts:
                    priority_counts[t.priority]['count'] += 1
                data.append({
                    'id': t.id,
                    'name': t.name,
                    'description': t.description,
                    'priority': t.priority,
                    'priority_label': priority_dict.get(t.priority, t.priority),
                    'state': t.state,
                    'x_accepted': t.x_accepted,
                    'assigned_to_id': t.assigned_to_id.id if t.assigned_to_id else None,
                    'assigned_by_id': t.assigned_by_id.id if t.assigned_by_id else None,
                    'create_date': str(t.create_date) if t.create_date else None,
                    'sla_deadline': str(t.sla_deadline) if t.sla_deadline else None,
                    'sla_status': t.sla_status or None,
                    'user_id': t.user_id.name if t.user_id else None,
                    'category': t.ai_classification.name if t.ai_classification else None,
                })
            
            priorities_list = sorted(list(priority_counts.values()), key=lambda x: str(x['id']), reverse=True)
            
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 'success', 'data': data, 'priorities': priorities_list}),
                headers=headers
            )
        except Exception as e:
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=headers,
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/assign', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def assign_ticket(self, ticket_id, **kwargs):
        """
        Assigne un ticket au technicien en cours de session.
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'PATCH, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)
            
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=headers, status=404)
            
            body = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            user_id = int(body.get('user_id', 0))
            if not user_id:
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(
                    json.dumps({'status': 'error', 'message': 'user_id requis pour assigner le ticket'}),
                    headers=headers, status=400
                )
            
            # Tech takes an unassigned ticket themselves: assign + auto-accept
            ticket.write({
                'assigned_to_id': user_id,
                'assigned_by_id': user_id,
                'x_accepted': True,
                'state': 'in_progress'
            })
            
            tech_name = request.env['res.users'].sudo().browse(user_id).name or 'Technicien'
            formatted_ref = f"TK-{str(ticket.id).zfill(4)}"
            
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({
                    'status': 'success', 
                    'message': f"Le ticket {formatted_ref} a été attribué avec succès à {tech_name}."
                }),
                headers=headers
            )
        except Exception as e:
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=headers,
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/accept', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def accept_ticket(self, ticket_id, **kwargs):
        """
        Technicien accepte officiellement la mission : x_accepted = True, state = in_progress.
        Le ticket disparaît de la File d'attente et rejoint 'Mes Tickets'.
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'PATCH, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)
            
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=headers, status=404)
            
            # Accept the mission: mark as accepted and transition to in_progress
            ticket.write({
                'x_accepted': True,
                'state': 'in_progress'
            })
            
            tech_name = ticket.assigned_to_id.name if ticket.assigned_to_id else 'Technicien'
            formatted_ref = f"TK-{str(ticket.id).zfill(4)}"
            
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({
                    'status': 'success', 
                    'message': f"Le ticket {formatted_ref} a été attribué avec succès à {tech_name}."
                }),
                headers=headers
            )
        except Exception as e:
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=headers,
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/dispatch', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def dispatch_ticket(self, ticket_id, **kwargs):
        """
        Assigne manuellement un ticket à un technicien cible (Admin).
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'POST, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)
            
        try:
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=headers, status=404)
            
            body = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            target_user_id = int(body.get('target_user_id', 0))
            caller_user_id = body.get('caller_user_id')
            if not target_user_id:
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(
                    json.dumps({'status': 'error', 'message': 'target_user_id requis pour assigner le ticket'}),
                    headers=headers, status=400
                )
            
            ticket.write({
                'assigned_to_id': target_user_id,
                'assigned_by_id': int(caller_user_id) if caller_user_id else request.env.user.id,
                'x_accepted': False,
                'state': 'assigned'
            })
            
            target_user = request.env['res.users'].sudo().browse(target_user_id)
            tech_name = target_user.name or 'Technicien'
            formatted_ref = f"TK-{str(ticket.id).zfill(4)}"
            
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({
                    'status': 'success', 
                    'message': f"Le ticket {formatted_ref} a été attribué avec succès à {tech_name}."
                }),
                headers=headers
            )
        except Exception as e:
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 'error', 'message': str(e)}),
                headers=headers,
                status=500
            )

    @http.route('/api/ticket/<int:ticket_id>/transfer', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def transfer_ticket(self, ticket_id, **kwargs):
        """
        Transfère l'assignation du ticket ou l'escalade
        """
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

    @http.route('/api/ticket/<int:ticket_id>/ai-suggest', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def ai_suggest_diagnostic(self, ticket_id, **kwargs):
        """
        Interroge le microservice IA pour un diagnostic assisté basé sur la description.
        """
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
                ai_cat_name = ai_data.get('category')
                domain_rec = request.env['pfe.it.domain'].sudo().search([('name', '=ilike', ai_cat_name)], limit=1)
                ticket.write({
                    'ai_classification': domain_rec.id if domain_rec else False,
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

    @http.route('/api/ticket/<int:ticket_id>/resolve', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
    def resolve_ticket(self, ticket_id, **kwargs):
        """
        Marque le ticket comme résolu et publie Optionnellement la solution dans la KB
        """
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
                    'category': ticket.ai_classification.name if ticket.ai_classification else 'Support',
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

    # ═══════════════════════════════════════════════════════════════════════
    # HELPERS & CORS
    # ═══════════════════════════════════════════════════════════════════════

    def _cors_response(self, data=None, status=200):
        """Garantit que TOUTES les réponses (même les erreurs 500) ont les bons headers CORS."""
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'),
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers, status=200)
            
        body = json.dumps(data) if data is not None else ''
        return request.make_response(body, headers=headers, status=status)

    # ═══════════════════════════════════════════════════════════════════════
    # KNOWLEDGE BASE API
    # ═══════════════════════════════════════════════════════════════════════

    def _kb_article_to_dict(self, kb, full=False):
        """Sérialise un article KB en dict JSON.
        full=True : inclut le HTML complet (pour la vue détail).
        full=False : inclut uniquement le solution_preview (pour la liste/cartes).
        """
        tags = [{'id': t.id, 'name': t.name} for t in kb.tag_ids] if hasattr(kb, 'tag_ids') else []
        data = {
            'id': kb.id,
            'title': kb.name,
            'category': kb.category,
            'author': kb.author_id.name if kb.author_id else 'Inconnu',
            'author_id': kb.author_id.id if kb.author_id else None,
            'date': kb.write_date.isoformat() if getattr(kb, 'write_date', None) else None,
            'write_date': str(kb.write_date) if getattr(kb, 'write_date', None) else None,
            'is_published': kb.is_published,
            'tags': tags,
            'solution_preview': getattr(kb, 'solution_preview', '') or ''
        }
        
        # Always add solution for now to prevent frontend issues, 
        # or rely on 'full' parameter. The stashed changes returned it unconditionally.
        data['solution'] = kb.solution

        if hasattr(kb, 'ticket_id') and kb.ticket_id:
            data['ticket_id'] = kb.ticket_id.id
            data['source_ticket_id'] = kb.ticket_id.id
            data['source_ticket_ref'] = kb.ticket_id.name

        return data

    @http.route('/api/knowledge', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_knowledge_list(self, **kw):
        """Récupère la liste paginée des articles KB."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            domain = []
            category       = kw.get('category')
            search         = kw.get('search')
            published_only = kw.get('published_only')

            if category:
                domain.append(('category', '=', category))
            if search:
                domain += ['|', ('name', 'ilike', search), ('solution', 'ilike', search)]
            if published_only in ('1', 'true', 'True'):
                domain.append(('is_published', '=', True))

            # ── Pagination ──
            try:
                page  = max(1, int(kw.get('page', 1)))
                limit = max(1, int(kw.get('limit', 12)))
            except (ValueError, TypeError):
                page, limit = 1, 12

            KB = request.env['support.knowledge'].sudo()
            total  = KB.search_count(domain)
            pages  = max(1, -(-total // limit))
            offset = (page - 1) * limit

            articles = KB.search(domain, order='write_date desc', limit=limit, offset=offset)
            data = [self._kb_article_to_dict(a) for a in articles]

            return self._cors_response({
                'status': 200,
                'data': data,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total': total,
                    'pages': pages,
                }
            })
        except Exception as e:
            import traceback
            _logger.error("Erreur GET /api/knowledge : %s\n%s", e, traceback.format_exc())
            return self._cors_response({'status': 500, 'message': str(e)}, status=500)

    # ─── GET / PUT / DELETE /api/knowledge/<id> ──────────────────────────────
    @http.route('/api/knowledge/<int:article_id>', type='http', auth='public', methods=['GET', 'PUT', 'DELETE', 'OPTIONS'], csrf=False)
    def manage_knowledge_detail(self, article_id, **kw):
        """Gère le détail, la mise à jour et la suppression d'un article.
        Fusionné en une seule route pour que Odoo génère correctement les headers OPTIONS (CORS)."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            if request.httprequest.data:
                _logger.info("Données reçues sur manage_knowledge_detail (%s) : %s", request.httprequest.method, request.httprequest.data)

            kb = request.env['support.knowledge'].sudo().browse(article_id)
            if not kb.exists():
                return self._cors_response({'status': 404, 'message': 'Article introuvable.'}, status=404)

            # ─── GET ───
            if request.httprequest.method == 'GET':
                return self._cors_response({'status': 200, 'data': self._kb_article_to_dict(kb, full=True)})

            # ─── PUT ───
            elif request.httprequest.method == 'PUT':
                post = json.loads(request.httprequest.data.decode('utf-8'))
                requester_id    = post.get('requester_id')
                requester_role  = post.get('requester_role', 'user')

                if requester_role == 'tech':
                    if not requester_id or kb.author_id.id != int(requester_id):
                        return self._cors_response({'status': 403, 'message': 'Vous ne pouvez modifier que vos propres articles.'}, status=403)
                elif requester_role not in ('admin',):
                    return self._cors_response({'status': 403, 'message': 'Accès non autorisé.'}, status=403)

                vals = {}
                if 'title'        in post: vals['name']         = post['title']
                if 'solution'     in post: vals['solution']      = post['solution']
                if 'category'     in post: vals['category']      = post['category']
                if 'is_published' in post: vals['is_published']  = bool(post['is_published'])
                if 'tag_names'    in post:
                    tag_ids = []
                    TagModel = request.env['support.knowledge.tag'].sudo()
                    for name in post['tag_names']:
                        name = str(name).strip()
                        if not name: continue
                        tag = TagModel.search([('name', '=ilike', name)], limit=1)
                        if not tag:
                            tag = TagModel.create({'name': name})
                        tag_ids.append(tag.id)
                    vals['tag_ids'] = [(6, 0, tag_ids)]

                kb.sudo().write(vals)
                return self._cors_response({'status': 200, 'message': 'Article mis à jour.', 'data': self._kb_article_to_dict(kb, full=True)})

            # ─── DELETE ───
            elif request.httprequest.method == 'DELETE':
                post = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
                requester_role = post.get('requester_role', 'user')

                if requester_role != 'admin':
                    return self._cors_response({'status': 403, 'message': 'Seul un administrateur peut supprimer un article.'}, status=403)

                kb.sudo().unlink()
                return self._cors_response({'status': 200, 'message': 'Article supprimé.'})

        except Exception as e:
            import traceback
            _logger.error("Erreur manage_knowledge_detail : %s\n%s", e, traceback.format_exc())
            return self._cors_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, status=500)

    @http.route('/api/knowledge/create', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_knowledge_base(self, **kwargs):
        """
        Crée manuellement un article de la base de connaissances.
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'POST, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        ]
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()

        try:
            # Parse JSON body
            body = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}

            title        = body.get('title', '').strip() if body.get('title') else ''
            solution     = body.get('solution', '').strip() if body.get('solution') else ''
            category     = body.get('category', '').strip() if body.get('category') else None
            is_published = bool(body.get('is_published', False))
            author_id    = body.get('author_id')
            ticket_id    = body.get('source_ticket_id') or body.get('ticket_id')
            tag_names    = body.get('tag_names', [])
            if not title or not solution:
                headers.append(('Content-Type', 'application/json'))
                return request.make_response(
                    json.dumps({'status': 400, 'message': 'Le titre et la solution sont requis.'}),
                    headers=headers, status=400
                )

            vals = {
                'name':         title,
                'solution':     solution,
                'is_published': is_published,
            }
            if category:
                vals['category'] = category
            if author_id:
                vals['author_id'] = int(author_id)
            if ticket_id:
                vals['ticket_id'] = int(ticket_id)
            if tag_names:
                tag_ids = []
                TagModel = request.env['support.knowledge.tag'].sudo()
                for name in tag_names:
                    name = str(name).strip()
                    if not name:
                        continue
                    tag = TagModel.search([('name', '=ilike', name)], limit=1)
                    if not tag:
                        tag = TagModel.create({'name': name})
                    tag_ids.append(tag.id)
                vals['tag_ids'] = [(6, 0, tag_ids)]

            new_kb = request.env['support.knowledge'].sudo().create(vals)

            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({
                    'status': 201,
                    'message': f"L'article \"{title}\" a été publié avec succès dans la base de connaissances.",
                    'data': {
                        'id': new_kb.id,
                        'title': new_kb.name,
                        'category': new_kb.category,
                        'is_published': new_kb.is_published,
                    }
                }),
                headers=headers, status=201
            )
        except Exception as e:
            import traceback
            _logger.error("Erreur create_knowledge : %s\n%s", e, traceback.format_exc())
            headers.append(('Content-Type', 'application/json'))
            return request.make_response(
                json.dumps({'status': 500, 'message': str(e)}),
                headers=headers, status=500
            )

    # ─── GET /api/knowledge/export  (export RAG) ────────────────────────────
    @http.route('/api/knowledge/export', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def export_knowledge_rag(self, **kw):
        """Export de tous les articles publiés en texte brut pour indexation RAG/LLM."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            articles = request.env['support.knowledge'].sudo().search(
                [('is_published', '=', True)], order='write_date desc'
            )
            data = []
            for a in articles:
                data.append({
                    'id':               a.id,
                    'title':            a.name,
                    'content':          a.solution_preview,   # texte brut (HTML strippé)
                    'category':         a.category,
                    'tags':             [t.name for t in a.tag_ids],
                    'source_ticket_id': a.ticket_id.id if a.ticket_id else None,
                })
            return self._cors_response({'status': 200, 'count': len(data), 'data': data})
        except Exception as e:
            import traceback
            _logger.error("Erreur export_knowledge_rag : %s\n%s", e, traceback.format_exc())
            return self._cors_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, status=500)
    @http.route('/api/agents/suggest', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def suggest_agents(self, **kwargs):
        """
        Suggère des agents pour l'assignation en fonction de la catégorie (expertise)
        et de la charge de travail actuelle (tickets actifs).
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'GET, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'),
            ('Content-Type', 'application/json')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)

        try:
            category = kwargs.get('category', '')
            techs = request.env['res.users'].sudo().search([('x_support_role', '=', 'tech')])
            
            data = []
            for tech in techs:
                active_tickets = request.env['support.ticket'].sudo().search_count([
                    ('assigned_to_id', '=', tech.id),
                    ('state', 'in', ['new', 'assigned', 'in_progress', 'escalated'])
                ])
                
                is_expert = False
                if category:
                    is_expert = any(d.name.lower() == category.lower() for d in tech.it_domain_ids)
                
                data.append({
                    'id': tech.id,
                    'name': tech.name,
                    'email': tech.email,
                    'it_domains': tech.it_domain_ids.mapped('name'),
                    'active_tickets': active_tickets,
                    'is_expert': is_expert
                })
            
            data.sort(key=lambda x: (not x['is_expert'], x['active_tickets']))
            
            return request.make_response(json.dumps({'status': 'success', 'data': data}), headers=headers)
        except Exception as e:
            return request.make_response(json.dumps({'status': 'error', 'message': str(e)}), headers=headers, status=500)

    @http.route('/api/ticket/<int:ticket_id>/dispatch', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def dispatch_ticket(self, ticket_id, **kwargs):
        """
        Assignation manuelle d'un ticket par l'admin à un technicien spécifique.
        """
        origin = request.httprequest.headers.get('Origin', 'http://localhost:3000')
        headers = [
            ('Access-Control-Allow-Origin', origin),
            ('Access-Control-Allow-Methods', 'POST, OPTIONS'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization'),
            ('Content-Type', 'application/json')
        ]
        if request.httprequest.method == 'OPTIONS':
            return request.make_response('', headers=headers)

        try:
            body = json.loads(request.httprequest.data.decode('utf-8')) if request.httprequest.data else {}
            target_user_id = body.get('target_user_id')
            caller_user_id = body.get('caller_user_id')
            
            if not target_user_id:
                return request.make_response(json.dumps({'status': 'error', 'message': 'target_user_id requis'}), headers=headers, status=400)
            
            ticket = request.env['support.ticket'].sudo().browse(ticket_id)
            if not ticket.exists():
                return request.make_response(json.dumps({'status': 'error', 'message': 'Ticket introuvable'}), headers=headers, status=404)
            
            target_user = request.env['res.users'].sudo().browse(int(target_user_id))
            
            ticket.write({
                'assigned_to_id': target_user.id,
                'assigned_by_id': int(caller_user_id) if caller_user_id else request.env.user.id,
                'state': 'assigned',
                'x_accepted': False
            })
            
            # Notification
            ticket.message_post(body=f"Ticket assigné à {target_user.name} par l'admin.", message_type='notification')
            
            return request.make_response(
                json.dumps({'status': 'success', 'message': f"Ticket assigné à {target_user.name}"}),
                headers=headers
            )
        except Exception as e:
            return request.make_response(json.dumps({'status': 'error', 'message': str(e)}), headers=headers, status=500)
