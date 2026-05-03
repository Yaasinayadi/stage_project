{
    'name': 'PFE IT Support',
    'version': '1.0',
    'category': 'Services/Project',
    'summary': 'Système de gestion IT Support intelligent Odoo 19',
    'description': """
    Gestion des tickets de support IT.
    Intégration prévue avec un microservice IA (FastAPI).
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
        'views/ticket_views.xml',
        'views/sla_views.xml',
        'views/users_views.xml',
        'views/knowledge_views.xml',
        'views/config_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
    'post_init_hook': 'post_init_hook',   # hooks.py — crée les comptes démo si absents
}
