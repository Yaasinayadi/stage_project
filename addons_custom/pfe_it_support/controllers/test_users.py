import xmlrpc.client
models = xmlrpc.client.ServerProxy('http://localhost:8069/xmlrpc/2/object')
users = models.execute_kw('pfe_db', 1, 'admin', 'res.users', 'search_read', [[]], {'fields': ['id', 'name', 'login']})
import json
print(json.dumps(users, indent=2))
