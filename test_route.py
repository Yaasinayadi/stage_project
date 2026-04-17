from odoo import http

class TestController(http.Controller):
    @http.route('/api/test', type='http', auth='none', methods=['OPTIONS'], cors='*', csrf=False)
    def test_options(self, **kw):
        return http.request.make_response('', headers=[('Access-Control-Allow-Origin', '*')])
