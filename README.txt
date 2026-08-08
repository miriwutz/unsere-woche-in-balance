# Unsere Woche – erste Version

Diese Version ist absichtlich zuerst ohne Firebase gebaut, damit das Layout und die Bedienung getestet werden können.

Enthalten:
- Wochenplan Montag–Sonntag
- YouTube-Link + Titel pro Übung
- Abhakfunktion
- kleine Tages-To-dos im Wochenplan
- separate To-do-Liste mit Priorität, Arbeit/Privat, Zeitraum und optionalem Wochentag
- Übungsarchiv
- Bewertung: Super / Okay / Nicht meins
- Favoriten
- Most wanted nach Häufigkeit
- Wieder-einplanen-Funktion
- responsive Darstellung für Handy und PC

Datenspeicherung:
Aktuell localStorage im Browser. Im nächsten Schritt kann dieselbe Oberfläche an Firebase Firestore angeschlossen werden, damit die Daten geräteübergreifend synchronisiert werden.

Dateien:
- index.html
- style.css
- app.js

Version 2: Größeres goldenes Sonne-Mond-Sterne-Element direkt als SVG in die Homepage integriert.

Version 3: Sonne und Mond geometrisch exakt ausgerichtet; größerer goldener Himmels-Schmuck.

Version 4: Wochen vor/zurück blättern, echte Wochen getrennt speichern, Tagesdaten anzeigen.

Version 5:
- YouTube-Link genügt
- Videovorschaubild automatisch aus der YouTube-ID
- automatischer Titelversuch über YouTube oEmbed
- optionaler manueller Titel als Fallback
- kompaktere, optisch ruhigere Videokarten
- Vorschaubilder auch im Übungsarchiv

Hinweis:
Die automatische Titelabfrage braucht eine Internetverbindung. Das Vorschaubild funktioniert ebenfalls online.

Version 6:
- Checkboxen klein und graugrün
- Tages-To-dos linksbündig mit mehr Platz für Text
- bestehende To-dos bearbeitbar (Text, Priorität, Bereich, Zeitraum, Wochentag)
- kompaktere Darstellung der Übungsbibliothek
- Favoriten = manuell gesetzte Lieblingsübungen
- Most wanted = automatisch nach Häufigkeit, ab 2 Durchführungen
- Übungen aus dem Archiv per Einplanen-Dialog einer neuen Woche und einem Wochentag zuweisen

Version 7:
- Einplanen-Dialog repariert (Einplanen, Abbrechen, X)
- Alle Übungen in drei Spalten: Super / Okay / Nicht meins
- innerhalb jeder Spalte neueste zuerst
- Filter Favoriten, Most wanted und Bewertungen bleiben erhalten
- Checkboxen kleiner, organisch abgerundet und dunkelgrün

Version 8:
- Ursache für defekten Einplanen-Dialog behoben: app.js lädt jetzt erst, nachdem der Dialog im DOM vorhanden ist.
- Einplanen, Abbrechen und X funktionieren dadurch zuverlässig.
- Wechselnde Motivationssprüche beim Abhaken von Videos.
- Motivationsspruch erscheint als ruhige Pastell-Meldung statt Browser-Popup.

Version 9:
- Wiederholungszähler korrigiert: jede neu abgehakte Durchführung zählt genau +1.
- Bewertung verändert den Zähler nicht mehr.
- Most wanted ab 2 Durchführungen.
- Most-wanted-Videos werden im Wochenplan mit 🔥 Most wanted markiert.
Hinweis: Bereits durch frühere Testversionen falsch gezählte Altwerte können einmalig noch ungenau sein.

Version 10:
- Most wanted ist jetzt dynamisch.
- Mindestvoraussetzung: 2 Durchführungen.
- Danach gelten ungefähr die obersten 30 % der am häufigsten gemachten Übungen als Most wanted.
- Gleichstände am Grenzwert bleiben gemeinsam enthalten.
- Most wanted wird immer nach Häufigkeit absteigend sortiert.
- 🔥-Kennzeichnung erscheint sowohl im Wochenplan als auch im Archiv.

Version 11:
- Beim ersten Öffnen dieser Version werden alte Testdaten einmalig gelöscht.
- Danach speichert die Seite neue Daten wieder normal.
- Einzelne Übungen können im Archiv gelöscht werden.
- Einzelne eingeplante Videos können mit × aus einer Woche entfernt werden.
- „Alle Übungen löschen“ entfernt Archiv + alle geplanten Videos.
- To-dos bleiben von „Alle Übungen löschen“ unberührt.

