const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');
const handlebars = require('handlebars');
const ratingViz = require('./rating-viz-bar-vert-ctr');

console.log("running...");

// SETUP
// @todo? ideas
// * find global max of review counts and/or bin content
//   to put show scores in context (IE 1 five-star review vs 20)
//   (at close of 2024, max count was 67, median ~12)

const baseDomain = 'https://minnesotafringe.org';
const festYear = '2025';
const festLengthDays = 11;
const festStartString = '2025-07-31 17:30 CDT';
const festStart = new Date(festStartString);
const festDays = buildFestDaysArray(festStart, festLengthDays);
const offStageRoles = ['Director', 'Assistant Director', 'Associate Director', 'Creative Director', 'Artistic Director', 'Dramaturg', 'Producer', 'Production Assistant', 'Production Support', 'Technical Director', 'Box Office', 'Stage Manager', 'Assistant Stage Manager', 'Makeup Designer', 'Sound Designer', 'Set Builder', 'Props', 'Playwright', 'Writer', 'Author', 'Composer', 'Choreographer', 'Fight Choreographer', 'Fight Captain', 'Intimacy Consultant', 'Intimacy Coordinator', 'Lighting Designer', 'Lighting Design', 'Light Design', 'Board Operator', 'Graphic Designer', 'Logo Design', 'Photographer', 'Videographer', 'Dialect Coach', 'Language & Dialect Coach', 'Additional Voices', 'Child Wrangler'];
const tagDetails = [
    {
        tag: "BFF",
        iconClass: "bi-gift promo",
        label: "Bring a Friend to Fringe",
        category: "promo",
    },
    {
        tag: "AD",
        iconClass: "bi-headset",
        label: "Audio Description",
        category: "access",
    },
    {
        tag: "ASL",
        iconClass: "bi-hand-index-thumb",
        label: "ASL Interpreter",
        category: "access",
    },
    {
        tag: "OC",
        iconClass: "bi-chat-left-dots",
        label: "Open Captions",
        category: "access",
    },
];

var globalRatingTotalCountMax,
    globalRatingBinCountMax;

const venues = [
    // {venue: "Augsburg Mainstage"},
    // {venue: "Augsburg Studio"},
    {venue: 'Barbara Barker Center for Dance', area: 'CR'},
    {venue: 'Bryant Lake Bowl', area: 'UP'},
    {venue: 'HUGE Improv Theater', area: 'UP'},
    {venue: 'Mixed Blood', area: 'CR'},
    {venue: 'Open Eye Theatre', area: 'VV'},
    {venue: 'Rarig Kilburn Theatre', alias: 'Rarig Arena', area: 'CR'},
    {venue: 'Rarig Nolte Xperimental Theatre', alias: 'Rarig X', area: 'CR'},
    {venue: 'Rarig Stoll Thrust Theatre', alias: 'Rarig Thrust', area: 'CR'},
    {venue: 'The Southern Theater', area: 'CR'},
    {venue: 'Theatre in the Round', area: 'CR'},
    // Independent Producer venues:
    {venue: 'American School of Storytelling', isIP: true, tag: 'IP', area: 'LP'},
    {venue: 'Phoenix Lobby', isIP: true, tag: 'IP', area: 'UP'},
    {venue: 'Phoenix Theater', isIP: true, tag: 'IP', area: 'UP'},
    {venue: 'Red Eye Theater', isIP: true, tag: 'IP', area: 'CR'},
    {venue: 'Strike Theater', isIP: true, tag: 'IP', area: 'NE'},
    // {venue: 'Corner Coffee Uptown', isIP: true, tag: 'IP', area: 'UP'},
    // {venue: 'Squirrel Haus Arts', isIP: true, tag: 'IP', area: 'LF'},
    // {venue: 'The Comedy Corner - Underground', isIP: true, tag: 'IP', area: 'CR'},
    // {venue: 'The Ribs of Humanity at Campbell Plaza', isIP: true, tag: 'IP', area: 'CR'},
    // {venue: "Bryant Lake Bowl", tag: "IP"},
    // {venue: "Crane Theater", tag: "IP"},
    // {venue: "Four Seasons Dance Studio", tag: "IP"},
    // {venue: "Maison Bodega", tag: "IP"},
    // {venue: "The Hook and Ladder Theater and Lounge", tag: "IP"},
]
const venueSort = venues.map(i => i.venue);

