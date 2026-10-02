# Pinterest developer compliance review

Reviewed against the current Pinterest Developer Guidelines and API best practices on October 2, 2026.

## Passing controls

- PinDash is described as an independent publishing tool and does not claim Pinterest endorsement.
- Pinterest credentials remain server-side, encrypted, and excluded from logs and exports.
- OAuth is used instead of collecting Pinterest usernames or passwords.
- Each Pin requires an explicit immutable approval; scheduling does not create unreviewed Pins.
- The UI links published results back to their canonical Pinterest Pin URL.
- The application includes public privacy, terms, support, disconnection, export, and deletion information.
- PinDash does not scrape Pinterest, train AI from Pinterest material, sell API data, or test rate limits.
- PinDash uses its own visual identity and does not imitate Pinterest's interface.

## Required before declaring full compliance

1. Ask Pinterest to confirm whether the 60-second in-memory board-page cache is permitted. The published guidelines broadly prohibit storing API information outside specified exceptions.
2. Confirm in writing which connection identity and board identifiers may be retained to deliver the user-requested publishing service.
3. Replace placeholder public domains and support/privacy email addresses with controlled production addresses.
4. Review the final staging UI and video to ensure Pinterest logos, word marks, and screenshots use approved assets and do not imply endorsement.
5. Re-run this review immediately before the production-access submission because Pinterest policies can change.

Until these points are resolved, the project checklist item for Pinterest branding and Developer Guidelines compliance remains open.
