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

    # ─── Extend native Odoo 19 role field to add Technician ───────────────────
    # We add 'group_technician' to the native Selection without calling super()
    # in the compute/onchange methods, because super() only knows group_user and
    # group_system and will blindly overwrite our value with 'group_user' when
    # a Technician user (who is also in group_user via implied_ids) is loaded.
    role = fields.Selection(
        selection_add=[('group_technician', 'Technician')],
        ondelete={'group_technician': 'set null'}
    )

    @api.depends('group_ids')
    def _compute_role(self):
        """
        Override completely — do NOT call super().
        The native _compute_role() does not know about group_technician and will
        reset the field to 'group_user' on every recompute (because group_user
        is implied by group_support_technician).  We therefore replicate the
        full priority logic here: admin > technician > user > False.
        """
        admin_group = self.env.ref('base.group_system', raise_if_not_found=False)
        tech_group  = self.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)
        user_group  = self.env.ref('base.group_user', raise_if_not_found=False)

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
        """
        Override completely — do NOT call super().
        We use .new(origin=...) to correctly match NewId records in the onchange context.
        This fixes the 'downgrade' bug where removing a role wouldn't clean up group_ids.
        """
        # Obtenir les records originaux
        ref_admin = self.env.ref('base.group_system', raise_if_not_found=False)
        ref_tech  = self.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)
        ref_user  = self.env.ref('base.group_user', raise_if_not_found=False)

        if not ref_admin or not ref_tech or not ref_user:
            return

        # Créer les instances virtuelles pour la comparaison avec user.group_ids (NewId)
        group_admin = self.env['res.groups'].new(origin=ref_admin)
        group_tech  = self.env['res.groups'].new(origin=ref_tech)
        group_user  = self.env['res.groups'].new(origin=ref_user)

        for user in self:
            if not user.role:
                continue

            # Soustraire TOUS les groupes liés au rôle pour faire un nettoyage complet (unlink)
            groups = user.group_ids - (group_admin + group_tech + group_user)

            # Assigner le nouveau groupe en fonction du rôle
            if user.role == 'group_system':
                user.group_ids = groups + group_admin + group_user
            elif user.role == 'group_technician':
                user.group_ids = groups + group_tech + group_user
            else:
                user.group_ids = groups + group_user

    # ─── Computed IT Support role (used by the Next.js API) ──────────────────
    x_support_role = fields.Selection([
        ('user',  'User'),
        ('tech',  'Technician'),
        ('admin', 'Administrator'),
    ], string='IT Support Role', compute='_compute_x_support_role', store=True)

    @api.depends('group_ids')
    def _compute_x_support_role(self):
        """Maps Odoo groups → the simplified role key consumed by the Next.js frontend."""
        admin_group = self.env.ref('base.group_system', raise_if_not_found=False)
        tech_group  = self.env.ref('pfe_it_support.group_support_technician', raise_if_not_found=False)

        for user in self:
            if admin_group and admin_group in user.group_ids:
                user.x_support_role = 'admin'
            elif tech_group and tech_group in user.group_ids:
                user.x_support_role = 'tech'
            else:
                user.x_support_role = 'user'
