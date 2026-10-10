# Y-next

Web interface for ERPNext. Y-next runs on the same site as the data it shows:
it uses the ERPNext session of the signed-in user and reads and writes through
the standard Frappe/ERPNext API.

## Requirements

- Frappe 16 and ERPNext 16. Nothing else: no other apps, no extra Python
  packages and no Node build on the server.

Optional, switched on automatically when present: HRMS (leave, expense claims),
Wiki (knowledge base).

## Install

    bench get-app https://github.com/OpenAEC-Foundation/y_next --branch version-16
    bench --site your.site install-app y_next

Then open `/y-next` on your site.

## Source

This repository is assembled by a release script and holds the built frontend.
Development happens in the source repository:
<https://github.com/OpenAEC-Foundation/Y-app-ERPNext>. Please open issues and
pull requests there.

## License

MIT
