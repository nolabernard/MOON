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

## Dictée vocale (expérimentale)

Depuis MOON, cliquer sur **🎙 Dicter**, autoriser le microphone si disponible, puis parler en français. La transcription peut également être saisie manuellement si le navigateur ne propose pas la reconnaissance vocale. Cliquer sur **Analyser la demande**, corriger les champs puis **Confirmer l’enregistrement**. L'assistant peut créer un contact, une opportunité liée et une relance, ou une tâche seule.

- Aucun abonnement ni API payante ajouté : extraction de champs par règles JavaScript locales.
- Les expressions comme « demain », « mardi prochain » et les dates explicites sont prises en charge, mais **à vérifier dans l'aperçu**.
- La reconnaissance vocale dépend du navigateur ; certains navigateurs peuvent envoyer l'audio à leur fournisseur de reconnaissance. Aucune garantie de traitement hors ligne.
- Si le montant est annoncé TTC ou sans précision, MOON ne l'assimile pas à un montant HT : il le conserve en note pour qualification.
- Aucune création n'est effectuée sans confirmation explicite.

**Ne dictez pas de données personnelles réelles ESPI avant validation DSI.**

## Préparation de l'intégration Supabase (branche feature/supabase-secure-sync)

La sauvegarde distante est **désactivée tant qu'aucun projet Supabase n'est configuré**. MOON continue à fonctionner localement ; les données existantes ne sont jamais envoyées au serveur automatiquement.

### Mise en place

1. Créer un projet Supabase Free dédié à MOON dans l'organisation choisie, après vérification du prix.
2. Exécuter le fichier SQL **supabase/moon_snapshots.sql** dans l'éditeur SQL du nouveau projet : table protégée par RLS, données séparées par compte, aucun accès anonyme.
3. Dans Supabase Auth > URL Configuration, autoriser **https://nolabernard.github.io/MOON/** comme URL du site et redirection du lien email.
4. Renseigner l'URL et la **clé publiable** sb_publishable_... dans **supabase-config.js**. Ne jamais exposer de clé service_role ou secret.
5. Déployer après validation, puis se connecter dans Réglages > Sauvegarde cloud. Avant la première sauvegarde, exporter un JSON local.
6. Sauvegarder ou restaurer manuellement et confirmer chaque opération. Les restaurations conservent un point de retour local sous la clé moon.crm.v2.precloud.<timestamp>.

### Limites

- Sauvegarde manuelle ; pas de synchronisation automatique ni de fusion multi-appareils.
- Conflits de révision détectés pour éviter un écrasement silencieux.
- Les sauvegardes périodiques JSON restent indispensables.
- Email Auth soumis aux limites du plan gratuit et à sa configuration.
- **Utiliser exclusivement des données fictives sans validation préalable de la DSI de l'ESPI.**
- Le dépôt GitHub reste public : seule une clé publique (publishable) est autorisée dans les fichiers clients.

Tests : node --check app.js && node --check cloud.js && node --check voice.js && node --test tests/*.test.cjs.
