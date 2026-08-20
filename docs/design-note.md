# Willi-Mako EDIFACT Sanitizer: Pseudo-Marktpartner A/B Mapping und Lookup-Design

Kanban: `t_d875fbd2`
Status: technical design candidate; no code, no deploy, no GitHub write.

## Scope und Sicherheitsgrenze

Ziel ist ein OSS-first CLI/Library-Sanitizer fuer EDIFACT-Praxisfaelle. Er soll reale Marktpartner-, Lokations- und Kontaktwerte durch dokumentierte Demo-/Pseudo-Werte ersetzen und dabei die fachliche Lesbarkeit erhalten.

Nicht-Ziel:
- keine Garantie auf vollstaendige Anonymisierung;
- keine produktive Weiterleitung oder Routingfaehigkeit der erzeugten EDIFACT-Dateien;
- keine Speicherung realer Eingaben ausser optionalem lokalen Mapping/Report, wenn explizit gewuenscht;
- kein Webservice/AVV/Hosting ohne separaten Legal-/Ops-Scope.

Formulierung nach aussen: "Anonymisierungs-/Pseudonymisierungshilfe fuer EDIFACT-Fallbesprechungen", nicht "rechtssichere Anonymisierung".

## Arbeitsgrundlage / Repository-Beobachtung

OpenClaw Recall lieferte fuer die spezifische Sanitizer-Idee keinen belastbaren Treffer. Lokal existiert aber ein relevanter Cernion-MSCONS-Parser:

- `/mnt/backup/openclaw/.openclaw/workspace/cernion-energy-tools-pr314-hygiene/src/edm-mscons-parser.js`
- `/mnt/backup/openclaw/.openclaw/workspace/cernion-energy-tools-pr314-hygiene/tests/edm-mscons-parser.test.js`

Beobachtung daraus:
- Tokenisierung fuer UNA/Segment/Element/Component/Release ist bereits vorhanden und sanitizer-tauglich wiederverwendbar.
- MSCONS-Parser extrahiert aktuell `NAD+MS` als Sender, `NAD+MR` als Empfaenger sowie `LOC+172` als MeLo-ID.
- Testfixture zeigt deutsche Marktpartnerwerte mit `::293` und MeLo in `LOC+172`.

## 1. Feld-/Segmentklassen fuer Sender/Empfaenger vs. Payload-Marktpartner

### EDIFACT-Envelope / Transportebene

Primaere Envelope-Identitaeten:
- `UNB`:
  - S002 = interchange sender;
  - S003 = interchange recipient;
  - zusaetzlich Datum/Zeit/Kontrollreferenz, die ggf. fallbezogen pseudonymisiert werden koennen.
- optional `UNG`/`UNE`, falls Nachrichtengruppen genutzt werden:
  - group sender/recipient analog pruefen.
- `UNH`:
  - Message reference und Message type, z.B. `UTILMD`, `APERAK`, `MSCONS`, `INVOIC`, `PRICAT`.
  - Message type bleibt erhalten; Referenz kann pseudonymisiert werden.
- `UNT`/`UNZ`:
  - Kontrollzaehler/-referenzen muessen nach Aenderungen konsistent bleiben bzw. unveraendert, wenn segment count gleich bleibt.

Designregel: Envelope-Sender/Recipient bestimmen standardmaessig die message-local Rollen A/B:
- A = Sender in der sanierten Ausgabe;
- B = Recipient in der sanierten Ausgabe.
Bei reinen Payload-Mappings darf A/B nicht blind aus der ersten `NAD`-Reihenfolge abgeleitet werden, wenn `UNB` vorhanden ist.

### Payload-Parteien / Marktpartner

Primaere Payload-Identitaeten:
- `NAD` ist der wichtigste Marktpartner-/Adress-Segmenttyp.
  - Element 1 = party function code qualifier / fachliche Rolle.
  - Element 2 = party identification details inkl. ID und Code-list qualifier, z.B. `::293` in vorhandenen MSCONS-Beispielen.
  - weitere Elemente koennen Namen/Adresse enthalten und muessen entfernt/ersetzt werden.
- `CTA` / `COM`:
  - Ansprechpartner, Telefon, Mail, Fax etc.; immer sensibel, standardmaessig entfernen oder durch Demo-Kontakt ersetzen.
- `RFF`:
  - Referenzen koennen Vertrags-, Vorgangs-, Rechnungs-, Zaehler-, Bestell- oder fremde Dokumentnummern enthalten; qualifikatorbasiert pseudonymisieren.