Version 12:
- Most wanted erst ab mindestens 2 echten Durchführungen.
- Dynamische Top-30%-Logik bleibt erhalten.
- Motivationskarte deutlich größer, 7 Sekunden sichtbar, mit wechselnden Symbolen.
- Entfernen-X sitzt jetzt sauber oben rechts in der Videokarte.

Version 13:
- Einzige Zählstelle pro YouTube-Video ist jetzt das Archiv.
- Der Wochenplan führt keinen eigenen Wiederholungszähler mehr.
- Jede neu abgehakte Durchführung erhöht den Archivzähler exakt um 1.
- Bewertung verändert die Anzahl niemals.
- Gewählter Smiley wird direkt sichtbar hervorgehoben.
- Nach Bewertung erscheint eine kurze Bestätigung.
- Einmalige Korrektur älterer Testzähler beim ersten Öffnen von Version 13.

Version 14:
- Überschrift geändert zu „Unsere Woche in Balance“.
- Leere Tagesfelder zeigen „Heute ist noch Platz für etwas Schönes.“
- Untertitel wechselt bei jedem Öffnen zufällig zwischen sieben ruhigen Motivationssätzen.
- Direkt hintereinander wird nach Möglichkeit nicht derselbe Satz wiederholt.

Version 15:
- To-dos können mehreren Familienmitgliedern gleichzeitig zugeordnet werden.
- Vier Standard-Farben: Mama, Papa, Kind 1, Kind 2.
- Ein To-do bekommt einen dezenten farbigen Rahmen; bei mehreren Personen wird der Rahmen mehrfarbig.
- Familienrahmen erscheint auch bei kleinen Tages-To-dos im Wochenplan.
- Beim Abhaken eines To-dos erscheint zufällig einer der neuen To-do-Motivationssprüche.
- Bestehende To-dos können nachträglich auch bei „Für wen?“ bearbeitet werden.

Version 16:
- Unterscheidung To-do / Termin.
- ⭐ Superwichtig als zusätzliche Markierung.
- Termine mit Datum und optionaler Uhrzeit.
- Wiederholung: keine, wöchentlich, alle 2 Wochen, monatlich, Schuljahr NÖ 2026/27.
- Schuljahr NÖ 2026/27 wiederholt wöchentlich, lässt offizielle Ferien und schulfreie Tage in NÖ automatisch aus.
- Offizielle NÖ-Termine 2026/27 hinterlegt: Schulbeginn 07.09.2026, Unterrichtsende 02.07.2027, Herbst-, Weihnachts-, Semester-, Oster- und Pfingstferien sowie relevante schulfreie Feiertage.
- Schulautonome Tage sind NICHT automatisch enthalten, da sie je Schule unterschiedlich sind.
- Wiederkehrende Einträge werden pro Auftreten separat abgehakt.
- Termine erscheinen im Wochenplan in einem eigenen Bereich „Termine“.

Version 17: Neuer Schulbereich für zwei Kinder mit Schulpflichten, Fälligkeiten, Fach, Typ und eigenen Lernlinks. Namen sind änderbar. Lokale Speicherung ist für spätere Firestore-Anbindung vorbereitet.

Version 18:
- Kinderbereich freundlicher formuliert und gestaltet.
- Kind 1 = Lou, Kind 2 = Fina.
- „Schulpflicht“ ersetzt durch „Lernaufgabe“.
- Standardfächer als Dropdown: Deutsch, Mathematik, Englisch sowie weitere Fächer und „Anderes Fach“.
- Eigene Lern-Motivationssprüche beim Abhaken.
- Wenn alle Hausübungen erledigt sind: „Wunderbar – deine Hausaufgaben sind geschafft.“
- Schulaufgaben mit Fälligkeitsdatum erscheinen automatisch im Wochenplan.
- Lou und Fina werden dort mit unterschiedlichen Pastellfarben dargestellt.

Version 19:
- Familien-To-dos werden nach Mama, Papa, Lou, Fina, Gemeinsam und Allgemein geclustert.
- Aufgaben derselben Person stehen direkt untereinander.
- Gemeinsame Aufgaben erscheinen nur einmal im Block „Gemeinsam“.
- Lou/Fina in der Familienauswahl korrekt benannt.
- Familienfarben deutlicher.
- Schultermine im Wochenplan mit klaren L/F-Badges statt uneindeutiger Emoji-Symbole.

Version 21:
- Neuer Bereich „Unsere Farben“ bei To-dos & Termine.
- Namen und Farben von Mama, Papa, Lou und Fina frei änderbar.
- Papa startet mit Rot.
- Änderungen gelten automatisch für Familienchips, To-do-Rahmen und Personen-Cluster.
- Gemeinsame Aufgaben behalten einen mehrfarbigen Rahmen aus den aktuell gewählten Familienfarben.

