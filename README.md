# MOON — CRM commercial local

MOON est un mini-CRM pour les opportunités ESPI Executive : Kanban, fiches prospects, historique des interactions, relances et suivi des montants HT/TTC.

## Installation de la version fonctionnelle

1. Récupérer l'archive **MOON_CRM_local_GitHub.zip** fournie dans la conversation ChatGPT.
2. Décompresser l'archive sur un Mac.
3. Ouvrir le dossier `MOON` puis lancer `launch_moon.command`.
4. Ouvrir `http://127.0.0.1:8765`.

Prérequis : Python 3.10+. L'installation initiale nécessite Internet pour les dépendances. Ensuite, les données sont stockées localement dans `~/Library/Application Support/MOON/moon.sqlite3`.

## GitHub

Ce dépôt est privé. Il ne doit jamais contenir les données commerciales, les fichiers SQLite ou les exports de contacts.

**État :** le dépôt est créé et accessible. Le code complet de l'application n'est pas encore publié ici ; il se trouve dans l'archive mentionnée ci-dessus.

## Sécurité

Application locale mono-utilisateur, sans authentification : ne pas exposer le port sur Internet. Faire valider l'usage de données ESPI par la DSI avant utilisation.
