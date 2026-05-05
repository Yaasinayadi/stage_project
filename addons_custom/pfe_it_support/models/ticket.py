from odoo import api, fields, models
from odoo.exceptions import UserError
from datetime import timedelta

class SupportTicket(models.Model):
    _name = 'support.ticket'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = 'Ticket de Support IT'
    _order = 'create_date desc'

    name = fields.Char(string='Sujet', required=True)
    description = fields.Text(string='Description', required=True)
    
    state = fields.Selection([
        ('new',              'Nouveau'),
        ('assigned',         'Assigné'),
        ('in_progress',      'En Cours'),
        ('waiting',          'Attente Client'),
        ('waiting_material', 'En attente matériel'),
        ('blocked',          'Bloqué'),
        ('escalated',        'Escaladé'),
        ('resolved',         'Résolu'),
        ('closed',           'Fermé')
    ], string='Statut', default='new', tracking=True)
    
    priority = fields.Selection([
        ('0', 'Basse'),
        ('1', 'Moyenne'),
        ('2', 'Haute'),
        ('3', 'Critique')
    ], string='Priorité', default='1', tracking=True)

    # Lien avec l'utilisateur qui a créé le ticket
    user_id = fields.Many2one('res.users', string='Demandeur', default=lambda self: self.env.user)
    
    # Agent IT assigné au ticket (seulement les utilisateurs internes)
    assigned_to_id = fields.Many2one('res.users', string='Agent Assigné', domain=[('share', '=', False)], tracking=True)
    
    # Technicien qui a déclenché l'escalade
    escalated_by_id = fields.Many2one('res.users', string='Escaladé par')

    # Administrateur ou système ayant assigné le ticket
    assigned_by_id = fields.Many2one('res.users', string='Assigné par', tracking=True)

    # ─── Matériel IT utilisé ─────────────────────────────────────────────────
    material_line_ids = fields.One2many(
        'support.ticket.material.line',
        'ticket_id',
        string='Matériel requis',
        help='Composants physiques ou logiciels requis pour cette intervention',
    )

    total_material_cost = fields.Float(
        string='Coût total matériel (DH)',
        compute='_compute_total_material_cost',
        store=True,
        digits=(10, 2),
        help='Somme des coûts unitaires de tous les matériels liés au ticket',
    )
    # ─── SLA ─────────────────────────────────────────────────────────────────
    sla_id = fields.Many2one('support.sla', string='Règle SLA', compute='_compute_sla', store=True)
    sla_deadline = fields.Datetime(string='Date Limite SLA', compute='_compute_sla_deadline', store=True)
    sla_status = fields.Selection([
        ('on_track', 'Dans les temps'),
        ('at_risk',  'À risque'),
        ('breached', 'Dépassé'),
    ], string='Statut SLA', compute='_compute_sla_status')

    # ─── Pause SLA (waiting_material) ────────────────────────────────────────
    x_last_pause_date = fields.Datetime(
        string='Début de pause SLA',
        help='Horodatage du dernier passage en "En attente matériel" — utilisé pour calculer la durée de pause',
    )
    x_total_paused_duration = fields.Float(
        string='Total pausé (heures)',
        default=0.0,
        help='Cumul des durées de pause "En attente matériel" en heures — ajouté à la deadline SLA',
    )

    date_done = fields.Datetime(string='Date de Résolution')
    
    # Le microservice IA remplira ces champs via l'API
    ai_classification = fields.Many2one('pfe.it.domain', string='Catégorie (par IA)')
    ai_confidence = fields.Float(string='Confiance IA (%)')
    ai_suggested_solution = fields.Text(string='Solution Suggérée (IA)')

    active = fields.Boolean(default=True)
    
    # Résolution apportée par le technicien
    resolution = fields.Text(string='Résolution Appliquée')

    # Acceptation explicite par le technicien
    x_accepted = fields.Boolean(string='Accepté par le technicien', default=False)

    # Pièces jointes (logs, images, captures d'écran)
    attachment_ids = fields.Many2many(
        'ir.attachment',
        'support_ticket_attachment_rel',
        'ticket_id',
        'attachment_id',
        string='Pièces jointes'
    )
    
    # Compteur de documents pour le Smart Button
    attachment_number = fields.Integer(compute='_compute_attachment_number', string='Nombre de documents')

    @api.depends('attachment_ids')
    def _compute_attachment_number(self):
        for ticket in self:
            ticket.attachment_number = len(ticket.attachment_ids)

    def action_get_attachment_view(self):
        self.ensure_one()
        return {
            'name': 'Documents',
            'domain': [('res_model', '=', 'support.ticket'), ('res_id', '=', self.id)],
            'res_model': 'ir.attachment',
            'type': 'ir.actions.act_window',
            'view_mode': 'kanban,list,form',
            'context': "{'default_res_model': 'support.ticket', 'default_res_id': %s}" % (self.id),
        }
    
    # Commentaires / Discussion
    comment_ids = fields.One2many('support.ticket.comment', 'ticket_id', string='Commentaires')

    # ─── Computes SLA ─────────────────────────────────────────────────────────

    @api.depends('material_line_ids', 'material_line_ids.material_id', 'material_line_ids.material_id.unit_cost')
    def _compute_total_material_cost(self):
        for ticket in self:
            ticket.total_material_cost = sum(
                line.material_id.unit_cost
                for line in ticket.material_line_ids
                if line.material_id
            )

    @api.depends('priority')
    def _compute_sla(self):
        for ticket in self:
            sla = self.env['support.sla'].search([('priority', '=', ticket.priority)], limit=1)
            ticket.sla_id = sla.id if sla else False

    @api.depends('create_date', 'priority', 'x_total_paused_duration')
    def _compute_sla_deadline(self):
        sla_hours = {
            '0': 48,  # Basse
            '1': 24,  # Moyenne
            '2': 8,   # Haute
            '3': 2    # Critique
        }
        for ticket in self:
            if ticket.create_date and ticket.priority:
                hours = sla_hours.get(ticket.priority, 24)
                # Ajouter le cumul de pause pour ne pas pénaliser le technicien
                total_hours = hours + (ticket.x_total_paused_duration or 0.0)
                ticket.sla_deadline = ticket.create_date + timedelta(hours=total_hours)
            else:
                ticket.sla_deadline = False

    @api.depends('sla_deadline', 'state', 'date_done', 'x_last_pause_date')
    def _compute_sla_status(self):
        now = fields.Datetime.now()
        for ticket in self:
            if not ticket.sla_deadline:
                ticket.sla_status = False
                continue
                
            # Calcul de la date d'évaluation selon le statut
            if ticket.state in ('resolved', 'closed'):
                target_date = ticket.date_done or now
            elif ticket.state in ('waiting', 'waiting_material'):
                # En pause (attente client OU matériel), on évalue la situation
                # telle qu'elle était au moment de la mise en pause
                target_date = ticket.x_last_pause_date or now
            else:
                target_date = now

            if target_date > ticket.sla_deadline:
                ticket.sla_status = 'breached'
            elif ticket.state not in ('resolved', 'closed') and target_date > (ticket.sla_deadline - timedelta(hours=1)):
                ticket.sla_status = 'at_risk'
            else:
                ticket.sla_status = 'on_track'

    # ─── Actions des boutons de l'interface Odoo ──────────────────────────────
    def action_pause_ticket(self):
        for ticket in self:
            ticket.write({'state': 'waiting_material'})

    def action_resume_ticket(self):
        for ticket in self:
            ticket.write({'state': 'in_progress'})

    # ─── Write override : logique de pause/reprise SLA ────────────────────────

    @api.model
    def write(self, vals):
        # Avant la mise à jour, capturer l'ancien state pour chaque ticket
        old_states = {t.id: t.state for t in self}

        # Marquer date_done quand le ticket est résolu/fermé, ou le vider si réouvert
        if 'state' in vals:
            if vals['state'] in ('resolved', 'closed'):
                vals['date_done'] = fields.Datetime.now()
            else:
                vals['date_done'] = False

        result = super(SupportTicket, self).write(vals)

        # --- Décrémentation du stock à la résolution ---
        if 'state' in vals and vals['state'] in ('resolved', 'closed'):
            for ticket in self:
                # On ne décrémente que les tickets qui viennent d'être résolus
                # (l'ancien état n'était pas déjà resolved/closed)
                old_state = old_states.get(ticket.id)
                if old_state not in ('resolved', 'closed'):
                    for line in ticket.material_line_ids:
                        mat = line.material_id
                        if mat and mat.qty_available > 0:
                            mat.sudo().write({'qty_available': mat.qty_available - 1})

        # Après la mise à jour, appliquer la logique de pause SLA
        if 'state' in vals:
            now = fields.Datetime.now()
            new_state = vals['state']
            # Les deux états qui déclenchent une pause SLA
            PAUSED_STATES = ('waiting', 'waiting_material')

            for ticket in self:
                old_state = old_states.get(ticket.id)

                # ── CAS 1 : On entre dans un état pausé ───────────────────────
                if new_state in PAUSED_STATES and old_state not in PAUSED_STATES:
                    ticket.sudo().write({'x_last_pause_date': now})

                # ── CAS 2 : On sort d'un état pausé ──────────────────────────
                elif old_state in PAUSED_STATES and new_state not in PAUSED_STATES:
                    if ticket.x_last_pause_date:
                        # Calculer la durée de pause en heures
                        delta = now - ticket.x_last_pause_date
                        paused_hours = delta.total_seconds() / 3600.0
                        new_total = (ticket.x_total_paused_duration or 0.0) + paused_hours

                        # Décaler la deadline SLA du même montant (non pénalisant)
                        ticket.sudo().write({
                            'x_total_paused_duration': new_total,
                            'x_last_pause_date': False,
                        })

                        # Recomputer la deadline avec le nouveau total pausé
                        ticket._compute_sla_deadline()

                        # Log dans le chatter
                        hours_int = int(paused_hours)
                        minutes_int = int((paused_hours - hours_int) * 60)
                        pause_type = "Attente client" if old_state == 'waiting' else "Attente matériel"
                        ticket.message_post(
                            body=(
                                f"⏱️ <b>Pause SLA terminée ({pause_type})</b> — Durée : "
                                f"{hours_int}h{minutes_int:02d}min. "
                                f"La deadline SLA a été décalée d'autant."
                            ),
                            message_type='notification',
                        )

                # ── CAS 3 : Transition entre deux états pausés ────────────────
                # (ex: waiting → waiting_material) : clôturer la pause précédente
                elif old_state in PAUSED_STATES and new_state in PAUSED_STATES and old_state != new_state:
                    if ticket.x_last_pause_date:
                        delta = now - ticket.x_last_pause_date
                        paused_hours = delta.total_seconds() / 3600.0
                        new_total = (ticket.x_total_paused_duration or 0.0) + paused_hours
                        ticket.sudo().write({
                            'x_total_paused_duration': new_total,
                            'x_last_pause_date': now,  # repartir depuis maintenant
                        })
                        ticket._compute_sla_deadline()

        return result

