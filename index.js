// const rp = require('request-promise');
const axios = require('axios').default;
const cheerio = require('cheerio');
const fs = require('fs');
const mustache = require('mustache');
// const { testElement } = require('domutils');
// const { data } = require('cheerio/lib/api/attributes');

const outfile = 'schedule.html';
const baseDomain = 'https://minnesotafringe.org';
const scheduleUrl = 'https://minnesotafringe.org/2022/schedule?d=19978';

// Fringe site has an unknown dayNumber concept:
const dayNumOffset = 19977;
const festDays = [
    {dayNum:  1, dateStr: '08/04', slug: '804', dow: 'Thu', dom:  '4', label: 'Thursday 8/04'},
    {dayNum:  2, dateStr: '08/05', slug: '805', dow: 'Fri', dom:  '5', label: 'Friday 8/05'},
    {dayNum:  3, dateStr: '08/06', slug: '806', dow: 'Sat', dom:  '6', label: 'Saturday 8/06'},
    {dayNum:  4, dateStr: '08/07', slug: '807', dow: 'Sun', dom:  '7', label: 'Sunday 8/07'},
    {dayNum:  5, dateStr: '08/08', slug: '808', dow: 'Mon', dom:  '8', label: 'Monday 8/08'},
    {dayNum:  6, dateStr: '08/09', slug: '809', dow: 'Tue', dom:  '9', label: 'Tuesday 8/09'},
    {dayNum:  7, dateStr: '08/10', slug: '810', dow: 'Wed', dom: '10', label: 'Wednesday 8/10'},
    {dayNum:  8, dateStr: '08/11', slug: '811', dow: 'Thu', dom: '11', label: 'Thursday 8/11'},
    {dayNum:  9, dateStr: '08/12', slug: '812', dow: 'Fri', dom: '12', label: 'Friday 8/12'},
    {dayNum: 10, dateStr: '08/13', slug: '813', dow: 'Sat', dom: '13', label: 'Saturday 8/13'},
    {dayNum: 11, dateStr: '08/14', slug: '814', dow: 'Sun', dom: '14', label: 'Sunday 8/14'},
];

function scrapeTest() {
    console.log("scrapeTest()");
    let collector = {
        scrapeTime: + new Date(),
        days: [],
    };
    let parsePromises = [
        readLocalFile('sample/2022 Schedule 8-06.html', 3, collector),
        readLocalFile('sample/2022 Schedule 8-05.html', 2, collector),
        readLocalFile('sample/2022 Schedule 8-04.html', 1, collector),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done');
        finalRender(collector);
    });
}

function scrape() {
    console.log("scrape()");
    let collector = {
        scrapeTime: + new Date(),
        days: [],
    };
    let parsePromises = festDays.map( function(d) {
        let fringeDay = d.dayNum + dayNumOffset;
        return readUrl(`https://minnesotafringe.org/2022/schedule?d=${fringeDay}`, d.dayNum, collector);
    });
    Promise.all(parsePromises).then( (values) => {
        console.log('all done!');
        fs.writeFileSync('schedule.json', JSON.stringify(collector));
       // finalRender(collector);
    });
}

function build() {
    console.log("build()");
    const collectorRaw = fs.readFileSync('schedule.json');
    let collector = JSON.parse(collectorRaw);
    // finalRender(collector);
    festDays.forEach( function(day) {
        // console.log('festDay', day);
        renderPage(collector, day.dayNum);
    });
    // renderPage(collector, 9);

}

function renderPage(collector, dayNum) {
    console.log('dayNum', dayNum);
    // @todo sort?
    // let dayData = Object.values(collector.days).map( function(day) {
    //     day.dayLabel = festDays.find(v => v.dayNum == day.dayNum).label;
    //     return day;
    // });

    const dayEvents = Object.values(collector.days).find( function(day) {
        return !!day && day.dayNum == dayNum;
    }).events;

    const dayNav = festDays.map( function (dayRef) {
        let day = {...dayRef};
        day['active'] = (day.dayNum == dayNum) ? 'active' : '';
        return day;
    });
    // console.log('dayNav', dayNav);
    const dayMeta = festDays.find( function (day) {
        return day.dayNum == dayNum;
    });

    const data = {
        docTitle: '2022 Schedule',
        buildTime: new Date(collector.scrapeTime).toLocaleString(),
        dayNav: dayNav,
        dayLabel: dayNum,
        dayMeta: dayMeta,
        // days: dayData,
        events: dayEvents,
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
    let collector = {};
    readLocalFile('sample/2022 Schedule 8-04.html', 19978, collector);
    // readLocalFile('sample/sample-schedule.html', 2, collector);
    // console.log('OUTPUT');
    // process.stdout.write(events);
}

function parseFilePlain(path, i, collector) {
    return fs.readFile(path, 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const events = parseSchedule(data);
        console.log('i, output rows:', i, events.length);
        collector.days[i] = {
            events: events,
            dayNum: i,
        };
    })
}

async function readLocalFile(path, i, collector) {
    const data = await fs.promises.readFile(path, 'utf-8');
    const events = parseSchedule(data);
    console.log('i, output rows:', i, events.length);
    collector.days[i] = {
        events: events,
        dayNum: i,
    };
}

async function readUrl(url, i, collector) {
    try {
        const response = await axios.get(url);
        console.log('readUrl success');
        const events = parseSchedule(response.data);
        console.log('i, output rows:', i, events.length);
        collector.days[i] = {
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
        event.time = $(this).find('td.tdevent').text();
        event.venue = $(this).find('td.tdvenue a').text();
        event.showTitle = $(this).find('td.tdshow a').text();
        event.showUrl = baseDomain + $(this).find('td.tdshow a').attr('href');
        // parse tags like "AD" from day
        let dayTag = $(this).find('td.tddate').text();
        const dtrx = /^(\d+\/\d+)\s*(.*)/;
        event.date = dayTag.match(dtrx)[1];
        event.serviceTags = dayTag.match(dtrx)[2];
        // console.log('row:', event);
        events.push(event);
    });
    return events;
}


// main().catch(console.error);
// buildTest();
// scrape();
build();