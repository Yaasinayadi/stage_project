"""
hooks.py — Odoo lifecycle hooks for pfe_it_support.

post_init_hook : Called once after the module is first installed.
                 Creates the 3 demo accounts (user / tech / admin) only if
                 a user with that login does NOT already exist.
                 Completely idempotent → safe to run on every upgrade too.
"""

import logging

_logger = logging.getLogger(__name__)

# ─── Demo accounts ────────────────────────────────────────────────────────────
_DEMO_USERS = [
    {
        'login':    'user@gmail.com',
        'name':     'Demo User',
        'role_ref': None,                            # base.group_user only → x_support_role = 'user'
    },
    {
        'login':    'tech@gmail.com',
        'name':     'Demo Technician',
        'role_ref': 'pfe_it_support.group_support_technician',  # → x_support_role = 'tech'
    },
    {
        'login':    'admin@gmail.com',
        'name':     'Demo Admin',
        'role_ref': 'base.group_system',             # → x_support_role = 'admin'
    },
]

_DEFAULT_PASSWORD = '12345678'


def post_init_hook(env):
    """
    Creates demo accounts after module installation.

    Strategy:
    - Search by `login` before attempting to create.
    - If the user already exists (whatever their current state), skip silently.
    - Passwords are set via `_set_password()` which handles hashing correctly.
    - group_ids uses (4, id) commands to ADD groups without wiping existing ones.
    """
    ResUsers = env['res.users'].sudo()

    group_user = env.ref('base.group_user', raise_if_not_found=False)
    if not group_user:
        _logger.warning('pfe_it_support: base.group_user not found — skipping demo user creation.')
        return

    for spec in _DEMO_USERS:
        login = spec['login']

        # ── Skip if already exists (idempotency) ──────────────────────────────
        existing = ResUsers.search([('login', '=', login)], limit=1)
        if existing:
            _logger.info('pfe_it_support: user %s already exists — skipping.', login)
            continue

        # ── Resolve optional extra group ──────────────────────────────────────
        extra_group = None
        if spec['role_ref']:
            extra_group = env.ref(spec['role_ref'], raise_if_not_found=False)
            if not extra_group:
                _logger.warning(
                    'pfe_it_support: ref %s not found — user %s will be created with base role only.',
                    spec['role_ref'], login
                )

        # ── Build group_ids command list ──────────────────────────────────────
        group_cmds = [(4, group_user.id)]
        if extra_group:
            group_cmds.append((4, extra_group.id))

        # ── Create user ───────────────────────────────────────────────────────
        try:
            user = ResUsers.create({
                'name':      spec['name'],
                'login':     login,
                'email':     login,
                'group_ids': group_cmds,
            })
            user._set_password(_DEFAULT_PASSWORD)
            env.cr.commit()     # Commit each user individually so one failure doesn't block the rest
            _logger.info('pfe_it_support: demo user %s created (id=%d).', login, user.id)
        except Exception as exc:
            env.cr.rollback()
            _logger.error('pfe_it_support: failed to create demo user %s: %s', login, exc)
