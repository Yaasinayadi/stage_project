from odoo import models, fields


class ItDomain(models.Model):
    _name = 'pfe.it.domain'
    _description = 'Domaine IT'
    _order = 'name'

    name = fields.Char('Domaine', required=True, translate=False)
    color = fields.Integer('Couleur', default=0)

    _sql_constraints = [
        ('name_unique', 'UNIQUE(name)', 'Ce domaine existe déjà.')
    ]