class SupportTicketMaterialLine(models.Model):
    _name = 'support.ticket.material.line'
    _description = 'Ligne de Matériel Requis pour un Ticket'

    ticket_id = fields.Many2one('support.ticket', string='Ticket', ondelete='cascade', required=True)
    material_id = fields.Many2one('pfe.it.material', string='Matériel', ondelete='cascade', required=True)
    
    material_category = fields.Selection(related='material_id.category', string='Catégorie', readonly=True)
    material_reference = fields.Char(related='material_id.reference', string='Référence', readonly=True)

    status = fields.Selection([
        ('requested', 'Demandé'),
        ('ready', 'Disponible/Prêt'),
        ('ordered', 'Commandé')
    ], string='État', default='requested', required=True)

    _sql_constraints = [
        ('ticket_material_uniq', 'unique (ticket_id, material_id)', "Un matériel ne peut être demandé qu'une seule fois par ticket.")
    ]

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record in records:
            if record.status == 'ready' and record.material_id:
                if record.material_id.qty_available <= 0:
                    raise UserError(f"Stock insuffisant pour cette ressource : {record.material_id.name}")
                record.material_id.qty_available -= 1
        return records

    def write(self, vals):
        # We need to manually check transitions for each record since it's a batch write potentially
        for record in self:
            if 'status' in vals:
                new_status = vals['status']
                old_status = record.status
                if old_status in ('requested', 'ordered') and new_status == 'ready':
                    # Décrémentation
                    if record.material_id.qty_available <= 0:
                        raise UserError(f"Stock insuffisant pour cette ressource : {record.material_id.name}")
                    record.material_id.qty_available -= 1
                elif old_status == 'ready' and new_status in ('requested', 'ordered'):
                    # Incrémentation (annulation)
                    record.material_id.qty_available += 1
        return super().write(vals)

    def unlink(self):
        for record in self:
            # Si on supprime une ligne qui était validée, on rend le stock
            if record.status == 'ready' and record.material_id:
                record.material_id.qty_available += 1
        return super().unlink()