// SCRAPE

function scrapeSchedule() {
    console.log("scrapeSchedule()...");
    let scheduleData = {
        scrapeTime: + new Date(),
        days: [],
    };
    let parsePromises = festDays.map( function(d) {
        return readSchedulePage(`https://minnesotafringe.org/schedule/${festYear}?d=${d.isoDate}`, d.dayNum, scheduleData);
    });
    Promise.all(parsePromises).then( (values) => {
        console.log('all done! writing schedule.json...');
        // filter out null item at days[0]
        scheduleData.days = scheduleData.days.filter(d => d);
        fs.writeFileSync('schedule.json', JSON.stringify(scheduleData, null, 2));
    });
}

async function readSchedulePage(url, i, scheduleData) {
    try {
        const response = await axios.get(url);
        console.log('readSchedulePage success');
        const events = parseSchedulePage(response.data);
        console.log('i, output rows:', i, events.length);
        scheduleData.days[i] = {
            events: events,
            dayNum: i,
        };
    } catch (error) {
        console.error(error);
    }
}

function parseSchedulePage(content) {
    console.log('content:', content.length, 'bytes');
    let $ = cheerio.load(content, {xmlMode: false});
    let inRows = $('table.theScheduleTable tbody tr');
    console.log('input rows:', inRows.length);
    var events = [];
    $(inRows).each( function (i, e) {
        let event = {};
        event.time = $(this).find('td.tdevent').text().trim();
        event.venue = $(this).find('td.tdvenue a').text().trim();
        event.showTitle = $(this).find('td.tdshow a').text();
        event.showFavId = $(this).attr('data-show_fav_id');
        let modalId = $(this).find('button.showLink').attr('data-open');
        event.showUrl = $('#' + modalId).find('h4 a').attr('href')

        // parse tags like "ASL" from day
        let dayTag = $(this).find('td.tddate').text().trim();
        const dtrx = /^(\d+\/\d+)\s*(.*)/;
        event.date = dayTag.match(dtrx)[1];
        event.serviceTags = dayTag.match(dtrx)[2];
        // console.log('row:', event);
        events.push(event);
    });
    return events;
}

async function scrapeShowsList() {
    // Complete list is not available without paging through via "Load More" btn
    let nextPageUrl = 'https://minnesotafringe.org/shows/' + festYear;
    // let nextPageUrl = 'https://minnesotafringe.org/shows/2023?&prop_ModuleId=39277&page=6';
    let showData = [];
    try {
        while (nextPageUrl) {
            console.log('scrapeShows from:', nextPageUrl);
            const response = await axios.get(nextPageUrl);
            let $page = cheerio.load(response.data, {xmlMode: false});
            let pagedShowData = await parseShowsList($page);
            showData = showData.concat(pagedShowData);
            nextPageUrl = $page('a.loadMoreBtn').length ? $page('a.loadMoreBtn').attr('href') : false;
            await sleep(500);
        }
        console.log('Found ' + showData.length + ' total shows');
        fs.writeFileSync('shows-bare.json', JSON.stringify(showData, null, 2));
    } catch (error) {
        console.error(error);
    }
}

async function parseShowsList(cheerioObj) {
    // console.log('shows content:', content.length, 'bytes');
    let $ = cheerioObj;
    let showEls = $('div.shows_list .shows_desc');
    console.log('showEls count:', showEls.length);
    let shows = [];
    $(showEls).each( function (i, s) {
        let show = {};
        let modalId = $(this).find('h6 a').attr('data-open'); // e.g. 'showModal45635'
        show.showUrl = $('#' + modalId).find('h4 a').attr('href')
        show.showFavId = modalId.match(/\d+$/)[0];
        show.showTitle = $(this).find('h6 a').text().trim();
        show.byArtist  = $(this).find('.mb6 b').text().trim();
        shows.push(show);
    });
    return shows;
}

function scrapeShowDetails() {
    const showsBareRaw = fs.readFileSync('shows-bare.json');
    let showsBare = JSON.parse(showsBareRaw).filter(s => !!s);
    let scrapePromises = showsBare.map( function(show) {
        return scrapeShowPageDetails(show);
    });
    Promise.all(scrapePromises).then( (scrapedDetails) => {
        console.log('show scrapePromises all done!');
        fs.writeFileSync('shows-details.json', JSON.stringify(scrapedDetails, null, 2));
    });
}

