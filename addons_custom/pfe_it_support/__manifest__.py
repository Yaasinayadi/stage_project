{
    'name': 'PFE IT Support',
    'version': '1.1',
    'category': 'Services/Project',
    'summary': 'Système de gestion IT Support intelligent Odoo 19',
    'description': """
    Gestion des tickets de support IT.
    Intégration avec un microservice IA (Flask + LLaMA-3).
    Traçabilité du matériel IT et pause intelligente du SLA.
    """,
    'author': 'PFE IT Support',
    'website': 'https://example.com',
    'depends': ['base', 'web', 'mail'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/it_domain_data.xml',
        'data/sla_data.xml',
        # user_data.xml supprimé : la création des comptes de démo est gérée
        # par post_init_hook (hooks.py) — idempotent, pas de UniqueViolation
        'data/material_data.xml',    # Catalogue matériel IT — noupdate=1
        'views/ticket_views.xml',
        'views/sla_views.xml',
        'views/users_views.xml',
        'views/knowledge_views.xml',
        'views/material_views.xml',  # Vue catalogue matériel + menu Matériel
        'views/config_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
    'post_init_hook': 'post_init_hook',   # hooks.py — crée les comptes démo si absents
}
