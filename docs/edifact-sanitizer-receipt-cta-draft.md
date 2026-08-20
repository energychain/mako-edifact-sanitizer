# Non-live Web-Draft: EDIFACT Sanitizer Receipt

Status: prepared_asset, nicht veroeffentlicht
Betroffene Domain: cernion.de
Fachlicher Owner: Felix / Viki / DevOps; Web-Steward: Webmaster
Source Task: t_debd2855, Parent: t_71f9f2ce
Grounding: RESEARCH_GROUNDED:61c0d4572ea9; oeffentliche EDIFACT/MaKo-Referenzlage plus CET read-only Smoke-Hinweise aus Parent-Handoff
Sensitivity: public-candidate, sanitized; keine echten EDIFACT-, Kunden-, Personen-, Zaehler-, Marktpartner- oder TWL-Daten
HITL-Grenze: kein Live-Publish, kein Deploy, keine externe Kommunikation, keine Preis-/Angebots-/Vertragsclaims, keine Zertifizierungs-/Compliance-Zusage

## Answer-first Landing-Block

### Wie teile ich EDIFACT-Beispiele ohne Kundendaten zu leaken?

Kurzantwort: Teilen Sie keine Roh-EDIFACT-Nachrichten aus produktiven Vorgaengen. Fuer Support, Fehleranalyse oder Prozessklaerung reicht oft ein synthetischer Beleg: echte Struktur, fachlich markierte Pruefpunkte, aber nur frei erfundene Identifikatoren und ein sichtbarer Hinweis, welche Felder ersetzt wurden.

Ein solcher Receipt ist keine zertifizierte Anonymisierung und ersetzt keine Datenschutz-, Rechts- oder EDI@Energy-Pruefung. Er hilft aber, eine fachliche Frage bearbeitbar zu machen, ohne versehentlich Marktpartner-Codes, Zaehlernummern, Kundennamen, Adressen oder Vertragsdaten weiterzugeben.

Cernion kann daraus eine sichere Arbeitslage machen: Was ist die fachliche Frage? Welche EDIFACT-Segmente oder MaKo-Begriffe sind relevant? Welche Angaben wurden synthetisiert? Wo braucht es offizielle Unterlagen oder eine Human-in-the-loop-Pruefung?

## Mini Receipt Example mit Fake-Identifiern

```text
EDIFACT Sanitizer Receipt — Beispiel, synthetisch
Status: FAKE_DATA_ONLY / NOT_FOR_MARKET_COMMUNICATION
Quelle: vom Nutzer nachgebautes Beispiel, keine Produktivnachricht
Zweck: fachliche Rueckfrage zu UTILMD-Struktur und Pruefpfad

Nachrichtentyp: UTILMD
Version/Profil: Beispielprofil, nicht offiziell verifiziert
Referenz-ID: SYN-UTILMD-2026-00042
Marktlokation: DE-SYN-MALO-00000000001
Messlokation: DE-SYN-MELO-00000000001
Zaehlernummer: SYN-ZAEHLER-123456
Marktpartner A: 9900000000001 (synthetisch)
Marktpartner B: 9900000000002 (synthetisch)
Kundendaten: entfernt / nicht enthalten
Adresse: entfernt / nicht enthalten
Zeitraum: 2026-01-01 bis 2026-01-31 (Beispiel)

Sanitizer-Hinweise:
[OK] Keine Namen, Adressen, Telefonnummern oder E-Mail-Adressen enthalten.
[OK] Identifikatoren sind synthetisch und als SYN/990... markiert.
[CHECK] Nachrichtentyp und Qualifier bitte gegen offizielle EDI@Energy-/BDEW-Unterlagen pruefen.
[CHECK] Fachliche Aussage nur als Arbeitslage verwenden, nicht als Marktkommunikationsnachricht.
```

## CTA-Alternativen

### CTA A: Kostenfreies Feedback auf synthetischen Receipt

