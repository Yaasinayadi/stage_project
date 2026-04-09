from odoo import api, fields, models
from datetime import timedelta

class SupportSLA(models.Model):
    _name = 'support.sla'
    _description = 'Règle SLA pour les tickets de support'

    name = fields.Char(string='Nom de la règle', required=True)
    
    priority = fields.Selection([
        ('0', 'Basse'),
        ('1', 'Moyenne'),
        ('2', 'Haute'),
        ('3', 'Critique')
    ], string='Priorité concernée', required=True)
    
    max_hours = fields.Float(string='Délai max de résolution (heures)', required=True, default=24.0)
    
    active = fields.Boolean(default=True)
