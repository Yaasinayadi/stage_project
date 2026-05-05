from . import it_domain
from . import res_users
from . import material       # pfe.it.material — doit être importé AVANT ticket (Many2many)
from . import ticket
from . import sla
from . import comment
from . import knowledge_tag  # doit être importé AVANT knowledge (relation Many2many)
from . import knowledge
