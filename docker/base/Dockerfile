FROM php:8.3-apache

# Image socle commune pour tous les projets/versions SyncMates.
# Elle contient Apache + PHP + configuration standard.

# Modules Apache utiles pour une API PHP avec routage via .htaccess.
RUN a2enmod rewrite headers

# VirtualHost commun: document root pointe vers /var/www/html/public
# (structure utilisée par ce repo).
COPY docker/base/apache-site.conf /etc/apache2/sites-available/000-default.conf

# Réglages PHP de base réutilisables.
COPY docker/base/php.ini /usr/local/etc/php/conf.d/syncmates.ini

WORKDIR /var/www/html