Button: Synthetischen Receipt pruefen lassen
Microcopy: Schicken Sie kein Roh-EDIFACT. Wir schauen auf einen nachgebauten, synthetischen Receipt und geben Rueckmeldung, ob die fachliche Frage fuer eine sichere Klaerung vorbereitet ist.
Outcome-Stufe: preview_request -> response_received -> test_user_confirmed
Guardrail: Kein Upload echter Kundendaten; keine Zusage, dass der Receipt rechts- oder marktkommunikationskonform anonymisiert ist.

### CTA B: Cernion Datencheck anfragen

Button: Datencheck fuer MaKo-Frage anfragen
Microcopy: Fuer Teams, die wiederholt MaKo-Beispiele, Pruefpfade oder Evidence Chains vorbereiten muessen. Cernion hilft, aus unsicheren Rohdaten eine nachvollziehbare Arbeitslage mit klarer Human-in-the-loop-Grenze zu machen.
Outcome-Stufe: preview_request -> response_received -> qualified_interest
Guardrail: Keine Preise, Angebote oder Projektzusagen auf der Seite; Weiterleitung an Felix fuer Scope-Klaerung.

### CTA C: Willi-Mako fuer fachliche Begriffe nutzen

Button: MaKo-Begriff mit Willi-Mako einordnen
Microcopy: Wenn die Frage zuerst fachlich ist — etwa zu UTILMD, MSCONS, Qualifiern oder Marktrollen — kann Willi-Mako als Orientierungsschicht helfen. Offizielle Unterlagen bleiben die massgebliche Referenz.
Outcome-Stufe: cta_click -> preview_request
Guardrail: Willi-Mako als Orientierung, nicht als offizielle EDI@Energy-Pruefinstanz darstellen.

## Measurement Hooks

- cta_click: Klick auf `synthetic_receipt_feedback`, `cernion_datencheck`, `willi_mako_route`
- preview_request: Formular/Lead mit Anlass `edifact_sanitizer_receipt_preview`
- response_received: interne CRM-/Kanban-Markierung, wenn Rueckmeldung eingeht
- test_user_confirmed: explizite Zustimmung fuer kostenlosen Test/Feedback auf Fake-Daten
- no_real_data_guardrail_seen: optionaler Checkbox-/Banner-Klick `Ich sende keine echten Kunden- oder Produktivdaten`

## Conservative Claim Boundary

Erlaubte Formulierungen:
- „synthetischer Receipt fuer fachliche Klaerung“
- „Arbeitslage statt Rohdatenweitergabe“
- „Human-in-the-loop-Pruefpfad“
- „offizielle Unterlagen bleiben massgeblich“
- „keine Produktivnachricht, keine Marktkommunikation“

Nicht verwenden ohne gesonderte Freigabe/Evidence:
- „anonymisiert garantiert“
- „DSGVO-konform“
- „EDI@Energy-geprueft“
- „BDEW-zertifiziert“
- „rechtssicher“
- „automatische Freigabe fuer Marktkommunikation“
- Preis-, Vertrags-, SLA- oder Integrationszusagen

## Warum jetzt?

Der Parent-Dream-Cycle hat EDIFACT Sanitizer Receipt als Top-Kandidat priorisiert: Es gibt ein klares praktisches Problem in MaKo-/EDIFACT-Supportsituationen, aber auch ein klares Risiko bei Rohdatenweitergabe. Ein nicht-live, answer-first Draft kann Felix/Dogfood/DevOps als sichere gemeinsame Sprache dienen, bevor echte Publikation, Outreach oder Implementierung freigegeben werden.

## Naechster sicherer Schritt

1. Dogfood-Karte t_f0763cfe abwarten: synthetische Smoke-Ergebnisse koennen das Receipt-Beispiel schaerfen.
2. Felix-Karte t_6b60ac72 abwarten: Feedback-Probe kann zeigen, welche CTA-Variante resoniert.
3. Danach HITL/Publish-Scope pruefen, falls ein Live-Block auf cernion.de vorbereitet werden soll.
