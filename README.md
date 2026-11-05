# ☾ MOON — Mini-CRM commercial

Application légère pour le suivi des opportunités ESPI Executive.

## Lancer la version GitHub

Télécharger le dépôt avec **Code → Download ZIP**, décompresser puis **ouvrir `index.html`** dans un navigateur moderne. Aucun serveur ni installation n'est nécessaire.

## Fonctionnalités de cette version

- Création, édition et suppression d'opportunités
- Pipeline Kanban avec glisser-déposer
- Historique chronologique des interactions et changements de statut
- Relances prioritaires du jour et en retard
- CA sécurisé, pipeline en cours, montant perdu, panier moyen, conversion
- Affichage HT/TTC selon le taux de TVA de chaque opportunité
- Filtres temporels et recherche
- Sauvegarde/export et restauration **JSON**

## Stockage et limites

Cette version GitHub est une **application statique autonome**. Les données sont stockées dans le **localStorage du navigateur**, sur l'ordinateur utilisé. Elles ne sont pas synchronisées avec GitHub et peuvent être perdues en cas d'effacement des données du navigateur. **Exporter régulièrement une sauvegarde JSON.**

L'application n'a pas d'authentification ni de backend. **Ne pas saisir de données personnelles ESPI réelles avant validation par la DSI**. Le dépôt est privé mais les données ne sont pas protégées par une authentification propre à l'application.

Une version locale plus complète (Python/FastAPI/SQLite, CSV et tests) existe séparément dans l'archive `MOON_CRM_local_GitHub.zip` remise dans la conversation ; **son code n'est pas encore inclus dans ce dépôt**.

## Développement

Ouvrir `index.html` directement ou le servir avec `python3 -m http.server 8765`. Le code est autonome, sans dépendances.
