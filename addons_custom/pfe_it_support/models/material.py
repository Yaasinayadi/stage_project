from odoo import fields, models  # type: ignore


class ItMaterialCategory(models.Model):
    _name = 'pfe.it.material.category'
    _description = 'Catégorie de matériel IT'
    _order = 'name'

    name = fields.Char(string='Nom de la catégorie', required=True)
    active = fields.Boolean(default=True, string='Actif')


class ItMaterial(models.Model):
    _name = 'pfe.it.material'
    _description = 'Catalogue de matériel IT'
    _order = 'category_id, name'

    name = fields.Char(
        string='Désignation',
        required=True,
        help='Ex: RAM 8GB DDR4, Clavier AZERTY, Câble RJ45...'
    )

    category_id = fields.Many2one(
        'pfe.it.material.category',
        string='Catégorie',
        required=True,
        ondelete='restrict'
    )

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
