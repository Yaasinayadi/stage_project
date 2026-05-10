from odoo import models, fields  # type: ignore

class ChatHistory(models.Model):
    _name = 'pfe.chat.history'
    _description = 'Historique des conversations du Chatbot'
    _order = 'write_date desc'

    user_id = fields.Many2one('res.users', string='Utilisateur', required=True, ondelete='cascade')
    session_id = fields.Char(string='ID Session', required=True, index=True)
    name = fields.Char(string='Titre de la discussion', default='Nouvelle discussion')
    is_pinned = fields.Boolean(string='Épinglé', default=False)
    message_ids = fields.One2many('pfe.chat.message', 'history_id', string='Dialogue')


class ChatHistoryMessage(models.Model):
    _name = 'pfe.chat.message'
    _description = 'Message du Chatbot'
    _order = 'timestamp asc, id asc'

    history_id = fields.Many2one('pfe.chat.history', string='Historique', required=True, ondelete='cascade')
    role = fields.Selection([
        ('user', 'Utilisateur'),
        ('assistant', 'Assistant'),
    ], string='Rôle', required=True)
    content = fields.Text(string='Contenu', required=True)
    ticket_id = fields.Char(string='ID Ticket Associé (UI)')
    timestamp = fields.Datetime(string='Date et heure', default=fields.Datetime.now)
