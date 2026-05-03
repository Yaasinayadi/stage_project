from odoo import api, fields, models
from datetime import timedelta

class SupportTicket(models.Model):
    _name = 'support.ticket'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = 'Ticket de Support IT'
    _order = 'create_date desc'

    name = fields.Char(string='Sujet', required=True)
    description = fields.Text(string='Description', required=True)
    
    state = fields.Selection([
        ('new', 'Nouveau'),
        ('assigned', 'Assigné'),
        ('in_progress', 'En Cours'),
        ('waiting', 'Attente Client'),
        ('blocked', 'Bloqué'),
        ('escalated', 'Escaladé'),
        ('resolved', 'Résolu'),
        ('closed', 'Fermé')
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
    
    # SLA
    sla_id = fields.Many2one('support.sla', string='Règle SLA', compute='_compute_sla', store=True)
    sla_deadline = fields.Datetime(string='Date Limite SLA', compute='_compute_sla_deadline', store=True)
    sla_status = fields.Selection([
        ('on_track', 'Dans les temps'),
        ('at_risk', 'À risque'),
        ('breached', 'Dépassé'),
    ], string='Statut SLA', compute='_compute_sla_status', store=True)
    
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

    @api.depends('priority')
    def _compute_sla(self):
        for ticket in self:
            sla = self.env['support.sla'].search([('priority', '=', ticket.priority)], limit=1)
            ticket.sla_id = sla.id if sla else False

    @api.depends('create_date', 'priority')
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
                ticket.sla_deadline = ticket.create_date + timedelta(hours=hours)
            else:
                ticket.sla_deadline = False

    @api.depends('sla_deadline', 'state', 'date_done')
    def _compute_sla_status(self):
        now = fields.Datetime.now()
        for ticket in self:
            target_date = ticket.date_done or now
            if not ticket.sla_deadline:
                ticket.sla_status = False
            elif target_date > ticket.sla_deadline:
                ticket.sla_status = 'breached'
            elif ticket.state not in ('resolved', 'closed') and target_date > ticket.sla_deadline - timedelta(hours=1):
                ticket.sla_status = 'at_risk'
            else:
                ticket.sla_status = 'on_track'

    @api.model
    def write(self, vals):
        if 'state' in vals and vals['state'] in ('resolved', 'closed'):
            vals['date_done'] = fields.Datetime.now()
        return super(SupportTicket, self).write(vals)
