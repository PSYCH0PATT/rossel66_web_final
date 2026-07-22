# Pyrus decommission / archive

After forms cutover (`PYRUS_WRITE_DISABLED=true`):

1. Keep Pyrus **read-only** for the agreed retention window (do not delete historical tasks).
2. Export ID map:
   ```bash
   npm run export:buildin-id-map > backups/buildin-id-map-$(date +%Y%m%d).json
   ```
3. Store export alongside DB backups (not only in Buildin).
4. Disable or rotate Pyrus write credentials once no rollback is expected.
5. Form routes remain named `submit-pyrus-*` for URL stability; they write to Buildin when Pyrus is disabled.
6. Do not remove Pyrus field-map code until archive period ends and Buildin-only path is proven in production.
