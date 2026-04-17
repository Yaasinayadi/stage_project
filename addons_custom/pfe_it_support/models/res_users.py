from odoo import models, fields, api

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
    # Extend native Odoo 19 role field to add Technician
    role = fields.Selection(
        selection_add=[('group_technician', 'Technician')],
        ondelete={'group_technician': 'set null'}
    )

    @api.depends('group_ids')
    def _compute_role(self):
        super(ResUsers, self)._compute_role()
        admin_group = self.env.ref('base.group_system', raise_if_not_found=False)
        tech_group = self.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)
        user_group = self.env.ref('base.group_user', raise_if_not_found=False)
        for user in self:
            if admin_group and admin_group in user.group_ids:
                user.role = 'group_system'
            elif tech_group and tech_group in user.group_ids:
                user.role = 'group_technician'
            elif user_group and user_group in user.group_ids:
                user.role = 'group_user'
            else:
                user.role = False

    @api.onchange('role')
    def _onchange_role(self):
        super(ResUsers, self)._onchange_role()
        group_admin = self.env.ref('base.group_system')
        group_tech = self.env.ref('pfe_it_support.group_support_technician')
        group_user = self.env.ref('base.group_user')
        
        for user in self:
            if user.role and group_user in user.group_ids:
                groups = user.group_ids - (group_admin + group_tech + group_user)
                if user.role == 'group_system':
                    user.group_ids = groups + group_admin
                elif user.role == 'group_technician':
                    user.group_ids = groups + group_tech + group_user
                else:
                    user.group_ids = groups + group_user

    x_support_role = fields.Selection([
        ('user', 'User'),
        ('tech', 'Technician'),
        ('admin', 'Administrator'),
    ], string='IT Support Role', compute='_compute_x_support_role', store=True)

    @api.depends('group_ids')
    def _compute_x_support_role(self):
        admin_group = self.env.ref('base.group_system', raise_if_not_found=False)
        tech_group = self.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)
        for user in self:
            if admin_group and admin_group in user.group_ids:
                user.x_support_role = 'admin'
            elif tech_group and tech_group in user.group_ids:
                user.x_support_role = 'tech'
            else:
                user.x_support_role = 'user'
