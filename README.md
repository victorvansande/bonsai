# Bonsai-almanak

Een kleine web-app voor Wouter en Nona. Ze houdt bij wanneer hun ficus bonsai aandacht vraagt: grond voelen, blad nakijken, draaien, mesten, knippen en afstoffen. Het ritme verschuift per maand.

Eén bestand, geen build: `index.html`. Alles wordt in de browser van het toestel bewaard (`localStorage`), dus elk toestel houdt zijn eigen logboek bij.

## Online zetten

GitHub → Settings → Pages → Source: `main`, map `/ (root)`. De app staat daarna op `https://victorvansande.github.io/bonsai/`.

Op de telefoon: open die link en kies "Zet op beginscherm". Dan opent ze schermvullend, als een app.

## Ritme aanpassen

De taken staan bovenaan het script in `index.html`, in de lijst `TASKS`. `every(m)` geeft het aantal dagen tussen twee beurten voor maand `m` (0 = januari).
