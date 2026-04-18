from odoo import fields, models


class SupportKnowledgeTag(models.Model):
    _name = 'support.knowledge.tag'
    _description = 'Tag de la Base de Connaissances IT'
    _order = 'name asc'

    name = fields.Char(string='Tag', required=True)
    color = fields.Integer(string='Couleur', default=0)

    # ─── Contrainte d'unicité sur le nom du tag ─────────────────────────────
    _sql_constraints = [
        ('unique_tag_name', 'UNIQUE(name)', 'Un tag avec ce nom existe déjà.')
    ]