- `LOC`:
  - Lokationsidentitaeten; im vorhandenen MSCONS-Code ist `LOC+172` MeLo. Je nach Nachricht koennen MaLo/MeLo/Zaehler-/Ort-/Bilanzierungs- oder Lieferstellenreferenzen vorkommen.
- `CUX`, `MOA`, `QTY`, `DTM`, `PRI`:
  - keine Marktpartneridentitaet, aber ggf. kommerziell/fallbezogen sensibel. Fuer Coaching-Faelle sollten Werte wahlweise erhalten, gerundet oder synthetisiert werden.
- Freitextsegmente (`FTX`) und Fehler-/Hinweistexte (`ERC`/`FTX` in APERAK-Kontexten):
  - koennen reale IDs, Namen, MaLo/MeLo/BDEW-Codes oder Kundendaten enthalten; Regex-/Lookup-basierter Secondary Scan noetig.

### Nachrichtentyp-spezifische Schwerpunkte

UTILMD:
- Relevant fuer Stammdaten; viele `NAD`, `LOC`, `RFF`, `PIA/CCI`-artige fachliche Gruppen koennen Marktpartner- und Lokationsbezug tragen.
- Sanitizer muss hier besonders rollen-/loop-aware sein, weil Marktrollen und Lokationen fachlich zentral sind.

APERAK:
- Envelope und Payload-Parteien plus Fehlerreferenzen.
- Kritisch sind `RFF`, `FTX`, urspruengliche Dokumentnummern und ggf. Echo-Daten aus der beanstandeten Nachricht.

MSCONS:
- Bestehende lokale Implementierung: `NAD+MS`/`NAD+MR` und `LOC+172`.
- Messwerte koennen fachlich erhalten bleiben; MeLo/Referenzen muessen ersetzt werden.

INVOIC:
- Parteien ueber `NAD` sowie Rechnungs-/Vertrags-/Steuer-/Bank-/Referenzdaten ueber `BGM`, `RFF`, ggf. `FTX` und Zahlungssegmente.
- Geldbetraege optional beibehalten, gerundet oder skaliert, je nach Coaching-Zweck.

PRICAT:
- Parteien, Katalog-/Produkt-/Preisreferenzen und Gueltigkeitszeitraeume.
- Sanitizer sollte Marktpartner und kommerzielle Produkt-/Tarifnamen trennen: technische Struktur erhalten, reale Namen ersetzen.

## 2. Sichere/offline Rollen-Inferenz ueber Marktpartner-Lookup

Vorgeschlagene Pipeline:

1. Parse ohne Normalisierung:
   - EDIFACT sicher tokenisieren, Originalwerte mit Pfad erfassen: `segmentIndex`, `tag`, `qualifier`, `elementPath`, raw value.
2. Actor-Kandidaten bilden:
   - Envelope actor aus `UNB.S002/S003`;
   - Payload actors aus `NAD` party IDs;
   - Lokations-/Objekt-IDs aus `LOC`, relevanten `RFF`, Freitext-Regex.
3. Offline Lookup:
   - lokaler, versionierter Marktpartner-Snapshot oder vorhandener Lookup-Adapter;
   - keine Live-Abfrage im Default-CLI-Modus;
   - Lookup-Ergebnis nur fuer Kategorie/Rolle nutzen, nicht im Report als reale Stammdaten ausgeben.
4. Role Evidence zusammenfuehren:
   - `UNB` direction = A/B directionality confidence high;
   - `NAD` qualifier = role evidence medium/high;
   - Marktpartner-Lookup category = actor type evidence medium;
   - Nachrichtentyp/loop-Kontext = Zusatzgewicht.
5. Confidence bestimmen:
   - high: ID eindeutig im Lookup + passender NAD/Envelope-Kontext;
   - medium: nur NAD qualifier oder nur Lookup category;
   - low: nur Regex/FTX/unknown code.
6. Sanitized Replacement anwenden:
   - erst Werte, dann Textfelder/Freitext, dann Report.

Safety-Regeln:
- Lookup darf fehlende/mehrdeutige Rollen nicht "erfinden"; dann `UNKNOWN_A`/`UNKNOWN_B` oder generische `MP_A`/`MP_B`.
- Lookup-Snapshot wird nur lokal gelesen und nicht mit Eingabedaten angereichert.
- Report enthaelt keine Original-IDs im Klartext; optional Hash-Fingerprints (`sha256(value + localSalt)`) nur fuer Debug/Mapping-Konsistenz.

## 3. Pseudo-Master-Data-Schema

### Actor Types

