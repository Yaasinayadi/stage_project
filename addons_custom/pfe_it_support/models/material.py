from odoo import fields, models


class ItMaterial(models.Model):
    _name = 'pfe.it.material'
    _description = 'Catalogue de matériel IT'
    _order = 'category, name'

    name = fields.Char(
        string='Désignation',
        required=True,
        help='Ex: RAM 8GB DDR4, Clavier AZERTY, Câble RJ45...'
    )

    category = fields.Selection([
        ('hardware', 'Matériel'),
        ('software', 'Logiciel'),
        ('cable',    'Câblage'),
        ('other',    'Autre'),
    ], string='Catégorie', default='hardware', required=True)

    reference = fields.Char(
        string='Référence interne',
        help='Code interne ou SKU du composant (optionnel)'
    )

    qty_available = fields.Integer(
        string='Quantité en stock',
        default=0,
        help='Nombre d\'unités physiquement disponibles en stock'
    )

    unit_cost = fields.Float(
        string='Coût unitaire (DH)',
        digits=(10, 2),
        default=0.0,
        help='Prix d\'achat unitaire hors taxe'
    )

    active = fields.Boolean(
        string='Actif',
        default=True,
        help='Décocher pour archiver cet article sans le supprimer'
    )

    # Relation inverse : tickets qui utilisent ce matériel
    ticket_ids = fields.Many2many(
        'support.ticket',
        'support_ticket_material_rel',
        'material_id',
        'ticket_id',
        string='Tickets concernés',
        readonly=True,
    )

    ticket_count = fields.Integer(
        string='Nb tickets',
        compute='_compute_ticket_count',
    )

    def _compute_ticket_count(self):
        for mat in self:
            mat.ticket_count = len(mat.ticket_ids)