function scrapeReviewsPage() {
    const showDataRaw = fs.readFileSync('shows-details.json');
    const showData = JSON.parse(showDataRaw);

    axios.get(`https://minnesotafringe.org/reviews/${festYear}`)
        .then(function(response){
            const scores = parseReviewsPage(response.data, showData);
            const showDataWithScores = decorateShowsWithScores(showData, scores);
            fs.writeFileSync('shows-details.json', JSON.stringify(showDataWithScores, null, 2));
        });

}

// deprecated
function parseReviewsPage(content) {
    let $page = cheerio.load(content, {xmlMode: false});
    let scores = [];
    const showEls = $page('table.customerreviews tr[count]');
    $page(showEls).each( function (i, s) {
        let score = {};
        score.ratingCount = parseInt($page(this).attr('count'));
        score.ratingAverage = parseFloat($page(this).attr('score')); // actual float average, not half-stars
        score.showUrl = $page(this).find('td:nth-of-type(3) a').attr('href').split('#')[0]; // discard '#reviews'
        scores.push(score);
    })
    return scores;
}

function decorateShowsWithScores(showData, scores) {
    return showData.map((show) => {
        let score = scores.find((score) => score.showUrl == show.showUrl);
        if (!score) {
            // console.log('No score found for', show);
            return show;
        }
        delete score.showUrl; // paranoia, don't want to replace this
        return {...show, ...score};
    })
    // unset scores for shows with no reviews?
}

async function scrapeShowPageDetails(show) {
    if (!show.showUrl) {
        console.error('No showUrl', show);
        return null;
    }
    let tryCount = 0;
    const maxTries = 3;

    while(true) {
        try {
            console.log('scrapeShowPageDetails reading ' + show.showUrl);
            const response = await axios.get(baseDomain + show.showUrl);
            let details = parseShowPageDetails(response.data);
            return {...show, ...details};
        } catch (error) {
            if (error.response && [502].includes(error.response.status)) {
                tryCount++;
                if (tryCount > maxTries) {
                    console.error('502 after 3 tries: ' + show.showUrl);
                    return null;
                }
            }
            else if (error.response && error.response.status == 404) {
                // Status code not in 2xx range, and 404 specifically
                console.error('404: ' + show.showUrl);
                return null;
                // console.log(error.response.data);
                // console.log(error.response.headers);
            }
            else {
                console.error(error);
                return null;
            }
            // return null;
        }
    }
}

function parseShowPageDetails(content) {
    let $page = cheerio.load(content, {xmlMode: false});
    let details = {};
    details.createdBy = $page('.row.text-center p').text().trim();
    details.venue = $page('.large-4 div:nth-of-type(2) a').text().trim();
    details.description = $page('.large-4 div:nth-of-type(3)').text().trim();
    details.genreTags = $page('.large-4 div:nth-of-type(4) a').map(function(i,e) { return $page(this).text() }).get();

    details.castCrewCount = $page('#cast-and-crew div.mb2').length;
    details.videoLink = videoLinkForShow($page);
    details.ratingStats = parseShowPageRatings($page);
    details.castList = parseShowPageCast($page);

    // "FavId" - ID for "favoriting" (heart icon))
    // weird spot to find this, in newsletter signup mini form
    // also on showsList page, so, would be set by initial scrapeShows
    details.showFavId = $page('.footer__newsletter-heading span[data-finder-id]').attr('data-finder-id');

    return details;
}

