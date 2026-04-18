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

    @http.route('/api/ticket/<int:ticket_id>/assign', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
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

    @http.route('/api/ticket/<int:ticket_id>/transfer', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
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

    @http.route('/api/ticket/<int:ticket_id>/ai-suggest', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
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

    @http.route('/api/ticket/<int:ticket_id>/resolve', type='http', auth='public', methods=['PATCH', 'OPTIONS'], csrf=False)
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

    # ═══════════════════════════════════════════════════════════════════════
    # HELPERS & CORS
    # ═══════════════════════════════════════════════════════════════════════

    def _cors_response(self, data=None, status=200):
        """Garantit que TOUTES les réponses (même les erreurs 500) ont les bons headers CORS."""
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', 'http://localhost:3000'),
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
        return {
            'id':                  kb.id,
            'title':               kb.name,
            'solution':            kb.solution if full else None,
            'solution_preview':    kb.solution_preview or '',
            'category':            kb.category,
            'tags':                [{'id': t.id, 'name': t.name} for t in kb.tag_ids],
            'author':              kb.author_id.name if kb.author_id else None,
            'author_id':           kb.author_id.id  if kb.author_id else None,
            'is_published':        kb.is_published,
            'source_ticket_id':    kb.ticket_id.id   if kb.ticket_id else None,
            'source_ticket_name':  kb.ticket_id.name if kb.ticket_id else None,
            'create_date':         str(kb.create_date)  if kb.create_date else None,
            'write_date':          str(kb.write_date)   if kb.write_date else None,
        }

    # ─── GET /api/knowledge  (liste paginée) ────────────────────────────────
    @http.route('/api/knowledge', type='http', auth='public', methods=['GET', 'OPTIONS'], csrf=False)
    def get_knowledge_list(self, **kw):
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            env = request.env['support.knowledge'].sudo()

            # ── Filtres ──────────────────────────────────────────────────
            domain = []
            category      = kw.get('category')
            search        = kw.get('search')
            published_only = kw.get('published_only')

            if category:
                domain.append(('category', '=', category))
            if search:
                domain += ['|', ('name', 'ilike', search),
                                 ('solution_preview', 'ilike', search)]
            if published_only in ('1', 'true', 'True'):
                domain.append(('is_published', '=', True))

            # ── Pagination ───────────────────────────────────────────────
            try:
                page  = max(1, int(kw.get('page',  1)))
                limit = max(1, int(kw.get('limit', 12)))
            except (ValueError, TypeError):
                page, limit = 1, 12

            total  = env.search_count(domain)
            pages  = max(1, -(-total // limit))  # ceil division
            offset = (page - 1) * limit

            articles = env.search(domain, order='write_date desc', limit=limit, offset=offset)
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
            return self._cors_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, status=500)

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

    # ─── POST /api/knowledge/create ──────────────────────────────────────────
    @http.route('/api/knowledge/create', type='http', auth='public', methods=['POST', 'OPTIONS'], csrf=False)
    def create_knowledge(self, **kw):
        """Crée un nouvel article KB. Accessible aux Tech et Admin."""
        if request.httprequest.method == 'OPTIONS':
            return self._cors_response()
        try:
            if request.httprequest.data:
                _logger.info("Données reçues sur create_knowledge : %s", request.httprequest.data)

            post = json.loads(request.httprequest.data.decode('utf-8'))

            title        = post.get('title', '').strip()
            solution     = post.get('solution', '').strip()
            category     = post.get('category')
            tag_names    = post.get('tag_names', [])   # liste de chaînes (ex: ['VPN', 'Windows'])
            is_published = bool(post.get('is_published', False))
            author_id    = post.get('author_id')
            ticket_id    = post.get('source_ticket_id')

            if not title or not solution:
                return self._cors_response({'status': 400, 'message': 'Le titre et la solution sont requis.'}, status=400)

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
                    if not name: continue
                    tag = TagModel.search([('name', '=ilike', name)], limit=1)
                    if not tag:
                        tag = TagModel.create({'name': name})
                    tag_ids.append(tag.id)
                vals['tag_ids'] = [(6, 0, tag_ids)]

            new_kb = request.env['support.knowledge'].sudo().create(vals)

            return self._cors_response({
                'status': 201, 
                'message': 'Article créé.', 
                'data': self._kb_article_to_dict(new_kb)
            }, status=201)
        except Exception as e:
            import traceback
            _logger.error("Erreur create_knowledge : %s\n%s", e, traceback.format_exc())
            return self._cors_response({'status': 500, 'message': str(e), 'trace': traceback.format_exc()}, status=500)

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
