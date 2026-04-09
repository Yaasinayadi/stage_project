{
    'name': 'PFE IT Support',
    'version': '1.0',
    'category': 'Services/Project',
    'summary': 'Système de gestion IT Support intelligent Odoo 19',
    'description': """
    Gestion des tickets de support IT.
    Intégration prévue avec un microservice IA (FastAPI).
    """,
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/ticket_views.xml',
        'views/sla_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
