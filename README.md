# ☾ MOON — Mini-CRM ESPI Executive

Application web légère dédiée au suivi des contacts, opportunités, tâches, relances et résultats commerciaux.

**Application :** https://nolabernard.github.io/MOON/  
**Code :** https://github.com/nolabernard/MOON

## Version 2 : fonctionnalités

- **Contacts indépendants** : identité, coordonnées, entreprise, profil, notes ; un contact peut posséder plusieurs opportunités.
- **Opportunités** : formation, origine, responsable, statut, dates, montants HT/TTC et TVA propre à la prestation, notes, motif de perte.
- **Kanban** : glisser-déposer dans les six étapes du pipeline ; transitions consignées dans l'historique.
- **Tâches** : ajouter, modifier, supprimer et terminer les tâches ; échéance, priorité, type, contact et opportunité liée.
- **Accueil** : tâches prioritaires, rendez-vous futurs, CA sécurisé, pipeline actif, pertes, panier moyen et conversion.
- **Interactions** : journal chronologique d'appels, emails, SMS, visios, rendez-vous et notes.
- **Recherche** : opportunités, contacts et tâches ; filtres de période pour les résultats commerciaux.
- **Sauvegarde** : export/import JSON complet ; export et import CSV des opportunités.
- **Compatibilité** : migration automatique des opportunités de l'ancienne version `moon.crm.v1` vers les contacts et opportunités de la version `moon.crm.v2`.

## Développement et vérification

Application statique, sans serveur. Les fichiers principaux sont `index.html`, `styles.css` et `app.js`.

Les tests sont dans `tests/smoke.test.cjs`. Exécution locale avec Node :

```bash
node --check app.js
node --test tests/*.test.cjs
```

Le workflow GitHub Actions les exécute avant de publier vers GitHub Pages.

## Données et confidentialité

Les données sont enregistrées dans le **localStorage du navigateur**, uniquement sur l'appareil et dans le navigateur utilisés. GitHub ne stocke pas les fiches de contacts saisies dans l'application. Les données ne se synchronisent **pas** entre appareils et peuvent disparaître à l'effacement des données du navigateur. Exportez régulièrement une sauvegarde JSON.

**Cette version n'est pas sécurisée pour la production** : pas d'authentification ni de base serveur ; GitHub Pages diffuse l'interface publiquement. N'utilisez que des données fictives tant qu'une solution sécurisée et autorisée par la DSI ESPI n'a pas été mise en place.

Le site de démonstration ne remplace pas une application métier hébergée avec comptes utilisateurs, sauvegardes serveur et règles de confidentialité.
