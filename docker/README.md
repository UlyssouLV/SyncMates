# Docker - Strategie image socle PHP/Apache

Ce dossier documente la strategie Docker du projet SyncMates.

Objectif:
- creer une image socle commune avec Apache + PHP
- reutiliser cette image dans chaque container de version (1.0.0, 1.1.0, etc.)
- eviter de reconfigurer Apache/PHP a chaque nouvelle version

---

## Pourquoi une image socle ?

Une image socle permet de centraliser:
- l'installation PHP
- la configuration Apache
- les reglages PHP (php.ini)
- les modules Apache actives (rewrite, headers, ...)

Ensuite, chaque image applicative de version ne fait que copier le code du projet.

---

## Structure actuelle

```txt
docker/
  README.md
  base/
    Dockerfile
    apache-site.conf
    php.ini
```

`docker/base/` contient l'image socle reutilisable.

---


## Note contexte local

Actuellement, Docker Desktop ne demarre pas sur cette machine car la virtualisation n'est pas activee.

Quand la virtualisation sera disponible, la strategie ci-dessus pourra etre appliquee directement sans modifier l'architecture du repo.