Interne Normalformen:
- `SUPPLIER` / alias `LIEF`
- `GRID_OPERATOR` / alias `NB`
- `MSB` / Messstellenbetreiber
- `METERING_SERVICE` oder `MDL`, falls fachlich getrennt
- `BALANCING` / `BKV` falls im Format erkennbar
- `CUSTOMER` nur wenn explizit erforderlich; sonst Kundendaten entfernen statt als Marktpartner behandeln
- `UNKNOWN` / `MP`

### Message-local A/B mode

Default fuer einzelne Nachricht:
- `A` ist immer Envelope-Sender der sanierten Nachricht.
- `B` ist immer Envelope-Recipient der sanierten Nachricht.
- Payload-Vorkommen derselben Original-ID nutzen denselben Actor-Key.
- Wenn eine dritte Partei auftaucht: `C`, `D`, ... mit Rolle, z.B. `NB_C`.

Beispiele fuer Alias-Namen:
- `LIEF_A Demo Lieferant A`
- `NB_B Demo Netzbetreiber B`
- `MSB_A Demo Messstellenbetreiber A`
- `MP_C Demo Marktpartner C`

### Case-stable actor mapping mode

Default fuer Fallbuendel / Coaching-Case:
- Actor-Key wird aus Original-ID bzw. robustem Fingerprint bestimmt.
- Erste Sichtung bekommt `actor_001`, `actor_002`, ... plus Rolle.
- `sender/recipient` ist dann nur eine Relation pro Nachricht, nicht die Actor-Identitaet selbst.
- Antwortnachrichten duerfen Envelope-A/B Richtung flippen, aber dieselbe Originalpartei bleibt z.B. `NB_001`.

Empfohlene Option:
- `--mapping-scope message` fuer Einzelnachrichten;
- `--mapping-scope case --mapping-file case-map.json` fuer Mehrnachrichtenfaelle;
- `case-map.json` enthaelt nur Hash/Fingerprint -> pseudo actor, keine Klartext-Originalwerte.

### Demo-Codes

Prinzip:
- Keine realen Marktteilnehmer imitieren.
- Feste Demo-Werte als eigenes dokumentiertes Namespace-Set ausliefern.
- Vor Release gegen Marktpartner-Lookup pruefen: ein Demo-Code darf im verwendeten Snapshot keinen Treffer liefern.
- Demo-Werte als nicht-routingfaehig dokumentieren; nicht fuer produktive Marktkommunikation geeignet.

Moegliche technische Form:
- `WILLI-MAKO-DEMO-A`, `WILLI-MAKO-DEMO-B` fuer interne/JSON-Reports.
- In EDIFACT-Feldern, die numerische IDs erwarten, syntaktisch passende Demo-Ziffernfolgen aus einem reservierten lokalen Set, z.B. `9900000000001`, `9900000000002`, nur nach Lookup-Denylist-Pruefung.
- Qualifier/Code-list-Komponenten moeglichst strukturell erhalten, aber Report muss markieren: `demoCode: true`, `routable: false`.

Offene fachliche Pruefung vor Implementierung: welche Test-/Demo-ID-Ranges in der deutschen MaKo offiziell oder de-facto sicher nicht routbar sind. Bis dahin keine Behauptung "BDEW-gueltig", sondern "syntax preserving demo value".

## 4. Relationale Konsistenz

Mapping-Invarianten:
- Gleicher Originalwert innerhalb Scope -> gleicher Pseudowert.
- Unterschiedliche Originalwerte -> unterschiedliche Pseudowerte, ausser explizit `collapseUnknown=true`.
- Envelope A/B wird aus aktueller Nachricht bestimmt; case-stable Actor-ID bleibt ueber Nachrichten gleich.
- Bei Rollenwechsel/Konflikt: Actor behält stabile ID, Alias kann mehrere role evidences fuehren, z.B. `MP_001` mit `observedRoles: [NB, MSB]` und `confidence: medium`.
- Segment counts und EDIFACT-Trennzeichen bleiben stabil; wenn Laengen-/Formatlimits verletzt wuerden, fallback auf kuerzere Demo-IDs.

## 5. Anonymisierungsreport

Empfohlenes JSON-Schema:

```json
{
  "tool": "willi-mako-edifact-sanitizer",
  "version": "0.x",
  "messageType": "MSCONS",
  "mappingScope": "message|case",
  "lookupSnapshot": { "name": "local-market-partner-snapshot", "version": "YYYY-MM-DD" },
  "actors": [
    {
      "pseudoActorId": "NB_A",
      "directionInMessage": "sender|recipient|thirdParty",
      "detectedCategories": ["GRID_OPERATOR"],
      "evidence": ["UNB.S002", "NAD+MS", "lookup:category"],
      "confidence": "high",
      "replacements": [
        { "segment": "UNB", "path": "S002.0004", "replacementClass": "marketPartnerId" },
        { "segment": "NAD", "qualifier": "MS", "path": "C082.3039", "replacementClass": "marketPartnerId" }
      ]
    }
  ],
  "objectReplacements": [
    { "type": "MELO", "segment": "LOC", "qualifier": "172", "replacementClass": "locationId", "confidence": "high" }
  ],
  "untouchedFieldClasses": ["messageType", "segmentStructure", "quantityValues"],
  "warnings": [
    "No guarantee of full anonymization; review FTX/attachments manually.",
    "Unknown NAD qualifier XYZ left role-generic."
  ]
}
```

