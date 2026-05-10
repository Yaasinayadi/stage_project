import xmlrpc.client
import sys

url = "http://localhost:8069"
db = "odoo"
username = "admin"
password = "admin_password"

try:
    common = xmlrpc.client.ServerProxy('{}/xmlrpc/2/common'.format(url))
    uid = common.authenticate(db, username, password, {})
    if not uid:
        print("Auth failed. Please check credentials.")
        sys.exit(1)
        
    models = xmlrpc.client.ServerProxy('{}/xmlrpc/2/object'.format(url))
    
    # Get a random ticket with messages
    tickets = models.execute_kw(db, uid, password, 'support.ticket', 'search', [[]], {'limit': 1})
    if not tickets:
        print("No tickets found")
        sys.exit(0)
        
    ticket_id = tickets[0]
    
    # Get messages
    messages = models.execute_kw(db, uid, password, 'mail.message', 'search_read', 
        [[('res_id', '=', ticket_id), ('model', '=', 'support.ticket')]],
        {'fields': ['body', 'tracking_value_ids', 'date']})
        
    print(f"Ticket {ticket_id} messages:")
    for m in messages:
        print(f"- MSG {m['id']}: date={m['date']} tracking={m['tracking_value_ids']}")
        if m['tracking_value_ids']:
            trackings = models.execute_kw(db, uid, password, 'mail.tracking.value', 'read', 
                [m['tracking_value_ids']],
                {'fields': ['field_id', 'field_desc', 'old_value_char', 'new_value_char', 'old_value_integer', 'new_value_integer', 'old_value_text', 'new_value_text', 'old_value_datetime', 'new_value_datetime']})
            for t in trackings:
                print(f"  * Tracking {t['id']}: field_id={t.get('field_id')} desc={t.get('field_desc')} old={t.get('old_value_char')} new={t.get('new_value_char')}")
                
except Exception as e:
    print(f"Error: {e}")
