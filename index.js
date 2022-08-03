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
        parseFilePromise('sample/2022 Schedule 8-04.html', 19978, collector),
        parseFilePromise('sample/2022 Schedule 8-05.html', 19979, collector),
        parseFilePromise('sample/2022 Schedule 8-06.html', 19980, collector),
    ];
    Promise.all(parsePromises).then( (values) => {
        console.log('all done');
        finalRender(collector);
    });
}

function finalRender(collector) {
    process.stdout.write('<html><head></head><body>');
    process.stdout.write('<table><tbody>');
    renderRows(collector);
    process.stdout.write('</tbody></table>');
    process.stdout.write('</body></html>');
}

function renderRows(collector) {
    const keys = Object.keys(collector).sort();
    keys.forEach( function (k) {
        console.log('rendering', k);
        collector[k].forEach( function(item) {
            process.stdout.write(renderRow(item));
        });
    });
}

function testParse() {
    console.log("testParse()");
    // initOutput('sample/sample-schedule.html');
    // var outDoc = cheerio.load('', {xmlMode: false});
    // var outRows = '';
    let collector = {};
    parseFile('sample/2022 Schedule 8-04.html', 19978, collector);
    // parseFile('sample/sample-schedule.html', 2, collector);
    // console.log('OUTPUT');
    // process.stdout.write(outRows);
}

function parseFile(path, i, collector) {
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

async function parseFilePromise(path, i, collector) {
    const data = await fs.promises.readFile(path, 'utf-8');
    const outRows = parseSchedule(data);
    console.log('i, output rows:', i, outRows.length);
    collector[i] = outRows;
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
        outRows.push(item);
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