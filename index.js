const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');
const mustache = require('mustache');

// SETUP

const baseDomain = 'https://minnesotafringe.org';
const festYear = '2023';
const festDays = [
    {dayNum:  1, isoDate: '2023-08-03', dateStr: '08/03', slug: '803', dow: 'Thu', dom:  '3', label: 'Thursday 8/03'},
    {dayNum:  2, isoDate: '2023-08-04', dateStr: '08/04', slug: '804', dow: 'Fri', dom:  '4', label: 'Friday 8/04'},
    {dayNum:  3, isoDate: '2023-08-05', dateStr: '08/05', slug: '805', dow: 'Sat', dom:  '5', label: 'Saturday 8/05'},
    {dayNum:  4, isoDate: '2023-08-06', dateStr: '08/06', slug: '806', dow: 'Sun', dom:  '6', label: 'Sunday 8/06'},
    {dayNum:  5, isoDate: '2023-08-07', dateStr: '08/07', slug: '807', dow: 'Mon', dom:  '7', label: 'Monday 8/07'},
    {dayNum:  6, isoDate: '2023-08-08', dateStr: '08/08', slug: '808', dow: 'Tue', dom:  '8', label: 'Tuesday 8/08'},
    {dayNum:  7, isoDate: '2023-08-09', dateStr: '08/09', slug: '809', dow: 'Wed', dom:  '9', label: 'Wednesday 8/09'},
    {dayNum:  8, isoDate: '2023-08-10', dateStr: '08/10', slug: '810', dow: 'Thu', dom: '10', label: 'Thursday 8/10'},
    {dayNum:  9, isoDate: '2023-08-11', dateStr: '08/11', slug: '811', dow: 'Fri', dom: '11', label: 'Friday 8/11'},
    {dayNum: 10, isoDate: '2023-08-12', dateStr: '08/12', slug: '812', dow: 'Sat', dom: '12', label: 'Saturday 8/12'},
    {dayNum: 11, isoDate: '2023-08-13', dateStr: '08/13', slug: '813', dow: 'Sun', dom: '13', label: 'Sunday 8/13'},
];
const venues = [
    {venue: "Augsburg Mainstage"},
    {venue: "Augsburg Studio"},
    {venue: "Mixed Blood Theatre"},
    {venue: "Rarig Center Arena"},
    {venue: "Rarig Center Thrust"},
    {venue: "Rarig Center Xperimental"},
    {venue: "Southern Theater"},
    {venue: "Theatre in the Round"},
    {venue: "Bryant Lake Bowl", tag: "IP"},
    {venue: "Crane Theater", tag: "IP"},
    {venue: "Four Seasons Dance Studio", tag: "IP"},
    {venue: "The Hook and Ladder Theater and Lounge", tag: "IP"},
    {venue: "Maison Bodega", tag: "IP"},
    {venue: "Phoenix Theater", tag: "IP"},
    {venue: "Strike Theater", tag: "IP"},
]
const venueSort = venues.map(i => i.venue);

// SCRAPE

function scrapeTest() {
    console.log("scrapeTest()");
    let scheduleData = {
        scrapeTime: + new Date(),
        days: [],
    };
    let parsePromises = [
        readLocalFile('sample/2022 Schedule 8-06.html', 3, scheduleData),
        readLocalFile('sample/2022 Schedule 8-05.html', 2, scheduleData),
        readLocalFile('sample/2022 Schedule 8-04.html', 1, scheduleData),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done');
        finalRender(scheduleData);
    });
}

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
        fs.writeFileSync('schedule.json', JSON.stringify(scheduleData));
    });
}

function testParse() {
    console.log("testParse()");
    // initOutput('sample/sample-schedule.html');
    // var outDoc = cheerio.load('', {xmlMode: false});
    // var events = '';
    let scheduleData = {};
    readLocalFile('sample/2022 Schedule 8-04.html', 19978, scheduleData);
    // readLocalFile('sample/sample-schedule.html', 2, scheduleData);
    // console.log('OUTPUT');
    // process.stdout.write(events);
}

function parseFilePlain(path, i, scheduleData) {
    return fs.readFile(path, 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const events = parseSchedule(data);
        console.log('i, output rows:', i, events.length);
        scheduleData.days[i] = {
            events: events,
            dayNum: i,
        };
    })
}

async function readLocalFile(path, i, scheduleData) {
    const data = await fs.promises.readFile(path, 'utf-8');
    const events = parseSchedule(data);
    console.log('i, output rows:', i, events.length);
    scheduleData.days[i] = {
        events: events,
        dayNum: i,
    };
}

