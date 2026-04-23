from odoo import models, fields

class SupportTicketComment(models.Model):
    _name = 'support.ticket.comment'
    _description = 'Commentaire de Ticket IT'
    _order = 'create_date asc'

    ticket_id = fields.Many2one('support.ticket', string='Ticket', required=True, ondelete='cascade')
    author_id = fields.Many2one('res.users', string='Auteur (User)')
    author = fields.Char(string='Nom de l\'auteur', default='Anonyme')
    body = fields.Html(string='Message', required=True)