function parseShowPageRatings($page) {
    let results = {};
    results.totalCount = $page('.review-container').find('.rating-stars').length;

    if (results.totalCount == 0) {
        return results;
    }

    let ratingsList = [];
    let binCounts = {}
    let binCountsNorm = {}
    $page('.review-container .review-user-info').each( function (i, r) {
        ratingsList.push(showRatingFromStars($page(this)));
        // get reviewer ID to downweight those who only review one show?
        // '/reviews/2025?member=1557258'
        // $page(this).find('a').attr('href').match(/member=(\d+)/)[1];
    });
    // results.ratingsList = ratingsList;
    results.minRating = Math.min( ...ratingsList );
    results.maxRating = Math.max( ...ratingsList );
    results.avgRating = ratingsList.reduce((sum, val) => sum + val) / ratingsList.length;

    // histogram
    for (const score of ratingsList) {
        binCounts[score] = binCounts[score] ? binCounts[score] + 1 : 1;
    }
    // normalize counts to 1.0
    const maxBinCount = Math.max(...Object.values(binCounts));
    for (const bin in binCounts) {
        binCountsNorm[bin] = binCounts[bin] / maxBinCount;
    }
    results.distribution = binCountsNorm;

    // weighted avg where lower ratings count more
    // e.g. (weightPow 2)  : 5 => 1, 3 => 9, 0.5 => 30.25 (kinda harsh on a few shows)
    // e.g. (weightPow 1.5): 5 => 1, 3 => ~5.2, 0.5 => ~12.9
    const weightPow = 1.5;
    const weightedSum = ratingsList.reduce((sum, value, index) => sum + value * (6 - value) ** weightPow, 0);
    const weightsSum = ratingsList.reduce((sum, value) => sum + (6 - value) ** weightPow, 0);
    results.weightedAvgRating = weightedSum / weightsSum;

    return results;
}

function parseShowPageCast($page) {
    let results = [];
    $page('#cast-and-crew > div.mb2').get().map((row) => {
        results.push({
            name: $page(row).find('h6').text(),
            role: $page(row).find('b').text(),
        });
    });
    return results;
}

function videoLinkForShow($page) {
    // Iframe src is not populated since Cheerio does not run js.
    // Find video info in script tag, otherwise need Puppeteer.

    // Some have defective user data:
    // $('#video iframe').attr('src')
    // > 'https://www.youtube.com/embed/https://www.youtube.com/watch?v=luZNFJP_E1s'
    // script:
    // videoID = "https://www.youtube.com/watch?v=luZNFJP_E1s";
    // videoID = "https://youtu.be/Ut_03EJ9hws";
    let videoScript = $page('script')
        .filter(function() {
            return $page(this).text().match('videoID') }
        ).first().text();
    if (!videoScript) {
        return undefined;
    }

    let idRaw = videoScript.match(/"([^"]+)"/)[1];
    let id = false;
    if (idRaw.match(/^http.*(youtu|vimeo)/)) {
        // "bad" user entered link, not ID
        return idRaw;
    }
    else {
        id = idRaw;
        // else {
        //     console.error('bad videoID', videoScript);
        //     return undefined;
        // }
    }
    if (!id) {
        console.error('bad videoID', videoScript);
        return undefined;
    }
    // problem? "videoLink": "https://www.youtube.com/embed/TO FOLLOW"
    let type = videoScript.match(/videoType = "(\w+)"/)?.[1];
    if (type == 'YouTube') {
        return videoScript.match(/youTubeURL = "(.+)"/)[1] + id;
    } else if (type == 'Vimeo') {
        return videoScript.match(/vimeoURL = "(.+)"/)[1] + id;
    } else {
        console.error('no video type', videoScript);
    }
}

function showRatingFromStars($el) {
    if ($el.find('.rating-stars').text() == '') {
        return undefined;
    }
    return 0 +
        $el.find('.rating-stars').find('.iconIcom-ReviewKitty-Full').length +
        ($el.find('.rating-stars').find('.iconIcom-ReviewKitty-Half').length / 2);
    // $el.find('.rating-stars').find('.iconIcom-ReviewKitty-Empty').length;
}

// RENDER

function render() {
    console.log("render()");
    const scheduleDataRaw = fs.readFileSync('schedule.json');
    let scheduleData = JSON.parse(scheduleDataRaw);
    const showDataRaw = fs.readFileSync('shows-details.json');
    let showData = JSON.parse(showDataRaw);
    showData = showData.map(formatShow);
    globalRatingTotalCountMax = showData.filter(s => s).reduce((max, show) => Math.max(show.ratingStats.totalCount, max), 0);
    festDays.forEach( function(day) {
        // console.log('festDay', day);
        renderPage(scheduleData, showData, day.dayNum);
    });
}

