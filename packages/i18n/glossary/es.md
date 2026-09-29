# Spanish glossary (es)

Tone and preferred terms for AI/agent translation of `messages/es.json`.
English (`en.json`) remains the source of truth — never invent EN keys here.

## Product voice

- Formal but direct operator tool (SME owner / operador). Prefer clear verbs over marketing fluff.
- Use **tú** forms for UI actions when a verb is needed (`Guardar`, `Buscar`), not usted lectures.
- Country-neutral LatAm Spanish — avoid Spain-only slang and Río de la Plata-only forms when a neutral option exists.

## Preferred terms

| Concept (EN) | Prefer (ES) | Avoid |
|---|---|---|
| Today (nav / home) | Hoy | Inicio (ok as secondary), Dashboard |
| Catalog | Catálogo | Inventario (unless stock-specific) |
| Product | Producto | Artículo |
| Settings | Configuración | Ajustes (ok synonym) |
| Organization | Organización | Empresa (unless org is a company name) |
| Member (role key `member`) | Operador | Miembro (role display) |
| Admin | Administrador | Admin (spell out in UI) |
| Owner | Propietario | Owner |
| Invite | Invitar | — |
| Sign in / Login | Iniciar sesión | Login |
| Sign out | Cerrar sesión | Logout |
| Search | Buscar | — |
| Save | Guardar | — |
| Cancel | Cancelar | — |
| Language | Idioma | Lenguaje |

## Nav (when locale = es)

Current starter shell, matching live IA:

- Hoy · Catálogo · Configuración

## Placeholders

Keep `{name}`, `{role}`, `{targetRole}`, `{count}`, `{email}` etc. identical to EN — lint enforces parity.
