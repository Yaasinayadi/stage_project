import xmlrpc.client

url = 'http://localhost:8069'
db = 'pfe_db'
username = 'odoo'
password = 'odoo'

common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(url))
uid = common.authenticate(db, username, password, {})

models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(url))

# 1. Create a new ticket
ticket_id = models.execute_kw(db, uid, password, 'support.ticket', 'create', [{
    'name': 'Test Pause Accumulation',
    'description': 'Testing SLA logic',
    'priority': '2',
}])
print(f"Created ticket: {ticket_id}")

# 2. Pause
models.execute_kw(db, uid, password, 'support.ticket', 'write', [[ticket_id], {'state': 'waiting_material'}])
import time
print("Paused for 3 seconds...")
time.sleep(3)

# 3. Resume
models.execute_kw(db, uid, password, 'support.ticket', 'write', [[ticket_id], {'state': 'in_progress'}])
t = models.execute_kw(db, uid, password, 'support.ticket', 'read', [[ticket_id]], {'fields': ['x_total_paused_duration']})
print(f"Total paused after 1st pause: {t[0]['x_total_paused_duration']}")

# 4. Pause Again
models.execute_kw(db, uid, password, 'support.ticket', 'write', [[ticket_id], {'state': 'waiting_material'}])
print("Paused for 3 seconds...")
time.sleep(3)

# 5. Resume Again
models.execute_kw(db, uid, password, 'support.ticket', 'write', [[ticket_id], {'state': 'in_progress'}])
t = models.execute_kw(db, uid, password, 'support.ticket', 'read', [[ticket_id]], {'fields': ['x_total_paused_duration']})
print(f"Total paused after 2nd pause: {t[0]['x_total_paused_duration']}")

