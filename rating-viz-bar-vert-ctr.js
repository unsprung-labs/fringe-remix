/*
Bar chart with gradient colors, vertically centered.

*/

const mustache = require('mustache');

class RatingViz {

    constructor() {
        this.template = /*html*/ `
            <svg width="100" height="20">
                <rect id="BG" x="0" y="0" width="100" height="20" style="fill:none;stroke:rgb(170, 170, 170);stroke-width:0.5px;"/>
                <path id="CenterLine" d="M0,10L100,10" stroke-dasharray="1" style="fill:none;stroke:rgb(170, 170, 170);stroke-width:0.5px;"/>
                {{#bins}}
                    <rect x="{{x}}" y="{{y}}" width="{{width}}" height="{{height}}" style="{{style}}"/>
                {{/bins}}
            </svg>
        `;
    }

    binData(ratingStats) {
        const maxHeight = 20;
        const binWidth = 10;
        // const popFrac = ratingStats.totalCount > 5 ? 1 : 0.8;
        let popFrac = 1;
        switch (true) {
            case ratingStats.totalCount == 0:
                popFrac = 0;
                break;
            case ratingStats.totalCount == 1:
                popFrac = 0.2;
                break;
            case ratingStats.totalCount > 1 && ratingStats.totalCount <= 6:
                popFrac = 0.4;
                break;
            case ratingStats.totalCount > 6 && ratingStats.totalCount <= 12:
                popFrac = 0.6;
                break;
            case ratingStats.totalCount > 12 && ratingStats.totalCount <= 24:
                popFrac = 0.8;
                break;
        }
        const bins = [
            { score: 0.5, fill: 'rgb(221,0,0)'},
            { score: 1.0, fill: 'rgb(228,51,0)'},
            { score: 1.5, fill: 'rgb(236,110,0)'},
            { score: 2.0, fill: 'rgb(243,164,0)'},
            { score: 2.5, fill: 'rgb(234,205,0)'},
            { score: 3.0, fill: 'rgb(208,208,0)'},
            { score: 3.5, fill: 'rgb(156,196,0)'},
            { score: 4.0, fill: 'rgb(104,184,0)'},
            { score: 4.5, fill: 'rgb(52,172,0)'},
            { score: 5.0, fill: 'rgb(0,160,0)'},
        ];
        const result = bins.map((v,i) => {
            // rect[angle] params; x,y = top left corner
            let binFrac = 0;
            if (ratingStats.distribution && ratingStats.distribution[v.score]) {
                binFrac = ratingStats.distribution[v.score] ?? 0; // 0-1
            }
            binFrac = binFrac * popFrac; // ceiling hgt if not enough reviews
            binFrac = binFrac > 0 ? Math.max(binFrac, 0.1) : 0; // min hgt
            let barHeight = maxHeight * binFrac;
            let y = (maxHeight - barHeight) / 2;
            return {
                x: i * binWidth,
                y: y,
                width: binWidth,
                height: barHeight,
                style: `fill:${v.fill};`,
            };
        });
        // console.log('graph data', result);
        return result;
    }

    render(ratingStats, options = {}) {
        const data = {bins: this.binData(ratingStats)};
        return mustache.render(this.template, data);
    }
}

module.exports = new RatingViz();