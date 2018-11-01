import {inject, bindable} from 'aurelia-framework';
import * as d3 from 'd3';
import D3Timeline from './d3-timeline';


@inject(Element)
export class Timeline {
	@bindable data;
	@bindable select;
	@bindable height = '100%';
	@bindable width = '100%';

	constructor(element) {
		this.element = element;
		this.svg = d3.select(this.element).select('svg');

		this.timeline = new D3Timeline();

		const self = this;
		let clicked = false;
		
		this.timeline.click = function (d) {
			console.log(d); 
			if(self.select && !clicked) {
				const event = d3.event;
				clicked = true;
				d3.event.stopImmediatePropagation();
				d3.event.stopPropagation();
				d3.event.preventDefault();
				setTimeout(() => {
					self.select({ $id: d.id, $newsItem: d, $evt: event });
					clicked = false;
				}, 100);
			}
		};
	}

	attached() {
		this.svg = d3.select(this.element).select('svg');
		this.g = this.svg.append("g");//.attr("width", 50000);

		this.draw(this.items);
	}

	dataChanged(data) {
		if(data) {
			this.setData(data);
		} else {
			this.setData([]);
		}
	}

	setData(data) {

		this.datetime = data.datetime*1000;

		let items = [];
		for(let newsItem of data.newsItems) {
			// let start = (new Date(newsItem.timeAdded)).getTime();
			items.push({
				id: newsItem.id,
				timeAdded: newsItem.timeAdded,
				starting_time: newsItem.start*1000,
				ending_time: newsItem.start*1000 + 60*5*1000, // end = start + 5 minutes
				// start: start,
				// end: start + 60000*5, // end = start + 5 minutes
				keywords: newsItem.topics,
				weights: newsItem.topic_weights,
				// label: newsItem.topics.join('<br/>'),
				range_start: data.start*1000,
				range_end: data.end*1000,
			});
		}
		items = [items];
		this.items = items;

		this.draw(items);
	}

	draw(data) {

		if(!this.g) {
			return;
		}

		this.g.attr("width", 50000).datum(data).call(this.timeline.draw, this.datetime);
	}
}
