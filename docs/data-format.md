# Moonflow data formats (v1)

Your data belongs to you and must stay readable without this app, forever. This page describes every format the app writes, so any future tool, or a person with a text editor, can read it. The formats are frozen at v1. Future versions may add fields but will never change the meaning of these.

## 1. Plain backup (JSON)

This is what Settings → Export → "Unencrypted backup (JSON)" writes, and it is what the encrypted backup contains once decrypted. Settings → Import reads it back.

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-26T09:00:00.000Z",
  "settings": {
    "lastPeriodStart": "2026-09-10",
    "avgCycleLength": 28,
    "avgPeriodLength": 5
  },
  "entries": [
    {
      "date": "2026-09-10",
      "flow": "medium",
      "symptoms": ["cramps"],
      "mood": "neutral",
      "note": "free text",
      "tags": ["Ibuprofen"],
      "temperature": 36.45,
      "tempDisturbed": false,
      "mucus": "creamy",
      "updatedAt": 1790000000000
    }
  ]
}
```

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | integer | Format version. Currently `1`. Import refuses files newer than it understands. |
| `exportedAt` | ISO 8601 string (UTC) | When the file was made. |
| `settings.lastPeriodStart` | `YYYY-MM-DD` or `null` | The start date given during setup. |
| `settings.avgCycleLength` | integer, 15–45 | Typical cycle length, used until two cycles are logged. |
| `settings.avgPeriodLength` | integer, 1–14 | Typical period length. |
| `entries[]` | array | One object per logged day; `date` is unique. |
| `date` | `YYYY-MM-DD` | A local calendar date. There is no time and no timezone. |
| `flow` | `none` · `spotting` · `light` · `medium` · `heavy` · `null` | Only light, medium and heavy count as period days. |
| `symptoms` | array of ids | `cramps`, `headache`, `bloating`, `fatigue`, `backache`, `nausea`, `tender_breasts`, `acne`, `hot_flashes`, `night_sweats`, `poor_sleep`, `brain_fog`, `joint_aches`, `vaginal_dryness` |
| `mood` | `cry` · `sad` · `neutral` · `smile` · `happy` · `null` | Shown as Very low · Low · Okay · Good · Very happy. |
| `note` | string, ≤ 10,000 characters | Free text. |
| `tags` | array of strings, each 1–40 characters, ≤ 30 per day | Your own tags. The field may be absent in files from before tags existed. |
| `temperature` | number in °C, 34–43, two decimals; or absent/`null` | Waking (basal) body temperature. Always stored in Celsius. |
| `tempDisturbed` | boolean, optional | `true` means the reading may be off (illness, poor sleep, alcohol, measured late). |
| `mucus` | `dry` · `sticky` · `creamy` · `watery` · `eggwhite` · absent/`null` | Cervical mucus, least to most fertile. |
| `updatedAt` | integer (milliseconds since 1970) | When the day was last saved. |

Never exported: the PIN hash, lockout state, theme, draft entry or any other device-only setting.

## 2. Encrypted backup

This is Settings → Export → "Export encrypted backup". The file is JSON too, a self-describing envelope around section 1:

```json
{
  "format": "moonflow-encrypted-backup",
  "version": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 600000,
  "salt": "<base64, 16 bytes>",
  "iv": "<base64, 12 bytes>",
  "ciphertext": "<base64>"
}
```

To decrypt it with any standard crypto library (Web Crypto, Python `cryptography`, OpenSSL):

1. key = PBKDF2-HMAC-SHA256(passphrase as UTF-8, `salt`, `iterations`, 32 bytes)
2. plaintext = AES-GCM-256-decrypt(key, `iv`, `ciphertext`). The last 16 bytes of `ciphertext` are the GCM authentication tag.
3. The plaintext is the UTF-8 JSON from section 1.

A wrong passphrase and a tampered file both fail the GCM check. There is no way to recover a forgotten passphrase.

## 3. Readable copy (CSV)

This is Settings → Export → "Spreadsheet (CSV)". It opens in Numbers, Excel or any text editor. It is not re-importable; JSON is the round-trip format.

- UTF-8, CRLF line endings, RFC 4180 quoting.
- Columns: `Date,Flow,Symptoms,Mood,Tags,Temperature (°C),Mucus,Note`
- Symptoms and tags are separated by `; `. A disturbed temperature is suffixed ` (disturbed)`.
- Any cell starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`, so a spreadsheet never runs it as a formula.

## 4. Calendar reminders (.ics)

This is Settings → Calendar reminders. It is standard iCalendar (RFC 5545): all-day `VEVENT`s with a `VALARM` at `-PT15H`, meaning 9 am the day before. UIDs are `reminder-YYYYMMDD@local.invalid`, so re-importing the file replaces events rather than duplicating them. Titles are neutral ("Reminder") by default.

## 5. On the phone

The app stores the same data in IndexedDB database `MoonflowDB`, with tables `entries` (keyed by `date`) and `settings` (keyed by `key`, one row per setting). The duress PIN uses a separate database, `PlannerData`, with the same shape. Neither can be read from outside the installed web app; export is the way out.