Version 22:
- Schulaufgaben von Lou/Fina können direkt im Wochenplan abgehakt werden.
- Abhaken im Wochenplan aktualisiert sofort den Schulbereich.
- Abhaken im Schulbereich aktualisiert sofort den Wochenplan.
- Erledigte Schulaufgaben bleiben sichtbar, werden aber deutlich abgeblendet, durchgestrichen und mit „✓ erledigt“ markiert.
- Motivationsspruch erscheint auch beim Abhaken direkt im Wochenplan.

Version 23:
- Seitenname konsequent auf „Unsere Woche in Balance“ geändert.
- Browser-Titel ebenfalls „Unsere Woche in Balance“.
- Alle noch vorhandenen sichtbaren Bezeichnungen „Meine Woche“ wurden angepasst.

FINALVERSION:
- komplett neuer Speicherbereich (balanceFinal.*), daher keine Testdaten aus älteren Versionen
- ein gemeinsamer Rahmen pro Personenblock
- gemeinsamer/Regenbogen-Block kräftiger
- Schulaufgaben synchronisieren in beide Richtungen zwischen Schule und Wochenplan
- Schuljahr-Auswahl eingebaut
- NÖ-Ferien 2026/27 hinterlegt
- 2027/28 und 2028/29 auswählbar, aber bewusst noch ohne erfundene Feriendaten

FINAL v25:
- Lou und Fina können beide einen externen Stundenplan-Link verwenden.
- Zusätzlich kann für beide Kinder ein Stundenplan manuell eingetragen werden.
- Montag bis Freitag werden als einfache Textfelder gepflegt.
- Ein gespeicherter manueller Stundenplan kann über „Stundenplan ansehen“ geöffnet werden.
- Link und manueller Stundenplan können parallel existieren.

FINAL v26:
- manueller Stundenplan nicht mehr als Freitext
- pro Unterrichtsblock: von, bis, Fach, hinzufügen
- Standardfächer: GU, REL, Bewegung & Sport, Werken, Anderes
- Unterrichtsblöcke erscheinen als kleine runde Kärtchen
- mehrere GU-Blöcke pro Tag möglich
- Blöcke einzeln löschbar
- alte Freitext-Stundenpläne werden beim Laden in einfache Fach-Blöcke ohne Zeit migriert

FINAL v27: klassische Stundenplantabelle; 24h-Zeiten; schuljahresbezogenes 'Zu Hause bis' dezent im Wochenplan; Druckbutton mit A4-Querformat.

FINAL CLEAN:
- komplett neuer Produktions-Speicherbereich balanceProd.* -> keine Testdaten aus vorherigen Versionen
- Druckansicht blendet YouTube/Übungen vollständig aus
- Stundenplan-Fenster verbreitert, sauber zentriert, ohne horizontales Scrollen
- Stundenplan-Tabelle im Ansichtsfenster klarer und besser lesbar
- Schließen über X und unteren Schließen-Button robust abgesichert

FINAL v28:
- „Zu Hause bis“ steht im Wochenplan direkt unter Tag/Datum.
- Im Stundenplan steht „Zu Hause bis“ direkt unter den Wochentagen.
- Stundenplan-Dialog deutlich breiter und ohne horizontale Scrollleiste.
- „Heute ist noch Platz für etwas Schönes.“ wird nicht gedruckt.
- YouTube-Videos bleiben aus der Druckansicht ausgeschlossen.

FINAL LEER:
- Beim ersten Start werden alte lokale Test-Inhalte (To-dos, Termine, Schulaufgaben,
  Lernlinks, Stundenpläne, Heimkehrzeiten und Übungen/Videos) entfernt.
- Lou und Fina bleiben als Kinder voreingestellt.
- Familienmitglieder/Farben und die vorhandenen Funktionen bleiben erhalten.
- Danach werden alle neu eingetragenen Daten wieder normal gespeichert.

FIREBASE VERSION:
- Firebase Authentication (E-Mail/Passwort) schützt die Familienseite.
- Firestore synchronisiert eine gemeinsame Familienwoche über families/shared.
- Änderungen werden zusätzlich lokal gespeichert und automatisch in Firestore geschrieben.
- Live-Synchronisierung: Änderungen auf einem Gerät erscheinen auf den anderen Geräten.
- GitHub Pages bleibt das Hosting; Firebase Hosting wird nicht benötigt.
