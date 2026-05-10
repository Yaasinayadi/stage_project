import sys
import xmlrpc.client

url = 'http://localhost:8069'
db = 'pfe_db' # Found this in the docker ps output: "postgres: odoo pfe_db"
username = 'admin' # Assuming admin, or we can use another user if we know
password = 'admin'

# Actually, the easiest way to debug Odoo inside Docker without passwords:
# docker exec odoo_web python3 -c "
# import odoo
# odoo.tools.config.parse_config(['-c', '/etc/odoo/odoo.conf'])
# import odoo.modules.registry
# registry = odoo.modules.registry.Registry(odoo.tools.config['db_name'])
# with registry.cursor() as cr:
#     env = odoo.api.Environment(cr, 1, {})
#     print(env['pfe.chat.history'].search([]).mapped('name'))
# "
