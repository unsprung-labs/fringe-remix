const rp = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');
const { testElement } = require('domutils');
// const { data } = require('cheerio/lib/api/attributes');

const baseDomain = 'https://minnesotafringe.org';
const scheduleUrl = 'https://minnesotafringe.org/2022/schedule?d=19978';
// https://minnesotafringe.org/2022/schedule?d=19988


// var outRows = '';

function testMultiParse() {
    console.log("testMultiParse()");
    let collector = {};
    let parsePromises = [
        loadTest('sample/2022 Schedule 8-04.html', 19978, collector),
        loadTest('sample/2022 Schedule 8-05.html', 19979, collector),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done', collector);
    });
}

function testParse() {
    console.log("testParse()");
    // initOutput('sample/sample-schedule.html');
    // var outDoc = cheerio.load('', {xmlMode: false});
    // var outRows = '';
    let collector = {};
    loadTest('sample/2022 Schedule 8-04.html', 19978, collector);
    // loadTest('sample/sample-schedule.html', 2, collector);
    // console.log('OUTPUT');
    // process.stdout.write(outRows);
}

function loadTest(path, i, collector) {
    return fs.readFile(path, 'utf-8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        let outRows = parseSchedule(data);
        console.log('i, output rows:', i, outRows.length);
        collector[i] = outRows;
    })
}

function parseSchedule(content) {
    console.log('content:', content.length, 'bytes');
    let $ = cheerio.load(content, {xmlMode: false});
    let inRows = $('table.theScheduleTable tbody tr');
    console.log('input rows:', inRows.length);
    var outRows = [];
    $(inRows).each( function (i, e) {
        let item = {};
        item.time = $(this).find('td.tdevent').text();
        item.venue = $(this).find('td.tdvenue a').text();
        item.showTitle = $(this).find('td.tdshow a').text();
        item.showUrl = baseDomain + $(this).find('td.tdshow a').attr('href');
        // parse tags like "AD" from day
        let dayTag = $(this).find('td.tddate').text();
        const dtrx = /^(\d+\/\d+)\s*(.*)/;
        item.date = dayTag.match(dtrx)[1];
        item.serviceTags = dayTag.match(dtrx)[2];
        // console.log('row:', item);
        // writeRow(item);
        outRows.push(renderRow(item));
    });
    return outRows;
}

function writeRow(row) {
    process.stdout.write(`<tr><td><a href="${row.showUrl}">${row.showTitle}</a></td><td>${row.time}</td><td>${row.date}</td><td>${row.serviceTags}</td><td>${row.venue}</td></tr>\n`);
}

function renderRow(row) {
    return `<tr><td><a href="${row.showUrl}">${row.showTitle}</a></td><td>${row.time}</td><td>${row.date}</td><td>${row.serviceTags}</td><td>${row.venue}</td></tr>\n`;
}


// main().catch(console.error);
testMultiParse();