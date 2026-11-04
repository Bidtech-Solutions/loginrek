# CLAUDE.md — loginrek

@AGENTS.md

## Catatan khusus Claude Code

- Aturan proyek ada di `AGENTS.md` (di-import di atas); tambahkan aturan umum di sana.
- Dokumentasi di `docs/`. Kontrak API: `docs/API.md` — jangan mengarang endpoint/respons.
- Plugin `expo@claude-plugins-official` diaktifkan lewat `loginrek-mobile/.claude/settings.json`.
- Tidak bisa membuka simulator/HP di sini; verifikasi mobile dengan
  `npm run lint && npm run typecheck && npm test && npm run doctor`, dan bila perlu
  `npx expo export --platform ios --platform android` untuk memastikan bundle bisa dibuat.
