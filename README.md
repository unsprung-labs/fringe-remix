# fringe-remix
A script to build fast, mobile-friendly [schedule pages](https://fringe.unsprung.com) for the annual [Minnesota Fringe Festival](https://minnesotafringe.org/), an awesome explosion of live theater with 60+ performances on some days.

The festival's CMS-powered dynamic website often runs waaaay too slow. This scrapes data it and builds lightweight, static schedule pages for all 13 days. They load in milliseconds, not deca-seconds.

*Not approved or endorsed by Minnesota Fringe,* but I believe Fair Use, and a utility for busy "power users". Only hits their pages when the build script runs, IE nightly, to pick up any changes. Show titles all link to their official show pages for ticketing, etc.

Just something I threw together!

## Technology
- **node** server-side javascript
- **axios** for http requests
- **cheerio** for html parsing
- **mustache** templates
- **bootstrap** css