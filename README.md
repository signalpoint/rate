rate
====

The Rate module for DrupalGap.

Installation
============

1. Enable this module on your Drupal site:

     https://drupal.org/project/services_votingapi

2. Follow the README for the services_votingapi module.

3. Enable the "DrupalGap Rate" module, it is included as a sub
   module within the DrupalGap module:

     https://drupal.org/project/drupalgap

4. Enable the following module in your DrupalGap app:

     https://github.com/signalpoint/votingapi

5. Then enable this module in your app's settings.js file:

     Drupal.modules.contrib['rate'] = {};