async function readSchedulePage(url, i, scheduleData) {
    try {
        const response = await axios.get(url);
        console.log('readSchedulePage success');
        const events = parseSchedule(response.data);
        console.log('i, output rows:', i, events.length);
        scheduleData.days[i] = {
            events: events,
            dayNum: i,
        };
    } catch (error) {
        console.error(error);
    }
}

function parseSchedule(content) {
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
        event.showUrl = $(this).find('td.tdshow a').attr('href');
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

async function scrapeShows() {
    // Complete list is not available without paging through via "Load More" btn
    let nextPageUrl = 'https://minnesotafringe.org/shows/2023';
    // let nextPageUrl = 'https://minnesotafringe.org/shows/2023?&prop_ModuleId=39277&page=6';
    let showData = [];
    try {
        while (nextPageUrl) {
            console.log('readShowPage', nextPageUrl);
            const response = await axios.get(nextPageUrl);
            let $page = cheerio.load(response.data, {xmlMode: false});
            showData.concat(parseShows($page));
            nextPageUrl = $page('a.loadMoreBtn').length ? $page('a.loadMoreBtn').attr('href') : false;
            await sleep(500);
        }
        fs.writeFileSync('shows.json', JSON.stringify(showData));
    } catch (error) {
        console.error(error);
    }
}

function parseShows(cheerioObj) {
    // console.log('shows content:', content.length, 'bytes');
    let $ = cheerioObj;
    let showEls = $('div.shows_list .shows_desc');
    console.log('showEls count:', showEls.length);
    let shows = [];
    $(showEls).each( function (i, s) {
        let show = {};
        show.showTitle = $(this).find('h6 a').text().trim();
        show.showUrl   = $(this).find('h6 a').attr('href');
        show.byArtist  = $(this).find('.mb6 b').text().trim();
        // showFavId is not available when not logged-in:
        // show.showFavId = $(this).find('a.js-fav-add').data('id');
        shows.push(show);
    });
    return shows;
}

function scrapeSingleShow() {
    let url = 'https://minnesotafringe.org/shows/2023/1992-mistakes-were-made-';
    // tags, reviews?
}

// RENDER

function render() {
    console.log("render()");
    const scheduleDataRaw = fs.readFileSync('schedule.json');
    let scheduleData = JSON.parse(scheduleDataRaw);
    const showDataRaw = fs.readFileSync('shows.json');
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
    .map( (e) => ( {...e,
        byArtist: showData.find((s) => s.showUrl == e.showUrl).byArtist,
        venueTag: venues.find((v) => v.venue == e.venue).tag ?? "",
     } ) )
    // sort to match master array
    .sort((a, b) => venueSort.indexOf(a.venue) - venueSort.indexOf(b.venue))
    // group by timeSlot (as object keys)
    .reduce((timeSlots, event) => {
        const timeSlot = (timeSlots[event.time] || {
            timeSlot: event.time,
            timeNum: timeToNum(event.time),
            events: []
        });
        timeSlot.events.push(event);
        timeSlots[event.time] = timeSlot;
        return timeSlots;
    }, {})
    ;

    let timeSlotList = Object.keys(dayTimeEvents).map((ts) => (timeToNum(ts))).sort();

    // discard timeslot keys and sort
    dayTimeEvents = Object.values(dayTimeEvents)
    .sort((a, b) => timeToNum(a.timeSlot) - timeToNum(b.timeSlot));

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
        docTitle: `${festYear} Schedule`,
        baseDomain: baseDomain,
        scrapeTime: new Date(scheduleData.scrapeTime).toLocaleString(),
        renderTime: new Date().toLocaleString(),
        dayNav: dayNav,
        dayLabel: dayNum,
        dayMeta: dayMeta,
        timeSlots: timeSlotList, // for intra-page scrolling/anchors?
        timesWithEvents: dayTimeEvents,
    };
    console.log('data: ', data.timeSlots);
    fs.readFile('schedule.mustache', function (err, template) {
        if (err) throw err;
        const content = mustache.render(template.toString(), data);
        fs.writeFile('schedule-' + dayMeta.slug + '.html', content, err => {
            if (err) throw err;
            // file written successfully
        });
    });
}

// UTILITIES

async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

function timeToNum(timeOfDayStr) {
    let [h, m, ap] = timeOfDayStr.split(/[: ]/);
    h = (ap == 'PM') ? 12 + parseInt(h) : parseInt(h);
    // return ('' + h + m).padStart(4, '0');
    return (h * 100) + parseInt(m);
}

// MAIN

// buildTest();
// scrapeSchedule();
// scrapeShows();
render();