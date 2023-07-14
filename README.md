# fringe-remix
Script to build fast, static, mobile-friendly, responsive [schedule pages](https://fringe.unsprung.com) for the annual Minnesota Fringe Festival.

Scrapes data from the [festival's dynamic website](https://minnesotafringe.org/), which often loads waaaay too slow, and builds schedule pages for each of the 13 days.

*Not approved or endorsed by Minnesota Fringe,* but I believe Fair Use, and a utility to "power users" like me. Only hits their pages when the build script runs, IE nightly, to pick up any changes. Show titles all link to their official show pages for ticketing, etc.

Just something I threw together!

## Technology
- **node** server-side javascript
- **axios** for http requests
- **cheerio** for html parsing
- **mustache** templates
- **bootstrap** css