function renderPage(scheduleData, showData, dayNum) {
    console.log('renderPage for dayNum', dayNum);

    // get events for this day
    let dayTimeEvents = Object.values(scheduleData.days).find( function(day) {
        return !!day && day.dayNum == dayNum;
    }).events
    // filter out events with no show (e.g. "TEST SHOW")
    .filter( (e) => {
        let show = showData.find((s) => !!s && s.showFavId == e.showFavId);
        if(!show) {
            console.error('no showData found by showFavId (in filter), for event: ', e);
            return false;
        }
        return true;
    })
    // decorate events
    .map( (e) => {
        // parse and decorate serviceTags list
        e.eventTags = [];
        if(e.serviceTags.match(/(BFF|OC|ASL|AD)/g)) {
            let eventTags = e.serviceTags.match(/(BFF|OC|ASL|AD)/g);
            tagDetails.forEach((td) => {
                if (eventTags.includes(td.tag)) {
                    e.eventTags.push(td);
                }
            });
        }

        let show = showData.find((s) => !!s && s.showFavId == e.showFavId);
        if(!show) {
            console.error('no showData found by showFavId (in map), for event: ', e);
            return e;
        }
        show.ratingStats.ratingDisp = Math.floor(10 * show.ratingStats.weightedAvgRating) / 10;
        show.ratingGraphContent = ratingViz.render(show.ratingStats);
        return {
            ...e,
            ...show,
            venueTag: venues.find((v) => v.venue == e.venue)?.tag ?? "",
        };
        // add occurrences so we can show how many more a show has?
        // scheduleData.days.filter(d => d.events.find(e => e.showFavId == 45755)).map(d => d.dayNum);
    })
    // sort to match master array
    .sort((a, b) => venueSort.indexOf(a.venue) - venueSort.indexOf(b.venue))
    // group by timeSlot (as object keys)
    .reduce((timeSlots, event) => {
        const timeSlot = (timeSlots[event.time] || {
            timeSlot: event.time,
            timeNum: timeLabelToInt(event.time),
            events: []
        });
        timeSlot.events.push(event);
        timeSlots[event.time] = timeSlot;
        return timeSlots;
    }, {})
    ;

    let timeSlotList = Object.keys(dayTimeEvents).map((ts) => (timeLabelToInt(ts))).sort();

    // discard timeslot keys and sort
    // (how is there no fluent chainable .values()? :/)
    dayTimeEvents = Object.values(dayTimeEvents)
    .sort((a, b) => timeLabelToInt(a.timeSlot) - timeLabelToInt(b.timeSlot));

    // console.log('dayTimeEvents', dayTimeEvents );
    // log one timeslot to avoid shortening to [Object]
    // console.log('dayTimeEvents', Object.values(dayTimeEvents)[0] );

    const dayNav = festDays.map( function (dayRef) {
        let day = {...dayRef};
        day['active'] = (day.dayNum == dayNum) ? 'active' : '';
        return day;
    });
    const dayMeta = festDays.find( function (day) {
        return day.dayNum == dayNum;
    });

    const data = {
        docTitle: `Fringe Quick Schedule - ${dayMeta.dow} ${dayMeta.dateStr}/${festYear}`,
        baseDomain: baseDomain,
        scrapeTime: new Date(scheduleData.scrapeTime).toLocaleString(),
        renderTime: new Date().toLocaleString(),
        dayNav: dayNav,
        dayLabel: dayNum,
        dayMeta: dayMeta,
        timeSlots: timeSlotList, // for intra-page scrolling/anchors?
        timesWithEvents: dayTimeEvents,
    };

    fs.readFile('schedule.handlebars', function (err, templateText) {
        if (err) throw err;
        const template = handlebars.compile(templateText.toString());
        const content = template(data);
        fs.writeFile('schedule-' + dayMeta.slug + '.html', content, err => {
            if (err) throw err;
            // file written successfully
        });
    });
}

function formatShow(show, index) {
    show.castList = formatCast(show.castList);
    show.hideCreatedBy = (new RegExp(`.* by\\s+${show.byArtist}\\s*$`)).test(show.createdBy) || show.createdBy.trim().length == 0;
    return show;
}

function formatCast(castList) {
    return castList
        .filter(function(person) {
            // remove people not on stage (@todo or flag, sort last, and display e.g. muted)
            // break out e.g. "Writer/Director"
            const roles = person.role.trim().split(/\s*(?:\/|,|&)\s*/);
            return ! roles.every(role => offStageRoles.includes(role));
        })
        .map(function(person) {
            // remove "(She/Her)" etc
            person.name = person.name.trim().replace(/\s*\(\w{1,5}\/\w{1,5}\)/, '');
            return person;
         })
         .filter(person => person.name.length > 0)
    ;
}

