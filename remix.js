const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');
const mustache = require('mustache');

// SETUP

const baseDomain = 'https://minnesotafringe.org';
const festYear = '2024';
const festLengthDays = 11;
const festStart = '2024-08-01';
const festDays = [
    {dayNum:  1, isoDate: '2024-08-01', dateStr: '08/01', slug: '801', dow: 'Thu', dom:  '1', label: 'Thursday 8/01'},
    {dayNum:  2, isoDate: '2024-08-02', dateStr: '08/02', slug: '802', dow: 'Fri', dom:  '2', label: 'Friday 8/02'},
    {dayNum:  3, isoDate: '2024-08-03', dateStr: '08/03', slug: '803', dow: 'Sat', dom:  '3', label: 'Saturday 8/03'},
    {dayNum:  4, isoDate: '2024-08-04', dateStr: '08/04', slug: '804', dow: 'Sun', dom:  '4', label: 'Sunday 8/04'},
    {dayNum:  5, isoDate: '2024-08-05', dateStr: '08/05', slug: '805', dow: 'Mon', dom:  '5', label: 'Monday 8/05'},
    {dayNum:  6, isoDate: '2024-08-06', dateStr: '08/06', slug: '806', dow: 'Tue', dom:  '6', label: 'Tuesday 8/06'},
    {dayNum:  7, isoDate: '2024-08-07', dateStr: '08/07', slug: '807', dow: 'Wed', dom:  '7', label: 'Wednesday 8/07'},
    {dayNum:  8, isoDate: '2024-08-08', dateStr: '08/08', slug: '808', dow: 'Thu', dom: '8', label: 'Thursday 8/08'},
    {dayNum:  9, isoDate: '2024-08-09', dateStr: '08/09', slug: '809', dow: 'Fri', dom: '9', label: 'Friday 8/09'},
    {dayNum: 10, isoDate: '2024-08-10', dateStr: '08/10', slug: '810', dow: 'Sat', dom: '10', label: 'Saturday 8/10'},
    {dayNum: 11, isoDate: '2024-08-11', dateStr: '08/11', slug: '811', dow: 'Sun', dom: '11', label: 'Sunday 8/11'},
];
const venues = [
    // {venue: "Augsburg Mainstage"},
    // {venue: "Augsburg Studio"},
    // {venue: "Mixed Blood Theatre"},
    // {venue: "Rarig Center Arena"},
    // {venue: "Rarig Center Thrust"},
    // {venue: "Rarig Center Xperimental"},
    // {venue: "Bryant Lake Bowl", tag: "IP"},
    // {venue: "Crane Theater", tag: "IP"},
    // {venue: "Four Seasons Dance Studio", tag: "IP"},
    // {venue: "The Hook and Ladder Theater and Lounge", tag: "IP"},
    // {venue: "Maison Bodega", tag: "IP"},
    // {venue: "Phoenix Theater", tag: "IP"},
    // {venue: "Strike Theater", tag: "IP"},
    {venue: 'Barbara Barker Center for Dance'},
    {venue: 'Bryant Lake Bowl'},
    {venue: 'HUGE Improv Theater'},
    {venue: 'Mixed Blood Theatre'},
    {venue: 'Open Eye Theatre'},
    {venue: 'Phoenix Theater'},
    {venue: 'The Southern Theater'},
    {venue: 'Strike Theater'},
    {venue: 'Theatre in the Round'},
    {venue: 'American School of Storytelling', tag: 'IP'},
    {venue: 'Corner Coffee Uptown', tag: 'IP'},
    {venue: 'Squirrel Haus Arts', tag: 'IP'},
    {venue: 'The Comedy Corner - Underground', tag: 'IP'},
    {venue: 'The Ribs of Humanity at Campbell Plaza', tag: 'IP'},
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
    const showDataRaw = fs.readFileSync('shows-bare.json');
    let showData = JSON.parse(showDataRaw).filter(s => !!s);
    let scrapePromises = showData.map( function(show) {
        return scrapeShowPageDetails(show);
    });
    Promise.all(scrapePromises).then( (values) => {
        console.log('show scrapePromises all done!');
        fs.writeFileSync('shows-details.json', JSON.stringify(values, null, 2));
    });
}

function scrapeReviewsPage() {
    const showDataRaw = fs.readFileSync('shows-details.json');
    const showData = JSON.parse(showDataRaw);

    // axios.get(`https://minnesotafringe.org/reviews/${festYear}`)
    axios.get(`https://minnesotafringe.org/reviews/2023`)
        .then(function(response){
            const scores = parseReviewsPage(response.data, showData);
            const showDataWithScores = decorateShowsWithScores(showData, scores);
            // fs.writeFileSync('shows-details.json', JSON.stringify(showDataWithScores, null, 2));
        });

}

