# Bonsai-almanak

Een kleine web-app voor Wouter en Nona. Ze houdt bij wanneer hun ficus bonsai aandacht vraagt: grond voelen, blad nakijken, draaien, mesten, knippen en afstoffen. Het ritme verschuift per maand.

Geen framework, geen build. `index.html` is het geraamte, `app.css` de vormgeving, `content.js` alle tekst en het verzorgingsritme, `app.js` de logica, `sw.js` laat de app offline openen.

## Waar de gegevens staan

Op de telefoon zelf, in twee kopieën (`localStorage` en IndexedDB). De app sluiten of de telefoon herstarten verandert daar niets aan. Wat wel alles wist: de websitegegevens van de browser wissen, de app van het beginscherm verwijderen (iPhone), of een privévenster gebruiken.

Daarom zit er in het Logboek een reservecode. Die code bevat de naam en de hele stand, en zet alles terug op dezelfde of een andere telefoon.

Op iPhone heeft de app op het beginscherm een eigen geheugen, los van Safari. Dus eerst op het beginscherm zetten, dan pas de naam kiezen.

Het fotodagboek (één foto per maand) staat ook alleen op de telefoon, verkleind tot ongeveer 200 kB per foto. De foto's zitten niet in de reservecode. In het Logboek staat een knop om ze allemaal te exporteren.

Testen zonder de echte gegevens te raken: open de app met `?test` achter het adres.

## Online zetten

GitHub → Settings → Pages → Source: `main`, map `/ (root)`. De app staat daarna op `https://victorvansande.github.io/bonsai/`.

Op de telefoon: open die link en kies "Zet op beginscherm". Dan opent ze schermvullend, als een app.

## Ritme aanpassen

De taken staan in `content.js`, in de lijst `TASKS`. `every(m)` geeft het aantal dagen tussen twee beurten voor maand `m` (0 = januari).
