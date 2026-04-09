{
    'name': 'IT Support Intelligent',
    'version': '1.0',
    'summary': 'Gestion de tickets IT avec automatisation IA',
    'author': 'Ton Nom - PFE',
    'depends': ['base', 'mail', 'website'], # Ajout de 'website'
    'data': [
        'security/ir.model.access.csv',
        'views/ticket_views.xml',
        'views/website_templates.xml', # Nouveau fichier pour le portail web
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}