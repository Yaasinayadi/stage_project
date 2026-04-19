import xmlrpc.client
info = xmlrpc.client.ServerProxy('http://localhost:8069/xmlrpc/2/common').version()
print(info)
