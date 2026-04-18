from odoo import models, fields, api
import re


class SupportKnowledge(models.Model):
    _name = 'support.knowledge'
    _description = 'Base de Connaissances IT'
    _order = 'write_date desc'

    # ─── Champs de base ──────────────────────────────────────────────────────
    name = fields.Char(
        string='Titre de l\'article',
        required=True,
        help='Titre clair et descriptif du problème ou de la procédure.'
    )

    solution = fields.Html(
        string='Contenu / Solution',
        required=True,
        sanitize=True,
        sanitize_tags=True,
        strip_classes=True,
        help='Contenu riche de l\'article : étapes, captures d\'écran, listes à puces.'
    )

    # ─── Catégorie : liée aux domaines IT du projet ──────────────────────────
    category = fields.Selection([
        ('Réseau',          'Réseau'),
        ('Logiciel',        'Logiciel'),
        ('Matériel',        'Matériel'),
        ('Accès',           'Accès'),
        ('Messagerie',      'Messagerie'),
        ('Infrastructure',  'Infrastructure'),
        ('Autre',           'Autre'),
    ], string='Catégorie IT', index=True,
       help='Domaine IT de l\'article (aligné sur les domaines d\'expertise des techniciens).')

    # ─── Tags Many2many → modèle support.knowledge.tag ───────────────────────
    tag_ids = fields.Many2many(
        'support.knowledge.tag',
        'knowledge_tag_rel',   # table de relation intermédiaire
        'knowledge_id',        # colonne côté article
        'tag_id',              # colonne côté tag
        string='Tags / Mots-clés',
        help='Tags libres pour la recherche et l\'indexation RAG.'
    )

    # ─── Auteur ───────────────────────────────────────────────────────────────
    author_id = fields.Many2one(
        'res.users',
        string='Auteur',
        default=lambda self: self.env.user,
        ondelete='set null',
        help='Technicien ou administrateur ayant rédigé l\'article.'
    )

    # ─── Statut de publication ────────────────────────────────────────────────
    is_published = fields.Boolean(
        string='Publié',
        default=False,
        help='Si coché, l\'article est visible par tous les utilisateurs. Sinon, il reste en brouillon.'
    )

    # ─── Lien vers le ticket source ──────────────────────────────────────────
    ticket_id = fields.Many2one(
        'support.ticket',
        string='Ticket Source',
        ondelete='set null',
        help='Ticket IT dont est issu cet article. Permet de remonter à la source de la solution.'
    )

    # ─── Champ calculé : extrait texte pour les cartes Frontend et le RAG ────
    solution_preview = fields.Char(
        string='Extrait (texte brut)',
        compute='_compute_solution_preview',
        store=True,
        help='200 premiers caractères du contenu en texte brut, utilisé pour l\'aperçu des cartes.'
    )

    @api.depends('solution')
    def _compute_solution_preview(self):
        """Convertit le HTML en texte brut et tronque à 200 caractères."""
        for rec in self:
            if rec.solution:
                # Supprimer les balises HTML par regex (simple et sans dépendance externe)
                text = re.sub(r'<[^>]+>', ' ', rec.solution or '')
                # Nettoyer les espaces multiples
                text = re.sub(r'\s+', ' ', text).strip()
                rec.solution_preview = text[:200] + ('…' if len(text) > 200 else '')
            else:
                rec.solution_preview = ''
