/**
 * config.ts — Point unique de vérité pour la configuration du projet.
 *
 * Pour changer l'URL d'Odoo, modifier uniquement :
 *   - .env           → ODOO_URL=...          (référence globale projet)
 *   - frontend/.env.local → NEXT_PUBLIC_ODOO_URL=...  (valeur utilisée ici)
 *
 * Ne jamais écrire http://localhost:8069 en dur dans les composants.
 */

/** URL de base du serveur Odoo (ex: http://localhost:8069 ou https://odoo.example.com) */
export const ODOO_URL: string =
  process.env.NEXT_PUBLIC_ODOO_URL ?? "http://localhost:8069";

/** Nom de la base de données Odoo (utile si le serveur gère plusieurs bases) */
export const ODOO_DB: string = process.env.NEXT_PUBLIC_ODOO_DB ?? "";
