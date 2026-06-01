from odoo import models, fields, api  # type: ignore


class SupportNotification(models.Model):
    _name = 'support.notification'
    _description = 'Notification In-App IT Support'
    _order = 'create_date desc'
    _rec_name = 'message'

    user_id = fields.Many2one(
        'res.users',
        string='Destinataire',
        required=True,
        ondelete='cascade',
        index=True,
    )
    ticket_id = fields.Many2one(
        'support.ticket',
        string='Ticket associé',
        ondelete='cascade',
        index=True,
    )
    notif_type = fields.Selection([
        ('ticket_created',   'Ticket créé'),
        ('ticket_assigned',  'Ticket assigné'),
        ('ticket_resolved',  'Ticket résolu'),
        ('ticket_escalated', 'Ticket escaladé'),
        ('ticket_waiting',   'Ticket en attente'),
        ('new_comment',      'Nouveau commentaire'),
        ('sla_breached',     'SLA dépassé'),
        ('ia_solution',      'Solution IA trouvée'),
    ], string='Type', required=True)

    message = fields.Char(string='Message', required=True)
    is_read = fields.Boolean(string='Lu', default=False, index=True)
    read_at = fields.Datetime(string='Lu le')

    # ── Helper classmethod : créer une notif facilement depuis n'importe où ──
    @api.model
    def _create_notif(self, user_id, notif_type, message, ticket_id=None):
        """
        Raccourci pour créer une notification in-app.
        Exemple : SupportNotification._create_notif(3, 'ticket_created', 'Votre ticket a été créé', ticket_id=12)
        """
        if not user_id:
            return
        vals = {
            'user_id':    user_id,
            'notif_type': notif_type,
            'message':    message,
        }
        if ticket_id:
            vals['ticket_id'] = ticket_id
        return self.sudo().create(vals)
