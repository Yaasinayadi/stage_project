from odoo import models, fields

class ResUsers(models.Model):
    _inherit = 'res.users'

    x_support_role = fields.Selection([
        ('user', 'User'),
        ('tech', 'Technician'),
        ('admin', 'Administrator'),
    ], string='IT Support Role', default='user')
