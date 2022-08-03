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


// var events = '';

function buildTest() {
    console.log("buildTest()");
    let collector = {};
    let parsePromises = [
        readLocalFile('sample/2022 Schedule 8-06.html', 19980, collector),
        readLocalFile('sample/2022 Schedule 8-05.html', 19979, collector),
        readLocalFile('sample/2022 Schedule 8-04.html', 19978, collector),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done');
        finalRender(collector);
    });
}

function build() {
    console.log("build()");
    let collector = {};
    let parsePromises = [
        readUrl('https://minnesotafringe.org/2022/schedule?d=19978', 19978, collector),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done');
        finalRender(collector);
    });
}

function finalRender(collector) {
    // console.log('collector', collector);
    // @todo sort?
    data = {
        docTitle: 'Hello Collector',
        days: Object.values(collector),
    };
    fs.readFile('schedule.mustache', function (err, template) {
        if (err) throw err;
        const content = mustache.render(template.toString(), data);
        fs.writeFile(outfile, content, err => {
            if (err) {
              console.error(err);
            }
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
        let events = parseSchedule(data);
        console.log('i, output rows:', i, events.length);
        collector[i] = events;
    })
}

async function readLocalFile(path, i, collector) {
    const data = await fs.promises.readFile(path, 'utf-8');
    const events = parseSchedule(data);
    console.log('i, output rows:', i, events.length);
    collector[i] = {
        day: i,
        events: events
    };
}

async function readUrl(url, i, collector) {
    try {
        const response = await axios.get(url);
        console.log('readUrl success');
        const events = parseSchedule(response.data);
        console.log('i, output rows:', i, events.length);
        collector[i] = events;
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
        // writeRow(event);
        events.push(event);
    });
    return events;
}

function writeRow(row) {
    process.stdout.write(`<tr><td><a href="${row.showUrl}">${row.showTitle}</a></td><td>${row.time}</td><td>${row.date}</td><td>${row.serviceTags}</td><td>${row.venue}</td></tr>\n`);
}

function renderRow(row) {
    return `<tr><td><a href="${row.showUrl}">${row.showTitle}</a></td><td>${row.time}</td><td>${row.date}</td><td>${row.serviceTags}</td><td>${row.venue}</td></tr>\n`;
}


// main().catch(console.error);
buildTest();