// for a spreadsheet
function renderCsv() {
    // console.log("renderCsv()");
    const separator = "\t";
    const scheduleDataRaw = fs.readFileSync('schedule.json');
    const scheduleData = JSON.parse(scheduleDataRaw);
    const showDataRaw = fs.readFileSync('shows-details.json');
    const showData = JSON.parse(showDataRaw);

    const headRow = [
        'Producer',
        'Title',
        'Web Page',
        'Venue',
        'Description',
    ].concat(festDays.map(d => d.dateStr));
    console.log(headRow.join(separator));

    showData.filter((s) => !s.droppedOut)
    .map( function(s) {
        // all days, with show's event if scheduled or undefined if not
        let festDaysList = festDays.map((day) => {
            let scheduleDay = scheduleData.days.find((d) => d.dayNum == day.dayNum);
            return scheduleDay.events.find((e) => (e.showFavId == s.showFavId));
        })
        .map((dayEvent) =>{
            if (dayEvent) {
                return dayEvent.time.replace(/ PM$/, '').replace(/:00$/, ''); // short-form time
            }
            else {
                return ''; // empty cell to fill grid
            }
        })
        // .join(separator);

        let showRow = [
            s.byArtist.replace(/"/g, '""'), // escape quotes
            '"' + s.showTitle.replace(/"/g, '""') + '"',
            `"=HYPERLINK(""${baseDomain}${s.showUrl}"")"`, // formula
            s.venue,
            '"' + s.description.replace(/"/g, '""') + '"',
        ].concat(festDaysList);
        console.log(showRow.join(separator));

    });
}

// UTILITIES

async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

function timeLabelToInt(timeLabel) {
    let [h, m, ap] = timeLabel.split(/[: ]/);
    h = (ap == 'PM') ? 12 + parseInt(h) : parseInt(h);
    // return ('' + h + m).padStart(4, '0');
    return (h * 100) + parseInt(m);
}

function buildFestDaysArray(festStartDate, festLengthDays) {
    let festDays = [];
    let iDay = 0;
    while(iDay < festLengthDays)  {
        let iDate = new Date(festStartDate.valueOf() + (iDay * 86400000));
        festDays.push({
            dayNum:  iDay + 1, // "primary key"
            isoDate: iDate.toISOString().substring(0,10), // in schedule urls
            dateStr: iDate.toLocaleDateString('en-US', {month: 'numeric', day: '2-digit'}), // 8/02
            slug: iDate.toLocaleDateString('en-US', {month: '2-digit'}) + iDate.toLocaleDateString('en-US', {day: '2-digit'}), // for filename
            dow: new Intl.DateTimeFormat("en-US", {weekday: 'short'}).format(iDate),
            dom:  iDate.getDate(), // day of month
            label: iDate.toLocaleDateString('en-US', {weekday: 'long', month: 'numeric', day: '2-digit'}).replace(',', ''), // for template
        });
        iDay++;
    }
    return festDays;
}

function fixVideoLink(link) {
    // https://player.vimeo.com/video/932197541 -> https://vimeo.com/932197541
    // [0-9]+
    // https://www.youtube.com/embed/yOqIMSVRo6Y -> https://www.youtube.com/watch?v=yOqIMSVRo6Y
    // [a-zA-Z0-9\-_]+

}

// MAIN

const flags = process.argv.slice(2);

if (flags.includes('-s')) {
    scrapeShowsList();
}
if (flags.includes('-t')) {
    scrapeSchedule();
}
if (flags.includes('-d')) {
    scrapeShowDetails();
}
// if (flags.includes('-v')) {
//     scrapeReviewsPage();
// }
if (flags.includes('-r')) {
    render();
}
if (flags.includes('-c')) {
    renderCsv();
}
if (flags.length == 0) {
    console.info("remix.js flags, in typical order of operations");
    console.info("-s   scrape Shows list into shows-bare.json");
    console.info("-t   scrape schedule Times into schedule.json");
    console.info("-d   scrape show Details into shows-details.json");
    // console.info("-v   scrape show reViews, update shows-details.json");
    console.info("-r   Render html files from saved json");
    console.info("-c   render Csv file");
}