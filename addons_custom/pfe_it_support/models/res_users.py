from odoo import models, fields

class ResUsers(models.Model):
    _inherit = 'res.users'

    it_domain = fields.Selection([
        ('Réseau', 'Réseau'),
        ('Logiciel', 'Logiciel'),
        ('Matériel', 'Matériel'),
        ('Accès', 'Accès'),
        ('Messagerie', 'Messagerie'),
        ('Infrastructure', 'Infrastructure'),
        ('Autre', 'Autre')
    ], string="Domaine d'expertise IT")
