from odoo import api, fields, models
from datetime import timedelta

class SupportTicket(models.Model):
    _name = 'support.ticket'
    _description = 'Ticket de Support IT'
    _order = 'create_date desc'

    name = fields.Char(string='Sujet', required=True)
    description = fields.Text(string='Description', required=True)
    
    state = fields.Selection([
        ('new', 'Nouveau'),
        ('in_progress', 'En Cours'),
        ('waiting', 'Attente Client'),
        ('resolved', 'Résolu'),
        ('closed', 'Fermé')
    ], string='Statut', default='new')
    
    priority = fields.Selection([
        ('0', 'Basse'),
        ('1', 'Moyenne'),
        ('2', 'Haute'),
        ('3', 'Critique')
    ], string='Priorité', default='1')

    # Lien avec l'utilisateur qui a créé le ticket
    user_id = fields.Many2one('res.users', string='Demandeur', default=lambda self: self.env.user)
    
    # Agent IT assigné au ticket
    assigned_to = fields.Many2one('res.users', string='Agent Assigné')
    
    # SLA
    sla_id = fields.Many2one('support.sla', string='Règle SLA', compute='_compute_sla', store=True)
    sla_deadline = fields.Datetime(string='Date Limite SLA', compute='_compute_sla_deadline', store=True)
    sla_status = fields.Selection([
        ('on_track', 'Dans les temps'),
        ('at_risk', 'À risque'),
        ('breached', 'Dépassé'),
    ], string='Statut SLA', compute='_compute_sla_status', store=True)
    
    # Le microservice IA remplira ces champs via l'API
    ai_classification = fields.Char(string='Catégorie (par IA)')
    ai_confidence = fields.Float(string='Confiance IA (%)')
    ai_suggested_solution = fields.Text(string='Solution Suggérée (IA)')

    active = fields.Boolean(default=True)

    # Pièces jointes (logs, images, captures d'écran)
    attachment_ids = fields.Many2many(
        'ir.attachment',
        'support_ticket_attachment_rel',
        'ticket_id',
        'attachment_id',
        string='Pièces jointes'
    )

    @api.depends('priority')
    def _compute_sla(self):
        for ticket in self:
            sla = self.env['support.sla'].search([('priority', '=', ticket.priority)], limit=1)
            ticket.sla_id = sla.id if sla else False

    @api.depends('create_date', 'sla_id', 'sla_id.max_hours')
    def _compute_sla_deadline(self):
        for ticket in self:
            if ticket.create_date and ticket.sla_id:
                ticket.sla_deadline = ticket.create_date + timedelta(hours=ticket.sla_id.max_hours)
            else:
                ticket.sla_deadline = False

    @api.depends('sla_deadline', 'state')
    def _compute_sla_status(self):
        now = fields.Datetime.now()
        for ticket in self:
            if ticket.state in ('resolved', 'closed'):
                ticket.sla_status = 'on_track'
            elif not ticket.sla_deadline:
                ticket.sla_status = False
            elif now > ticket.sla_deadline:
                ticket.sla_status = 'breached'
            elif now > ticket.sla_deadline - timedelta(hours=1):
                ticket.sla_status = 'at_risk'
            else:
                ticket.sla_status = 'on_track'