function parseReviewsPage(content) {
    let $page = cheerio.load(content, {xmlMode: false});
    let scores = [];
    const showEls = $page('table.customerreviews tr[count]');
    $page(showEls).each( function (i, s) {
        let score = {};
        score.ratingCount = parseInt($page(this).attr('count'));
        score.ratingAverage = parseFloat($page(this).attr('score'))
        score.showUrl = $page(this).find('td:nth-of-type(3) a').attr('href');
        scores.push(score);
    })
    return scores;
}

function decorateShowsWithScores(showData, scores) {
    return showData.map((show) => {
        let score = scores.find((score) => score.showUrl == show.showUrl);
        return {...show, ...score};
    })
    // unset scores for shows with no reviews?
}

async function scrapeShowPageDetails(show) {
    if (!show.showUrl) {
        console.error('No showUrl', show);
        return;
    }
    try {
        const response = await axios.get(baseDomain + show.showUrl);
        console.log('scrapeShowPageDetails parsing ' + show.showUrl);
        let details = parseShowPageDetails(response.data);
        return {...show, ...details};
    } catch (error) {
        console.error(error);
    }
}

function parseShowPageDetails(content) {
    let $page = cheerio.load(content, {xmlMode: false});
    let details = {};
    details.description = $page('.large-4 div:nth-of-type(3)').text().trim();
    details.venue = $page('.large-4 div:nth-of-type(2) a').text().trim();
    details.createdBy = $page('.row.text-center p').text().trim();
    details.castCrewCount = $page('#cast-and-crew div.mb2').length;
    details.videoLink = showVideoLink($page);

    // redundant with scrapeReviewsPage, and these seem different from shows list rating?!
    details.ratingAverage = showRatingFromStars($page('.score-container'));
    details.ratingCount = $page('.review-container').find('.rating-stars').length;

    // "FavId" - ID for "favoriting" (heart icon))
    // weird spot to find this, in newsletter signup mini form
    // also on showsList page, so, would be set by initial scrapeShows
    details.showFavId = $page('.footer__newsletter-heading span[data-finder-id]').attr('data-finder-id');

    return details;
}

function parseShowPageRatings(content) {
    let $page = cheerio.load(content, {xmlMode: false});
    let details = {};
    details.ratingCount = $page('.review-container').find('.rating-stars').length;
    details.ratingAverage = showRatingFromStars($page('.score-container')); // different from shows list rating?!
    return details;
}

function showVideoLink($page) {
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
    let type = videoScript.match(/videoType = "(\w+)"/)[1];
    if (type == 'YouTube') {
        return videoScript.match(/youTubeURL = "(.+)"/)[1] + id;
    } else if (type == 'Vimeo') {
        return videoScript.match(/vimeoURL = "(.+)"/)[1] + id;
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
    // decorate events
    // @todo alert if show not found?
    .map( (e) => {
        let show = showData.find((s) => s.showFavId == e.showFavId);
        if(!show) {
            console.error('no show found by showFavId', e);
        }
        return {...e,
            // byArtist: showData.find((s) => s.showUrl == e.showUrl).byArtist,
            showUrl: show.showUrl,
            byArtist: show.byArtist,
            venueTag: venues.find((v) => v.venue == e.venue).tag ?? "",
        };
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

    fs.readFile('schedule.mustache', function (err, template) {
        if (err) throw err;
        const content = mustache.render(template.toString(), data);
        fs.writeFile('schedule-' + dayMeta.slug + '.html', content, err => {
            if (err) throw err;
            // file written successfully
        });
    });
}

function renderCsv() {
    console.log("renderCsv()");
    const separator = "\t";
    const scheduleDataRaw = fs.readFileSync('schedule.json');
    let scheduleData = JSON.parse(scheduleDataRaw);
    const showDataRaw = fs.readFileSync('shows-details.json');
    let showData = JSON.parse(showDataRaw);
    showData.filter((s) => !s.droppedOut).map( function(s) {

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
        .join(separator);
        console.log( '"' + s.showTitle + '"' + separator + baseDomain + s.showUrl + separator + s.byArtist + separator + festDaysList );

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
if (flags.includes('-v')) {
    scrapeReviewsPage();
}
if (flags.includes('-r')) {
    render();
}
if (flags.includes('-c')) {
    renderCsv();
}
if (flags.length == 0) {
    console.info("remix.js flags, in typical order or operations");
    console.info("-s   scrape Shows list into shows-bare.json");
    console.info("-t   scrape schedule Times into schedule.json");
    console.info("-d   scrape show Details into shows-details.json");
    console.info("-v   scrape show reViews, update shows-details.json");
    console.info("-r   Render html files from saved json");
    console.info("-c   render Csv file");
}