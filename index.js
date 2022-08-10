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
// https://minnesotafringe.org/2022/schedule?d=19988

// Fringe site has an unknown dayNumber concept:
const dayNumOffset = 19977;
const festDays = [
    {dayNum:  1, label: 'Thu 08/04', dateStr: '08/04'},
    {dayNum:  2, label: 'Fri 08/05', dateStr: '08/05'},
    {dayNum:  3, label: 'Sat 08/06', dateStr: '08/06'},
    {dayNum:  4, label: 'Sun 08/07', dateStr: '08/07'},
    {dayNum:  5, label: 'Mon 08/08', dateStr: '08/08'},
    {dayNum:  6, label: 'Tue 08/09', dateStr: '08/09'},
    {dayNum:  7, label: 'Wed 08/10', dateStr: '08/10'},
    {dayNum:  8, label: 'Thu 08/11', dateStr: '08/11'},
    {dayNum:  9, label: 'Fri 08/12', dateStr: '08/12'},
    {dayNum: 10, label: 'Sat 08/13', dateStr: '08/13'},
    {dayNum: 11, label: 'Sun 08/14', dateStr: '08/14'},
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
    finalRender(collector);
}

function finalRender(collector) {
    // console.log('collector', collector);
    // @todo sort?
    let dayData = Object.values(collector.days).map( function(day) {
        day.dayLabel = festDays.find(v => v.dayNum == day.dayNum).label;
        return day;
    });

    data = {
        docTitle: '2022 Schedule',
        buildTime: new Date(collector.scrapeTime).toLocaleString(),
        dayNav: festDays,
        days: dayData,
    };
    fs.readFile('schedule.mustache', function (err, template) {
        if (err) throw err;
        const content = mustache.render(template.toString(), data);
        fs.writeFile(outfile, content, err => {
            if (err) throw err;
            // file written successfully
        });
    });
}

function renderRows(collector) {
    let content = '';
    const keys = Object.keys(collector).sort();
    keys.forEach( function (k) {
        console.log('rendering', k);
        collector[k].forEach( function(event) {
            content += renderRow(event);
        });
    });
    return content;
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
        prevDay: (i == 1) ? undefined : [{dayNum: i - 1}],
        nextDay: (i == 11) ? undefined : [{dayNum: i + 1}],
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
            prevDay: (i == 1) ? undefined : [{dayNum: i - 1}],
            nextDay: (i == 11) ? undefined : [{dayNum: i + 1}],
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
scrape();
// build();