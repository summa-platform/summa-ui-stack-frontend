import {inject, bindable} from 'aurelia-framework';
import * as d3 from 'd3';


@inject(Element)
export class Histogram {
	@bindable data;
	@bindable select;
	@bindable height = '100%';
	@bindable width = '100%';

	constructor(element) {
		this.element = element;
		this.svg = d3.select(this.element).select('svg');
	}

	attached() {
		this.svg = d3.select(this.element).select('svg');
		this.draw(this.data);
		// function prevent() {
		// 	d3.event.stopImmediatePropagation();
		// 	d3.event.stopPropagation();
		// 	d3.event.preventDefault();
		// }
		// this.svg.on("dblclick", function () {
		// 	d3.event.stopImmediatePropagation();
		// 	d3.event.stopPropagation();
		// 	d3.event.preventDefault();
		// });
		// this.svg.on("click", prevent);
		// this.svg.on("mouseup", prevent);
		// this.svg.on("mousedown", prevent);
	}

	dataChanged(data) {
		if(data) {
			this.draw(data);
		} else {
			this.draw([]);
		}
	}

	draw(data) {
		// var data = d3.range(1000).map(d3.randomBates(10));
		var formatCount = d3.format(",.0f");

		let svg =  this.svg;
		// var svg = d3.select(this.svg),

		svg.select('g').remove();	// remove any old elements

		var margin = {top: 10, right: 20, bottom: 30, left: 20},
			g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		let $svg = $(svg.node());
		let width = $svg.width();
		let height = $svg.height();


		let nonEmptyBin = false;
		for(let bin of data) {
			if(bin > 0) {
				nonEmptyBin = true;
				break;
			}
		}
		if(!nonEmptyBin) {
			// g.selectAll(".bar").remove();
			// g.selectAll('g').remove();
			g.append("text")
				.attr("dy", -10)
				.attr("y", height/2)
				.attr("x", width/2)
				.attr("fill", 'black')
				.attr("text-anchor", "middle")
				.style('font-size', '18px')
				.text('There are no trending data for last 24 hours.');
			return;
		}

		width -= margin.left + margin.right;
		height -= margin.top + margin.bottom;

		var xScale = d3.scaleLinear()
			.domain([-data.length, 0])
			// .domain([-1, data.length])
			.range([0, width]);
			// .rangeRound([0, width]);

		var x = d3.scaleLinear()
			.domain([0, data.length])
			.range([0, width]);
			// .rangeRound([0, width]);

		var bins = d3.histogram()
			.domain(x.domain())
			// .thresholds(x.ticks(20))
			.thresholds(data.length)
			// .thresholds(x.ticks(data.length))
			(data);

		var y = d3.scaleLinear()
			.domain([0, d3.max(data, function(d) { return d; })])
			.range([height, 0]);

		// var bar = g.selectAll(".bar")
		// 	.data(bins).enter().append("g")
		// 	.attr("class", "bar")
		// 	.attr("transform", function(d, i) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; });
		
		let barWidth = width/data.length;

		var bar = g.selectAll(".bar")
			.data(data).enter().append("g")
			.attr("class", "bar")
			.attr("transform", function(d, i) { return "translate(" + x(i) + "," + y(d) + ")"; });
			// .attr("transform", function(d, i) { return "translate(" + i*barWidth + "," + y(d) + ")"; });

		const self = this;
		let clicked = false;

		function clickHandler(d, i) {
			if(self.select && !clicked) {
				const event = d3.event;
				clicked = true;
				d3.event.stopImmediatePropagation();
				d3.event.stopPropagation();
				d3.event.preventDefault();
				setTimeout(() => {
					self.select({ $bin: i, $evt: event });
					clicked = false;
				}, 100);
			}
		}

		function prevent() {
			d3.event.stopImmediatePropagation();
			d3.event.stopPropagation();
			d3.event.preventDefault();
		}

		bar.append("rect")
			.attr("x", 1)
			.attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
			.attr("height", function(d) { return height - y(d); })
			// .on("dblclick", prevent)
			// .on("mouseup", prevent)
			// .on("mousedown", prevent)
			.on("click", clickHandler);

		bar.append("text")
			.attr("dy", ".75em")
			// .attr("y", 6)
			.attr("y", function (d, i) { return (height - y(d) < 16) ? -10 : 6; })
			.attr("x", (x(bins[0].x1) - x(bins[0].x0)) / 2)
			.attr("fill", function (d, i) { return (height - y(d) < 16) ? '#999' : '#fff'; })
			.attr("text-anchor", "middle")
			.text(function(d) { return d > 0 ? formatCount(d) : ''; })
			.on("click", clickHandler);

		const ticks = data.length;

		g.append("g")
			.attr("class", "axis axis--x")
			.attr("transform", "translate(0," + height + ")")
			.call(d3.axisBottom(xScale).ticks(ticks).tickFormat(function (d, i) {
				if(i == ticks)
					return 'now';
				else if(i == 0)
					return '-'+data.length+'h';
				return d;
			}))
			.call(function (g) {
				g.selectAll(".tick text").each(function (d, i) {
					if(i == 0 || i == 24) {
						d3.select(this).attr("dy", "0.75em").style("font-weight", "bold").style("font-size", "12px");
					}
				});
			});

		/*
		g.append("text")
			.attr("dy", ".75em")
			.attr("y", 0)
			// .attr("y", -10)
			.attr("x", 0)
			.attr("text-anchor", "middle")
			.text("-24h");

		g.append("text")
			.attr("dy", ".75em")
			.attr("y", 0)
			// .attr("y", -5)
			.attr("x", width)
			.attr("text-anchor", "middle")
			.text("now");
		*/
	}
}
