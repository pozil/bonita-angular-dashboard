bonita-angular-dashboard
========================
**Bonita BPM Dashboard built on AngularJS and integrated as a custom page in the Bonita Portal.**
Based on Fabio Lombardi's (Bonitasoft) original work
Edited by Philippe Ozil (Bonitasoft)

This pages uses ngBonita (a non-official Bonita REST API client for AngularJS):
[ngBonita GitHub project](https://github.com/rodriguelegall/ngBonita)

<img src="http://pozil.github.io/images/2014-09-30-integrating-angularjs-with-bonita-bpm/screenshot_bonita_angular_dashboard.png"/>


## How to configure the project
This project comes with some configurable properies.
These are set in the following file: /resources/dashboard.js

**HAS_SERVER_SIDE_PAGINATION** Allows to toggle between client and server side pagination. Client side pagination is active by default. It is less efficient in term of server resources but provides an improved UI with sorting and filtering.

**RESOURCE_PATH** This path allows the app to access resources through Bonita custom page server (it should not be modified).

**UI_PAGE_SIZE** This allows to size the listing page lengths.

**CLIENT_SIDE_MAX_SERVER_RESULTS** This allows to set a theorical limit to the number of elements fetched from the server when running in client side pagination mode.

## How to build the project and deploy it in Bonita
**Note:** this requires the 'Custom pages' feature available in Bonita BPM (version greater that 6.3) Efficiency or Performance editions.

1. zip the content of the project without including the parent folder
2. log in Bonita Portal as an administrator user
3. Upload the custom page ZIP file
4. Attach your custom page to a custom profile  [Bonita documentation page](http://documentation.bonitasoft.com/custom-pages)

