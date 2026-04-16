from odoo import models, fields

class SupportKnowledge(models.Model):
    _name = 'support.knowledge'
    _description = 'Base de Connaissances IT / FAQ'

    name = fields.Char(string='Titre / Problème', required=True)
    solution = fields.Text(string='Résolution Apportée', required=True)
    category = fields.Char(string='Catégorie (IA)')
    
    # Lien optionnel vers le ticket d'origine
    ticket_id = fields.Many2one('support.ticket', string='Ticket Source', ondelete='set null')