Der Human-Report sollte keine Originalwerte enthalten. Fuer Debug optional:
- lokale Mapping-Datei mit Hash-Fingerprint;
- separate `--include-originals` nur fuer lokale Entwicklung, default aus.

## 6. Implementierungskandidaten OSS CLI/Library

### Phase 0: fixtures and parser extraction

- Extract reusable EDIFACT tokenizer from existing MSCONS parser or reimplement as standalone module.
- Add fixtures for MSCONS existing sample plus minimal synthetic UTILMD, APERAK, INVOIC, PRICAT skeletons.
- Tests: tokenizer preserves UNA separators, escaped delimiters, segment count.

### Phase 1: generic replacement engine

- AST/path model: segment index, tag, elements/components.
- Replacement registry for:
  - `UNB.S002/S003`;
  - `NAD` party ID/name/address;
  - `CTA`/`COM` contacts;
  - `LOC` MaLo/MeLo-like IDs;
  - `RFF` references;
  - `FTX` secondary regex scan.
- Tests: same original -> same pseudo; different original -> different pseudo; no segment count change.

### Phase 2: role inference + lookup adapter

- Interface: `lookupMarketPartner(id) -> {category, displayRole, sourceVersion, confidence}`.
- Offline adapter: local snapshot JSON/CSV; no network default.
- Role evidence merger and confidence scoring.
- Tests: lookup miss, ambiguous role, NAD/UNB conflict, reply-message flip.

### Phase 3: pseudo master-data catalog

- Built-in demo catalog for A/B/C actors per role.
- `--mapping-scope message|case`.
- Optional `--case-map case-map.json` storing fingerprints only.
- Demo-code denylist check against lookup snapshot.

### Phase 4: report and CLI UX

CLI proposal:

```bash
willi-mako-sanitize input.edi \
  --out sanitized.edi \
  --report report.json \
  --mapping-scope message \
  --lookup ./market-partners.snapshot.json \
  --no-originals-in-report
```

Exit behavior:
- `0`: sanitized with warnings allowed;
- `2`: parse failed / unsafe output not written;
- `3`: demo-code collision with lookup snapshot;
- `4`: unsupported critical segment class.

### Phase 5: expert-pool workflow integration, still offline

- Zip bundle: sanitized EDIFACT + report + human summary.
- Manual review checklist before sharing.
- Optional Cernion/Willi-Mako recognizability via pseudo names/report branding, not advertising text inside EDIFACT.

## Tests / Acceptance Criteria

Minimum tests before implementation handoff:
- MSCONS: `NAD+MS`, `NAD+MR`, `LOC+172` replaced; quantities and DTM preserved.
- UNB: sender/recipient replaced and A/B assigned from envelope.
- Case bundle: message 1 A->B, reply B->A; stable actors remain coherent.
- Lookup miss: actor becomes `MP_A`/`MP_B` with low/medium confidence, not a false NB/LIEF.
- CTA/COM/FTX: contacts and embedded IDs are removed/replaced.
- Demo collision: synthetic demo value that exists in lookup snapshot fails closed.
- Report: no raw original IDs in default report.
- Golden-file tests for UTILMD, APERAK, MSCONS, INVOIC, PRICAT minimal fixtures.

## HITL / separate approval boundaries

Requires separate approval before:
- GitHub issue/comment/write;
- code change in OSS repo;
- Claude-Code/Coding-Agent dispatch;
- hosted webservice/AVV/legal text;
- live lookup/network dependency;
- public claim that output is legally anonymized;
- use of real customer/TWL/mixed-sensitive EDIFACT examples.

## Recommended next internal step

Create a narrow implementation card only after Thorsten/product owner confirms:
1. target repository/package name;
2. accepted demo-code namespace policy;
3. whether first milestone is standalone CLI or library API;
4. whether Willi-Mako expert-pool workflow needs case-bundle mode in MVP.

Suggested implementation title:
`[Willi-Mako][EDIFACT_SANITIZER_MVP] Offline CLI/library with A/B pseudo market partner mapping for MSCONS-first fixtures`
