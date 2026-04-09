from odoo import models, fields, api

class ITSupportTicket(models.Model):
    _name = 'it.support.ticket'
    _description = 'Ticket de Support IT'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(string='Sujet du ticket', required=True, tracking=True)
    description = fields.Text(string='Description', required=True)
    
    # Les champs pour l'IA (Ils seront remplis par n8n plus tard)
    ai_category = fields.Selection([
        ('hardware', 'Matériel'),
        ('software', 'Logiciel'),
        ('network', 'Réseau'),
        ('access', 'Accès')
    ], string='Catégorie (IA)', readonly=True, tracking=True)
    
    ai_priority = fields.Selection([
        ('low', 'Basse'),
        ('normal', 'Normale'),
        ('high', 'Haute'),
        ('urgent', 'Urgente')
    ], string='Priorité (IA)', readonly=True, tracking=True)

    state = fields.Selection([
        ('new', 'Nouveau'),
        ('qualified', 'Qualifié (IA)'),
        ('in_progress', 'En cours'),
        ('resolved', 'Résolu')
    ], string='Statut', default='new', tracking=True)