# Fonts

Georgian typefaces used by `css/fonts.css`:

| Role | Family | Files expected here |
| --- | --- | --- |
| Body text, descriptions | Mark GEO | `MarkGEO-Regular`, `MarkGEO-Medium`, `MarkGEO-SemiBold`, `MarkGEO-Bold`, `MarkGEO-ExtraBold` |
| Headings, buttons, labels | Mark GEO CAPS | `MarkGEOCAPS-Regular`, `MarkGEOCAPS-Medium`, `MarkGEOCAPS-SemiBold`, `MarkGEOCAPS-Bold`, `MarkGEOCAPS-ExtraBold` |

Each file can be `.woff2` (preferred), `.woff`, `.otf` or `.ttf`. If your files
are named differently, update the `url(...)` entries in `css/fonts.css`.

Until the files are uploaded, visitors see Mark GEO only when it is installed
on their computer; everyone else gets Noto Sans Georgian.
