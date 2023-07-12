// const rp = require('request-promise');
const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');
const mustache = require('mustache');
// const { testElement } = require('domutils');
// const { data } = require('cheerio/lib/api/attributes');

const scheduleOutfile = 'schedule.html';
const baseDomain = 'https://minnesotafringe.org';
const festYear = '2023';
const scheduleUrl = 'https://minnesotafringe.org/2022/schedule?d=19978';
// New fmt: https://minnesotafringe.org/schedule/2023?d=2023-08-03#schedule

// Fringe site had an unknown dayNumber concept:
const dayNumOffset = 19977;
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
    console.log("scrape()");
    let scheduleData = {
        scrapeTime: + new Date(),
        days: [],
    };
    let parsePromises = festDays.map( function(d) {
        // let fringeDay = d.dayNum + dayNumOffset;
        return readSchedulePage(`https://minnesotafringe.org/schedule/${festYear}?d=${d.isoDate}`, d.dayNum, scheduleData);
    });
    Promise.all(parsePromises).then( (values) => {
        console.log('all done! writing schedule.json...');
        fs.writeFileSync('schedule.json', JSON.stringify(scheduleData));
       // finalRender(scheduleData);
    });
}

function render() {
    console.log("render()");
    const scheduleDataRaw = fs.readFileSync('schedule.json');
    let scheduleData = JSON.parse(scheduleDataRaw);
    const showDataRaw = fs.readFileSync('shows.json');
    let showData = JSON.parse(showDataRaw);
    // finalRender(scheduleData);
    festDays.forEach( function(day) {
        // console.log('festDay', day);
        renderPage(scheduleData, showData, day.dayNum);
    });
    // renderPage(scheduleData, 9);

}

function renderPage(scheduleData, showData, dayNum) {
    console.log('renderPage for dayNum', dayNum);
    // @todo sort?
    // let dayData = Object.values(scheduleData.days).map( function(day) {
    //     day.dayLabel = festDays.find(v => v.dayNum == day.dayNum).label;
    //     return day;
    // });

    const dayEvents = Object.values(scheduleData.days).find( function(day) {
        return !!day && day.dayNum == dayNum;
    }).events.map( function(event) {
        event['tim'] = event.time.replace(' PM', '');
        return event;
    });

    let dayTimeEvents = Object.values(scheduleData.days).find( function(day) {
        return !!day && day.dayNum == dayNum;
    }).events
    // .map( (e) => ( e.byArtist = showData.find((s) => (s.showTitle == e.showTitle)).byArtist ) )
    .map( (e) => ( {...e, byArtist: showData.find((s) => s.showUrl == e.showUrl).byArtist } ) )
    .reduce((timeSlots, event) => {
        const timeSlot = (timeSlots[event.time] || {timeSlot: event.time, events: []});
        timeSlot.events.push(event);
        // console.log('timeSlot', timeSlot);
        timeSlots[event.time] = timeSlot;
        return timeSlots;
    }, {})
    ;
    console.log('dayTimeEvents', Object.values(dayTimeEvents));
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
        // days: dayData,
        events: dayEvents,
        groupedEvents: Object.values(dayTimeEvents),
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
        // parse tags like "AD" from day
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
    // Full list is not available without paging through via "Load More" btn
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

async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

// https://minnesotafringe.org/shows/2023?&prop_ModuleId=39277&page=2


// main().catch(console.error);
// buildTest();
// scrapeSchedule();
// scrapeShows();
render();